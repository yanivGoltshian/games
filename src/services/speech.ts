import type { EnglishVoiceLocale, LearningConcept, SpeechLocale, ToddlerSettings } from '../domain/types';

export interface SpeechSegment {
  text: string;
  locale: SpeechLocale;
  pauseAfterMs?: number;
  cue?: string;
}

export interface SpeechStatus {
  supported: boolean;
  voiceAvailable: boolean;
  speaking: boolean;
  activeRequestId: number | null;
  activeCue: string | null;
}

export type SpeechPriority = 'prompt' | 'label' | 'retry' | 'success' | 'replay';
export type SpeechResultStatus = 'completed' | 'cancelled' | 'superseded' | 'skipped' | 'unsupported' | 'error' | 'timed-out';
export type SpeechCancelReason = 'navigation' | 'replay' | 'visibility';

export interface SpeechResult {
  requestId: number;
  status: SpeechResultStatus;
}

export interface SpeechRequestOptions {
  scope?: string;
  key?: string;
  priority?: SpeechPriority;
  /** Reserved for explicit user replay. Routine prompts must never interrupt. */
  interrupt?: boolean;
  /** Marks feedback that becomes contradictory as soon as the round succeeds. */
  staleAfterSuccess?: boolean;
}

interface QueuedSpeechRequest {
  id: number;
  order: number;
  scope: string;
  key: string | undefined;
  priority: SpeechPriority;
  segments: SpeechSegment[];
  settings: ToddlerSettings;
  resolve: (result: SpeechResult) => void;
  cancelledAs: SpeechResultStatus | null;
  cancelCurrent: (() => void) | null;
  retryCurrent: (() => void) | null;
  staleAfterSuccess: boolean;
}

type SpeechActivationState = 'locked' | 'priming' | 'ready';

const PRIORITY_WEIGHT: Record<SpeechPriority, number> = {
  prompt: 20,
  label: 40,
  retry: 60,
  replay: 80,
  success: 100,
};

const PREFERRED_VOICE_NAMES: Record<SpeechLocale, readonly string[]> = {
  'he-IL': ['carmit', 'carmel', 'hila'],
  'en-US': ['samantha', 'ava', 'allison', 'susan'],
  'en-GB': ['daniel', 'serena', 'martha'],
};

const VOICE_WAIT_MS = 900;
const UTTERANCE_GUARD_BASE_MS = 8_000;

export function speechRateForLocale(locale: SpeechLocale): number {
  return locale === 'he-IL' ? 0.72 : 0.76;
}

export function selectVoiceForLocale(
  voices: readonly SpeechSynthesisVoice[],
  locale: SpeechLocale,
): SpeechSynthesisVoice | null {
  const language = locale.split('-')[0]!.toLowerCase();
  const preferred = PREFERRED_VOICE_NAMES[locale];
  const candidates = voices
    .filter((voice) => voice.lang.toLowerCase() === locale.toLowerCase() || voice.lang.toLowerCase().startsWith(language))
    .map((voice) => {
      const normalizedName = voice.name.toLowerCase();
      const preferredIndex = preferred.findIndex((name) => normalizedName.includes(name));
      const exactLocale = voice.lang.toLowerCase() === locale.toLowerCase();
      const score =
        (exactLocale ? 1_000 : 0)
        + (voice.localService ? 100 : 0)
        + (preferredIndex >= 0 ? 300 - preferredIndex : 0)
        + (voice.default ? 10 : 0);
      return { voice, score };
    });

  candidates.sort((left, right) => (
    right.score - left.score
    || left.voice.name.localeCompare(right.voice.name)
    || left.voice.voiceURI.localeCompare(right.voice.voiceURI)
  ));
  return candidates[0]?.voice ?? null;
}

/**
 * One serialized speech queue for the entire app. Requests may replace stale
 * queued work, but active speech is only interrupted by explicit replay,
 * navigation, page visibility changes, or feedback explicitly marked stale
 * after the child completes the round.
 */
