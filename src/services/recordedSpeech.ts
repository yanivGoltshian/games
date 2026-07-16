import type { SpeechLocale } from '../domain/types';
import { getSharedAudioContext, unlockAudioContext } from './sound';

interface RecordedSpeechClip {
  src: string;
  offset: number;
  duration: number;
}

interface RecordedSpeechManifest {
  version: number;
  entries: Record<string, RecordedSpeechClip>;
}

interface RecordedPlayback {
  source: AudioBufferSourceNode;
  finish: () => void;
}

export interface RecordedSpeechPlayOptions {
  text: string;
  locale: SpeechLocale;
  volume: number;
  onStart: () => void;
}

export interface RecordedSpeechBackend {
  isEnabled: () => boolean;
  unlock: () => Promise<void>;
  play: (options: RecordedSpeechPlayOptions) => Promise<void>;
  cancel: () => void;
}

export interface RecordedSpeechEnvironment {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  // Standalone signals are retained for diagnostics only; the recorded
  // speech fallback no longer depends on them (see shouldUseRecordedSpeech).
  navigatorStandalone?: boolean;
  displayModeStandalone?: boolean;
}

function currentEnvironment(): RecordedSpeechEnvironment | null {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return null;
  }
  const appleNavigator = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    ...(appleNavigator.standalone === undefined
      ? {}
      : { navigatorStandalone: appleNavigator.standalone }),
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  };
}

/**
 * Apple mobile WebKit (iPad, iPhone, iPod, and iPadOS reporting as MacIntel
 * with touch) lacks reliable Web Speech for offline/localised playback, so we
 * always route it through the recorded speech sprites. This applies in every
 * context — installed standalone, Safari, and Chrome (also WebKit on iOS) —
 * not just standalone. Android and desktop keep using Web Speech.
 */
export function shouldUseRecordedSpeech(
  environment = currentEnvironment(),
): boolean {
  if (!environment) {
    return false;
  }
  const isAppleMobile =
    /iPad|iPhone|iPod/i.test(environment.userAgent) ||
    (environment.platform === 'MacIntel' && environment.maxTouchPoints > 1);
  return isAppleMobile;
}

function manifestKey(locale: SpeechLocale, text: string): string {
  return `${locale}\u0000${text}`;
}

export class RecordedSpeechPlayer implements RecordedSpeechBackend {
  private manifestPromise: Promise<RecordedSpeechManifest> | null = null;
  private bufferCache: { src: string; buffer: AudioBuffer } | null = null;
  private pendingBuffer: { src: string; promise: Promise<AudioBuffer> } | null = null;
  private activePlayback: RecordedPlayback | null = null;
  private cancellationGeneration = 0;

  constructor(
    private readonly contextProvider: () => AudioContext | null = getSharedAudioContext,
    private readonly unlockContext: () => Promise<void> = unlockAudioContext,
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
    private readonly enabled: () => boolean = shouldUseRecordedSpeech,
  ) {}

  isEnabled(): boolean {
    return this.enabled();
  }

  async unlock(): Promise<void> {
    await this.unlockContext();
  }

  async play(options: RecordedSpeechPlayOptions): Promise<void> {
    const generation = this.cancellationGeneration;
    const context = this.contextProvider();
    if (!context) {
      throw new Error('AudioContext is unavailable for recorded speech.');
    }
    const manifest = await this.loadManifest();
    const clip = manifest.entries[manifestKey(options.locale, options.text)];
    if (!clip) {
      throw new Error(`Recorded speech is missing for ${options.locale}: ${options.text}`);
    }
    const buffer = await this.loadBuffer(clip.src);
    if (generation !== this.cancellationGeneration) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = Math.min(1, Math.max(0, options.volume));
      source.connect(gain);
      gain.connect(context.destination);

      let finished = false;
      const finish = () => {
        if (finished) {
          return;
        }
        finished = true;
        if (this.activePlayback?.source === source) {
          this.activePlayback = null;
        }
        resolve();
      };
      source.onended = finish;
      this.activePlayback = { source, finish };

      try {
        source.start(0, clip.offset, clip.duration);
        options.onStart();
      } catch (error) {
        this.activePlayback = null;
        reject(error);
      }
    });
  }

  cancel(): void {
    this.cancellationGeneration += 1;
    const playback = this.activePlayback;
    if (!playback) {
      return;
    }
    this.activePlayback = null;
    playback.source.onended = null;
    try {
      playback.source.stop();
    } finally {
      playback.finish();
    }
  }

  private loadManifest(): Promise<RecordedSpeechManifest> {
    this.manifestPromise ??= this.fetcher('/speech/manifest.json', { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Recorded speech manifest failed with HTTP ${response.status}.`);
        }
        return response.json() as Promise<RecordedSpeechManifest>;
      })
      .catch((error: unknown) => {
        this.manifestPromise = null;
        throw error;
      });
    return this.manifestPromise;
  }

  private loadBuffer(src: string): Promise<AudioBuffer> {
    if (this.bufferCache?.src === src) {
      return Promise.resolve(this.bufferCache.buffer);
    }
    if (this.pendingBuffer?.src === src) {
      return this.pendingBuffer.promise;
    }
    if (this.pendingBuffer) {
      const previous = this.pendingBuffer.promise;
      return previous.then(
        () => this.loadBuffer(src),
        () => this.loadBuffer(src),
      );
    }

    // Keep at most one decoded locale. The previous buffer becomes collectible
    // before another locale is fetched and decoded.
    this.bufferCache = null;
    const pending = this.fetcher(src, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Recorded speech audio failed with HTTP ${response.status}.`);
        }
        return response.arrayBuffer();
      })
      .then((encoded) => {
        const context = this.contextProvider();
        if (!context) {
          throw new Error('AudioContext is unavailable while decoding recorded speech.');
        }
        return context.decodeAudioData(encoded);
      })
      .then((buffer) => {
        if (this.pendingBuffer?.promise === pending) {
          this.bufferCache = { src, buffer };
          this.pendingBuffer = null;
        }
        return buffer;
      })
      .catch((error: unknown) => {
        if (this.pendingBuffer?.promise === pending) {
          this.pendingBuffer = null;
        }
        throw error;
      });
    this.pendingBuffer = { src, promise: pending };
    return pending;
  }
}

export const recordedSpeechPlayer = new RecordedSpeechPlayer();