export class SpeechService {
  private subscribers = new Set<(status: SpeechStatus) => void>();
  private queue: QueuedSpeechRequest[] = [];
  private active: QueuedSpeechRequest | null = null;
  private processing = false;
  private activationState: SpeechActivationState = 'locked';
  private primerAttempt = 0;
  private nextRequestId = 1;
  private nextOrder = 1;
  private voicesReadyPromise: Promise<void> | null = null;
  private activeCue: string | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', this.handleVoicesChanged);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
      }
      window.addEventListener('pagehide', this.handlePageHide);
    }
  }

  private handleVoicesChanged = (): void => {
    this.voicesReadyPromise = null;
    this.notify();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.cancelAll('visibility');
      this.lock();
      return;
    }
    this.lock();
    this.notify();
  };

  private handlePageHide = (): void => {
    this.cancelAll('visibility');
    this.lock();
  };

  private isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  getStatus(): SpeechStatus {
    const supported = this.isSupported();
    const voices = supported ? window.speechSynthesis.getVoices() : [];
    return {
      supported,
      voiceAvailable: voices.length > 0,
      speaking: this.active !== null,
      activeRequestId: this.active?.id ?? null,
      activeCue: this.activeCue,
    };
  }

  subscribe(callback: (status: SpeechStatus) => void): () => void {
    this.subscribers.add(callback);
    callback(this.getStatus());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.subscribers.forEach((subscriber) => subscriber(status));
  }

  private lock(): void {
    this.primerAttempt += 1;
    this.activationState = 'locked';
  }

  private primeSpeechEngine(): void {
    const synthesis = window.speechSynthesis;
    const attempt = ++this.primerAttempt;
    this.activationState = 'priming';
    const utterance = new SpeechSynthesisUtterance('\u00a0');
    utterance.volume = 1;
    utterance.rate = 1;

    const markReady = (): void => {
      if (attempt !== this.primerAttempt || this.activationState !== 'priming') {
        return;
      }
      this.activationState = 'ready';
      this.notify();
      void this.processQueue();
    };
    utterance.onstart = markReady;
    utterance.onend = markReady;
    utterance.onerror = () => {
      if (attempt !== this.primerAttempt) {
        return;
      }
      this.activationState = 'locked';
      this.notify();
    };

    try {
      synthesis.speak(utterance);
    } catch {
      if (attempt === this.primerAttempt) {
        this.activationState = 'locked';
        this.notify();
      }
    }
  }

  /**
   * Must be called directly from a pointer or keyboard event. The contentless,
   * non-muted primer is required because iPadOS can ignore muted utterances.
   * Later activations resume the engine or retry only an utterance that never
   * reached onstart, so a word already being spoken is never interrupted.
   */
  unlock(): void {
    if (!this.isSupported()) {
      return;
    }

    const synthesis = window.speechSynthesis;
    synthesis.getVoices();
    void this.waitForVoices().then(() => this.notify());
    synthesis.resume();

    if (this.active?.retryCurrent) {
      this.active.retryCurrent();
      return;
    }

    if (this.activationState === 'ready') {
      void this.processQueue();
      return;
    }

    if (this.activationState === 'priming') {
      if (synthesis.speaking) {
        return;
      }
      this.primerAttempt += 1;
      if (synthesis.pending) {
        synthesis.cancel();
      }
    }

    this.primeSpeechEngine();
  }

  private async waitForVoices(): Promise<void> {
    if (!this.isSupported() || window.speechSynthesis.getVoices().length > 0) {
      return;
    }
    if (this.voicesReadyPromise) {
      return this.voicesReadyPromise;
    }

    this.voicesReadyPromise = new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        window.speechSynthesis.removeEventListener('voiceschanged', finish);
        resolve();
      };
      const timer = window.setTimeout(finish, VOICE_WAIT_MS);
      window.speechSynthesis.addEventListener('voiceschanged', finish);
    });
    await this.voicesReadyPromise;
  }

  private settleQueued(request: QueuedSpeechRequest, status: SpeechResultStatus): void {
    request.resolve({ requestId: request.id, status });
  }

  private removeQueued(
    predicate: (request: QueuedSpeechRequest) => boolean,
    status: SpeechResultStatus = 'superseded',
  ): void {
    const kept: QueuedSpeechRequest[] = [];
    for (const request of this.queue) {
      if (predicate(request)) {
        this.settleQueued(request, status);
      } else {
        kept.push(request);
      }
    }
    this.queue = kept;
  }

  private interruptActive(status: SpeechResultStatus): void {
    if (!this.active) {
      return;
    }
    this.active.cancelledAs = status;
    this.activeCue = null;
    this.active.cancelCurrent?.();
  }

  cancelAll(reason: SpeechCancelReason = 'navigation'): void {
    const status: SpeechResultStatus = reason === 'replay' ? 'superseded' : 'cancelled';
    this.removeQueued(() => true, status);
    this.interruptActive(status);
  }

  cancelScope(scope: string, reason: SpeechCancelReason = 'navigation'): void {
    const status: SpeechResultStatus = reason === 'replay' ? 'superseded' : 'cancelled';
    this.removeQueued((request) => request.scope === scope, status);
    if (this.active?.scope === scope) {
      this.interruptActive(status);
    }
  }

  supersedeRetry(scope: string): void {
    this.removeQueued((request) => request.scope === scope && request.priority === 'retry');
    if (this.active?.scope === scope && this.active.priority === 'retry') {
      // Preserve the word already being spoken; runRequest observes this state
      // at the next utterance boundary and then advances to the newer request.
      this.active.cancelledAs = 'superseded';
    }
  }

  private enqueue(
    segments: SpeechSegment[],
    settings: ToddlerSettings,
    options: SpeechRequestOptions = {},
  ): Promise<SpeechResult> {
    const id = this.nextRequestId++;
    if (settings.quietMode || segments.length === 0) {
      return Promise.resolve({ requestId: id, status: 'skipped' });
    }
    if (!this.isSupported()) {
      return Promise.resolve({ requestId: id, status: 'unsupported' });
    }

    const scope = options.scope ?? 'app';
    const priority = options.priority ?? 'prompt';
    if (options.interrupt) {
      this.cancelScope(scope, 'replay');
    }
    if (options.key) {
      this.removeQueued((request) => request.scope === scope && request.key === options.key);
    }

    const done = new Promise<SpeechResult>((resolve) => {
      this.queue.push({
        id,
        order: this.nextOrder++,
        scope,
        key: options.key,
        priority,
        segments,
        settings,
        resolve,
        cancelledAs: null,
        cancelCurrent: null,
        retryCurrent: null,
        staleAfterSuccess: options.staleAfterSuccess ?? false,
      });
      this.queue.sort((left, right) => (
        PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority]
        || left.order - right.order
      ));
    });

    void this.processQueue();
    return done;
  }

  private wait(ms: number, request: QueuedSpeechRequest): Promise<SpeechResultStatus> {
    if (ms <= 0) {
      return Promise.resolve(request.cancelledAs ?? 'completed');
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (status: SpeechResultStatus): void => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        request.cancelCurrent = null;
        resolve(status);
      };
      const timer = window.setTimeout(() => finish('completed'), ms);
      request.cancelCurrent = () => finish(request.cancelledAs ?? 'cancelled');
    });
  }

  private speakUtterance(segment: SpeechSegment, request: QueuedSpeechRequest): Promise<SpeechResultStatus> {
    return new Promise((resolve) => {
      let settled = false;
      let attempt = 0;
      let started = false;
      let guard: number | null = null;
      const clearGuard = (): void => {
        if (guard !== null) {
          window.clearTimeout(guard);
          guard = null;
        }
      };
      const finish = (status: SpeechResultStatus): void => {
        if (settled) {
          return;
        }
        settled = true;
        attempt += 1;
        clearGuard();
        request.cancelCurrent = null;
        request.retryCurrent = null;
        if (this.activeCue === segment.cue) {
          this.activeCue = null;
          this.notify();
        }

        resolve(status);
      };

      const speakAttempt = (): void => {
        if (settled || request.cancelledAs) {
          finish(request.cancelledAs ?? 'cancelled');
          return;
        }

        const synthesis = window.speechSynthesis;
        const currentAttempt = ++attempt;
        started = false;
        clearGuard();

        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.lang = segment.locale;
        utterance.rate = speechRateForLocale(segment.locale);
        utterance.pitch = 1;
        utterance.volume = Math.min(1, Math.max(0, request.settings.soundLevel));
        const voice = selectVoiceForLocale(synthesis.getVoices(), segment.locale);
        if (voice) {
          utterance.voice = voice;
        }

        const isCurrentAttempt = (): boolean => !settled && attempt === currentAttempt;
        request.cancelCurrent = () => {
          request.retryCurrent = null;
          attempt += 1;
          clearGuard();
          synthesis.cancel();
          finish(request.cancelledAs ?? 'cancelled');
        };
        request.retryCurrent = () => {
          if (!isCurrentAttempt() || started || request.cancelledAs) {
            return;
          }

          synthesis.resume();
          if (synthesis.speaking) {
            return;
          }

          attempt += 1;
          clearGuard();
          if (synthesis.pending) {
            synthesis.cancel();
          }
          speakAttempt();
        };
        utterance.onstart = () => {
          if (!isCurrentAttempt()) {
            return;
          }
          started = true;
          request.retryCurrent = null;
          this.activeCue = segment.cue ?? null;
          this.notify();
        };
        utterance.onend = () => {
          if (isCurrentAttempt()) {
            finish(request.cancelledAs ?? 'completed');
          }
        };
        utterance.onerror = (event) => {
          if (!isCurrentAttempt()) {
            return;
          }
          const cancelled = event.error === 'canceled' || event.error === 'interrupted';
          finish(cancelled ? (request.cancelledAs ?? 'cancelled') : 'error');
        };

        const guardMs = Math.max(UTTERANCE_GUARD_BASE_MS, segment.text.length * 450);
        guard = window.setTimeout(() => {
          if (!isCurrentAttempt() || !started) {
            return;
          }
          attempt += 1;
          synthesis.cancel();
          finish('timed-out');
        }, guardMs);

        synthesis.resume();
        try {
          synthesis.speak(utterance);
        } catch {
          finish('error');
        }
      };

      speakAttempt();
    });
  }

  private async runRequest(request: QueuedSpeechRequest): Promise<SpeechResultStatus> {
    await this.waitForVoices();
    if (request.cancelledAs) {
      return request.cancelledAs;
    }

    for (const segment of request.segments) {
      if (request.cancelledAs) {
        return request.cancelledAs;
      }
      const utteranceStatus = await this.speakUtterance(segment, request);
      if (utteranceStatus !== 'completed') {
        return utteranceStatus;
      }
      const pauseStatus = await this.wait(segment.pauseAfterMs ?? 0, request);
      if (pauseStatus !== 'completed') {
        return pauseStatus;
      }
      if (request.cancelledAs) {
        return request.cancelledAs;
      }
    }
    return 'completed';
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.activationState !== 'ready') {
      return;
    }
    this.processing = true;
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      this.active = request;
      this.notify();
      const status = await this.runRequest(request);
      this.settleQueued(request, status);
      this.active = null;
      this.notify();
    }
    this.processing = false;
  }

  speakSegments(
    segments: SpeechSegment[],
    settings: ToddlerSettings,
    options?: SpeechRequestOptions,
  ): Promise<SpeechResult> {
    return this.enqueue(segments, settings, options);
  }

  speakSuccessSequence(
    targetSegments: SpeechSegment[],
    praiseSegments: SpeechSegment[],
    settings: ToddlerSettings,
    options?: Omit<SpeechRequestOptions, 'priority'>,
  ): Promise<SpeechResult> {
    const scope = options?.scope ?? 'app';
    this.removeQueued((request) => request.scope === scope && request.priority !== 'success');
    if (this.active?.scope === scope && this.active.staleAfterSuccess) {
      if (this.active.priority === 'retry') {
        // A new attempt may make the remaining retry stale, but the word
        // already being pronounced must reach its natural boundary.
        this.active.cancelledAs = 'superseded';
      } else {
        this.interruptActive('superseded');
      }
    }

    const segments = [...targetSegments, ...praiseSegments];
    const targetEndIndex = targetSegments.length - 1;
    if (targetEndIndex >= 0 && praiseSegments.length > 0) {
      segments[targetEndIndex] = { ...segments[targetEndIndex]!, pauseAfterMs: 280 };
    }
    return this.enqueue(segments, settings, { ...options, priority: 'success' });
  }

  speakRetrySequence(
    modelSegments: SpeechSegment[],
    encouragementSegments: SpeechSegment[],
    settings: ToddlerSettings,
    options?: Omit<SpeechRequestOptions, 'priority'>,
  ): Promise<SpeechResult> {
    this.supersedeRetry(options?.scope ?? 'app');
    const segments = [...modelSegments, ...encouragementSegments];
    const modelEndIndex = modelSegments.length - 1;
    if (modelEndIndex >= 0 && encouragementSegments.length > 0) {
      segments[modelEndIndex] = { ...segments[modelEndIndex]!, pauseAfterMs: 260 };
    }
    return this.enqueue(segments, settings, {
      ...options,
      key: options?.key ?? 'retry',
      priority: 'retry',
      staleAfterSuccess: true,
    });
  }

  speakConcept(
    concept: LearningConcept,
    settings: ToddlerSettings,
    options?: SpeechRequestOptions,
  ): Promise<SpeechResult> {
    const segments = buildConceptSegments(concept, settings.languageMode, settings.englishVoiceLocale);
    return this.speakSegments(segments, settings, options);
  }
}

export function buildConceptSegments(
  concept: LearningConcept,
  mode: ToddlerSettings['languageMode'],
  englishVoiceLocale: EnglishVoiceLocale,
): SpeechSegment[] {
  if (mode === 'en') {
    return [{ text: concept.en, locale: englishVoiceLocale }];
  }
  if (mode === 'bilingual') {
    return [
      { text: concept.he, locale: 'he-IL', pauseAfterMs: 220 },
      { text: concept.en, locale: englishVoiceLocale },
    ];
  }
  return [{ text: concept.he, locale: 'he-IL' }];
}

export function buildPhraseSegments(
  he: string,
  en: string,
  mode: ToddlerSettings['languageMode'],
  englishVoiceLocale: EnglishVoiceLocale,
): SpeechSegment[] {
  if (mode === 'en') {
    return [{ text: en, locale: englishVoiceLocale }];
  }
  if (mode === 'bilingual') {
    return [
      { text: he, locale: 'he-IL', pauseAfterMs: 220 },
      { text: en, locale: englishVoiceLocale },
    ];
  }
  return [{ text: he, locale: 'he-IL' }];
}

export interface LocalizedSpeechLine {
  he: string;
  en: string;
  pauseAfterMs?: number;
  cue?: string;
}

export function buildLocalizedSegments(
  lines: readonly LocalizedSpeechLine[],
  mode: ToddlerSettings['languageMode'],
  englishVoiceLocale: EnglishVoiceLocale,
): SpeechSegment[] {
  return lines.flatMap((line) => {
    const segments = buildPhraseSegments(line.he, line.en, mode, englishVoiceLocale);
    return segments.map((segment, index) => ({
      ...segment,
      ...(line.cue === undefined ? {} : { cue: line.cue }),
      ...(index === segments.length - 1 && line.pauseAfterMs !== undefined
        ? { pauseAfterMs: line.pauseAfterMs }
        : {}),
    }));
  });
}

export const speechService = new SpeechService();
