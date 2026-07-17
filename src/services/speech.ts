import type { EnglishVoiceLocale, LearningConcept, SpeechLocale, ToddlerSettings } from '../domain/types';
import { HEBREW_UNLOCK_PRIMER } from '../content/hebrewPronunciation';
import {
  childGreeting,
  isDefaultChildName,
  personalizeChildName,
} from '../domain/childName';
import { NARRATION_VOICE_PROFILES } from '../domain/narrationVoice';
import {
  recordedSpeechPlayer,
  type RecordedSpeechBackend,
  type RecordedSpeechStretch,
} from './recordedSpeech';

export interface SpeechSegment {
  text: string;
  locale: SpeechLocale;
  recordedText?: string | null;
  pauseAfterMs?: number;
  cue?: string;
  recordedText?: string;
  stretch?: RecordedSpeechStretch;
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
  'he-IL': NARRATION_VOICE_PROFILES['he-IL'].webSpeechNameHints,
  'en-US': NARRATION_VOICE_PROFILES['en-US'].webSpeechNameHints,
  'en-GB': NARRATION_VOICE_PROFILES['en-GB'].webSpeechNameHints,
};

const UTTERANCE_GUARD_BASE_MS = 8_000;
const UTTERANCE_PRESTART_GUARD_MS = 4_000;
const PRIMER_PRESTART_FALLBACK_MS = 350;
const CONTENTLESS_SPEECH_CHARACTERS = /[\s\u200B-\u200D\u2060\uFEFF]/gu;

function hasSpokenContent(text: string): boolean {
  return text.replace(CONTENTLESS_SPEECH_CHARACTERS, '').length > 0;
}

function buildUnlockPrimer(settings: ToddlerSettings): SpeechSegment {
  if (settings.languageMode === 'en') {
    return {
      text: childGreeting(settings.childName, 'en'),
      locale: settings.englishVoiceLocale,
    };
  }
  if (!isDefaultChildName(settings.childName)) {
    return {
      text: childGreeting(settings.childName, 'he'),
      locale: 'he-IL',
    };
  }
  return { text: HEBREW_UNLOCK_PRIMER.spokenText, locale: 'he-IL' };
}

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
  private activationAttempt = 0;
  private cancelPrimerCurrent: (() => void) | null = null;
  private primerPrestartGuard: number | null = null;
  private primerFallbackElapsed = false;
  private primerSpeaking = false;
  private primerGuard: number | null = null;
  private primerTerminalMissing = false;
  private gestureActivationAvailable = false;
  private gestureActivationEpoch = 0;
  private handoffSource: QueuedSpeechRequest | null = null;
  private nextRequestId = 1;
  private nextOrder = 1;
  private activeCue: string | null = null;

  constructor(private readonly recordedSpeech: RecordedSpeechBackend = recordedSpeechPlayer) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', this.handleVoicesChanged);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
      }
      window.addEventListener('pagehide', this.handlePageHide);
    }
  }

  private handleVoicesChanged = (): void => {
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
    return this.recordedSpeech.isEnabled()
      || (typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  }

  getStatus(): SpeechStatus {
    const supported = this.isSupported();
    const recorded = this.recordedSpeech.isEnabled();
    const voices = supported && !recorded ? window.speechSynthesis.getVoices() : [];
    return {
      supported,
      voiceAvailable: recorded || voices.length > 0,
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
    const cancelStartedPrimer = (this.primerSpeaking || this.primerTerminalMissing)
      && typeof window !== 'undefined'
      && 'speechSynthesis' in window;
    if (this.cancelPrimerCurrent) {
      this.cancelPrimerCurrent();
    } else {
      this.activationAttempt += 1;
    }
    if (this.primerGuard !== null) {
      window.clearTimeout(this.primerGuard);
      this.primerGuard = null;
    }
    this.clearPrimerPrestartGuard();
    this.primerFallbackElapsed = false;
    this.primerSpeaking = false;
    this.primerTerminalMissing = false;
    if (cancelStartedPrimer) {
      window.speechSynthesis.cancel();
    }
    this.gestureActivationAvailable = false;
    this.handoffSource = null;
    this.activationState = 'locked';
  }

  private clearPrimerPrestartGuard(): void {
    if (this.primerPrestartGuard !== null) {
      window.clearTimeout(this.primerPrestartGuard);
      this.primerPrestartGuard = null;
    }
  }

  private createUtterance(segment: SpeechSegment, settings: ToddlerSettings): SpeechSynthesisUtterance {
    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = segment.locale;
    utterance.rate = speechRateForLocale(segment.locale);
    utterance.pitch = 1;
    utterance.volume = Math.min(1, Math.max(0, settings.soundLevel));
    const voice = selectVoiceForLocale(synthesis.getVoices(), segment.locale);
    if (voice) {
      utterance.voice = voice;
    }
    return utterance;
  }

  private primeSpeechEngine(settings: ToddlerSettings): void {
    const synthesis = window.speechSynthesis;
    const attempt = ++this.activationAttempt;
    this.activationState = 'priming';
    const utterance = this.createUtterance(buildUnlockPrimer(settings), settings);
    let started = false;
    const clearCancelPrimer = (): void => {
      if (this.cancelPrimerCurrent === cancelPrimer) {
        this.cancelPrimerCurrent = null;
      }
    };
    const cancelPrimer = (): void => {
      if (attempt !== this.activationAttempt || started) {
        return;
      }
      this.activationAttempt += 1;
      this.clearPrimerPrestartGuard();
      this.primerFallbackElapsed = false;
      this.cancelPrimerCurrent = null;
      this.activationState = 'locked';
      synthesis.cancel();
    };
    this.cancelPrimerCurrent = cancelPrimer;

    const markReady = (): void => {
      if (attempt !== this.activationAttempt || this.activationState !== 'priming') {
        return;
      }
      started = true;
      this.clearPrimerPrestartGuard();
      this.primerFallbackElapsed = false;
      this.primerSpeaking = true;
      this.primerTerminalMissing = false;
      clearCancelPrimer();
      this.activationState = 'ready';
      this.notify();
    };
    const clearPrimerGuard = (): void => {
      if (this.primerGuard !== null) {
        window.clearTimeout(this.primerGuard);
        this.primerGuard = null;
      }
    };
    utterance.onstart = () => {
      markReady();
      if (!started || attempt !== this.activationAttempt) {
        return;
      }

      const guardMs = Math.max(UTTERANCE_GUARD_BASE_MS, utterance.text.length * 450);
      this.primerGuard = window.setTimeout(() => {
        if (attempt !== this.activationAttempt || !this.primerSpeaking) {
          return;
        }
        this.primerGuard = null;
        this.primerSpeaking = false;
        if (synthesis.speaking || synthesis.pending) {
          this.primerTerminalMissing = true;
          return;
        }
        void this.processQueue();
      }, guardMs);
    };
    utterance.onend = () => {
      if (attempt !== this.activationAttempt) {
        return;
      }
      clearPrimerGuard();
      this.clearPrimerPrestartGuard();
      this.primerFallbackElapsed = false;
      this.primerSpeaking = false;
      this.primerTerminalMissing = false;
      if (started) {
        void this.processQueue();
        return;
      }
      clearCancelPrimer();
      this.activationState = 'locked';
      this.notify();
    };
    utterance.onerror = () => {
      if (attempt !== this.activationAttempt) {
        return;
      }
      clearPrimerGuard();
      this.clearPrimerPrestartGuard();
      this.primerFallbackElapsed = false;
      this.primerSpeaking = false;
      this.primerTerminalMissing = false;
      if (started) {
        void this.processQueue();
        return;
      }
      clearCancelPrimer();
      this.activationState = 'locked';
      this.notify();
    };

    try {
      synthesis.speak(utterance);
    } catch {
      if (attempt === this.activationAttempt) {
        clearPrimerGuard();
        this.clearPrimerPrestartGuard();
        this.primerFallbackElapsed = false;
        this.primerSpeaking = false;
        this.primerTerminalMissing = false;
        clearCancelPrimer();
        this.activationState = 'locked';
        this.notify();
      }
      return;
    }

    if (attempt === this.activationAttempt && !started && this.activationState === 'priming') {
      // The contentful speak call already ran inside activation. This fallback
      // advances liveness without claiming readiness; only a later onstart can.
      this.primerPrestartGuard = window.setTimeout(() => {
        if (attempt !== this.activationAttempt || started || this.activationState !== 'priming') {
          return;
        }
        this.primerPrestartGuard = null;
        this.primerFallbackElapsed = true;
        void this.processQueue();
      }, PRIMER_PRESTART_FALLBACK_MS);
    }
  }

  private markGestureActivation(): void {
    const epoch = ++this.gestureActivationEpoch;
    this.gestureActivationAvailable = true;
    queueMicrotask(() => {
      if (epoch !== this.gestureActivationEpoch) {
        return;
      }
      this.gestureActivationAvailable = false;
      this.handoffSource = null;
    });
  }

  private hasGestureActivation(): boolean {
    return this.gestureActivationAvailable
      || (typeof navigator !== 'undefined' && navigator.userActivation?.isActive === true);
  }

  /**
   * Must be called directly from a pointer or keyboard event. The first speak
   * call uses queued game speech when available, or a short localized greeting.
   * No promise, timer, effect, or microtask runs before that gesture-bound call.
   */
  unlock(settings: ToddlerSettings): void {
    if (settings.quietMode) {
      return;
    }

    if (this.recordedSpeech.isEnabled()) {
      if (this.activationState === 'priming') {
        return;
      }
      const wasReady = this.activationState === 'ready';
      if (!wasReady) {
        this.activationState = 'priming';
      }
      void this.recordedSpeech.unlock()
        .then(() => {
          this.activationState = 'ready';
          this.notify();
          void this.processQueue();
        })
        .catch(() => {
          this.activationState = 'locked';
          this.notify();
        });
      return;
    }

    if (!this.isSupported()) {
      return;
    }

    const synthesis = window.speechSynthesis;
    synthesis.resume();

    if (this.primerFallbackElapsed) {
      if (this.startQueuedRequestAfterPrimerFallback()) {
        this.markGestureActivation();
        return;
      }
      this.markGestureActivation();
      return;
    }

    if (this.primerTerminalMissing) {
      this.primerTerminalMissing = false;
      this.activationAttempt += 1;
      synthesis.cancel();
    }

    if (this.primerSpeaking) {
      if (synthesis.speaking || synthesis.pending) {
        this.markGestureActivation();
        return;
      }
      this.primerSpeaking = false;
    }

    if (this.active?.retryCurrent) {
      this.active.retryCurrent();
      this.markGestureActivation();
      return;
    }

    if (this.activationState === 'ready') {
      void this.processQueue();
      this.markGestureActivation();
      return;
    }

    if (this.cancelPrimerCurrent) {
      this.cancelPrimerCurrent();
    } else if (this.activationState === 'priming') {
      this.activationAttempt += 1;
      synthesis.cancel();
    }

    if (this.startQueuedRequestImmediately()) {
      this.markGestureActivation();
      return;
    }

    this.primeSpeechEngine(settings);
    this.markGestureActivation();
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

  private supersedeActiveRetryAtBoundary(): void {
    if (!this.active || this.active.priority !== 'retry') {
      return;
    }
    if (this.active.retryCurrent) {
      const source = this.active;
      const canHandoff = this.hasGestureActivation();
      this.interruptActive('superseded');
      if (canHandoff) {
        this.handoffSource = source;
      }
      return;
    }
    this.active.cancelledAs = 'superseded';
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
      this.supersedeActiveRetryAtBoundary();
    }
  }

  private enqueue(
    segments: SpeechSegment[],
    settings: ToddlerSettings,
    options: SpeechRequestOptions = {},
  ): Promise<SpeechResult> {
    const id = this.nextRequestId++;
    const spokenSegments = segments.filter((segment) => hasSpokenContent(segment.text));
    if (settings.quietMode || spokenSegments.length === 0) {
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
        segments: spokenSegments,
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

    if (!this.tryHandoffQueuedRequestFromGesture()) {
      void this.processQueue();
    }
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

  private speakUtterance(
    segment: SpeechSegment,
    request: QueuedSpeechRequest,
    onStart?: () => void,
  ): Promise<SpeechResultStatus> {
    let resolveResult: ((status: SpeechResultStatus) => void) | null = null;
    let settledStatus: SpeechResultStatus | null = null;
    let settled = false;
    let attempt = 0;
    let started = false;
    let prestartGuard: number | null = null;
    let terminalGuard: number | null = null;
    const clearPrestartGuard = (): void => {
      if (prestartGuard !== null) {
        window.clearTimeout(prestartGuard);
        prestartGuard = null;
      }
    };
    const clearTerminalGuard = (): void => {
      if (terminalGuard !== null) {
        window.clearTimeout(terminalGuard);
        terminalGuard = null;
      }
    };
    const clearGuards = (): void => {
      clearPrestartGuard();
      clearTerminalGuard();
    };
    const finish = (status: SpeechResultStatus): void => {
      if (settled) {
        return;
      }
      settled = true;
      attempt += 1;
      clearGuards();
      request.cancelCurrent = null;
      request.retryCurrent = null;
      if (this.activeCue === segment.cue) {
        this.activeCue = null;
        this.notify();
      }

      if (resolveResult) {
        resolveResult(status);
      } else {
        settledStatus = status;
      }
    };

    const speakAttempt = (): void => {
      if (settled || request.cancelledAs) {
        finish(request.cancelledAs ?? 'cancelled');
        return;
      }

      const synthesis = window.speechSynthesis;
      const currentAttempt = ++attempt;
      started = false;
      clearGuards();

      const utterance = this.createUtterance(segment, request.settings);
      const isCurrentAttempt = (): boolean => !settled && attempt === currentAttempt;
      request.cancelCurrent = () => {
        request.retryCurrent = null;
        attempt += 1;
        clearGuards();
        synthesis.cancel();
        finish(request.cancelledAs ?? 'cancelled');
      };
      request.retryCurrent = () => {
        if (!isCurrentAttempt() || started || request.cancelledAs) {
          return;
        }

        synthesis.resume();
        attempt += 1;
        clearGuards();
        if (synthesis.speaking || synthesis.pending) {
          synthesis.cancel();
        }
        speakAttempt();
      };
      utterance.onstart = () => {
        if (!isCurrentAttempt()) {
          return;
        }
        started = true;
        clearPrestartGuard();
        request.retryCurrent = null;
        onStart?.();
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

      synthesis.resume();
      try {
        synthesis.speak(utterance);
      } catch {
        finish('error');
      }

      if (!settled) {
        if (!started) {
          prestartGuard = window.setTimeout(() => {
            if (!isCurrentAttempt() || started) {
              return;
            }
            // Do not cancel: WebKit may have started audible speech without
            // delivering onstart. Settling prevents a permanently stuck queue.
            finish('timed-out');
          }, UTTERANCE_PRESTART_GUARD_MS);
        }
        const guardMs = Math.max(UTTERANCE_GUARD_BASE_MS, segment.text.length * 450);
        terminalGuard = window.setTimeout(() => {
          if (!isCurrentAttempt() || !started) {
            return;
          }
          attempt += 1;
          synthesis.cancel();
          finish('timed-out');
        }, guardMs);
      }
    };

    speakAttempt();
    return new Promise((resolve) => {
      resolveResult = resolve;
      if (settledStatus !== null) {
        resolve(settledStatus);
      }
    });
  }

  private speakRecording(segment: SpeechSegment, request: QueuedSpeechRequest): Promise<SpeechResultStatus> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (status: SpeechResultStatus): void => {
        if (settled) {
          return;
        }
        settled = true;
        request.cancelCurrent = null;
        if (this.activeCue === segment.cue) {
          this.activeCue = null;
          this.notify();
        }
        resolve(status);
      };

      request.cancelCurrent = () => {
        this.recordedSpeech.cancel();
        finish(request.cancelledAs ?? 'cancelled');
      };
      void this.recordedSpeech.play({
        text: segment.recordedText ?? segment.text,
        locale: segment.locale,
        volume: request.settings.soundLevel,
        onStart: () => {
          if (settled || request.cancelledAs) {
            return;
          }
          this.activeCue = segment.cue ?? null;
          this.notify();
        },
        ...(segment.stretch ? { stretch: segment.stretch } : {}),
      }).then(
        () => finish(request.cancelledAs ?? 'completed'),
        () => finish(request.cancelledAs ?? 'error'),
      );
    });
  }

  private async runRequest(
    request: QueuedSpeechRequest,
    firstUtterance?: Promise<SpeechResultStatus>,
  ): Promise<SpeechResultStatus> {
    for (const [index, segment] of request.segments.entries()) {
      if (request.cancelledAs) {
        return request.cancelledAs;
      }
      const recorded = this.recordedSpeech.isEnabled();
      const utteranceStatus = recorded
        ? segment.recordedText === null
          ? 'completed'
          : await this.speakRecording(segment, request)
        : await (
          index === 0 && firstUtterance
            ? firstUtterance
            : this.speakUtterance(segment, request)
        );
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

  private startQueuedRequestImmediately(replaceActive = false): boolean {
    if ((!replaceActive && this.processing) || this.queue.length === 0) {
      return false;
    }

    const request = this.queue.shift()!;
    const attempt = ++this.activationAttempt;
    this.activationState = 'priming';
    this.processing = true;
    this.active = request;

    const firstUtterance = this.speakUtterance(request.segments[0]!, request, () => {
      if (attempt !== this.activationAttempt || this.activationState !== 'priming') {
        return;
      }
      this.activationState = 'ready';
      this.notify();
    });

    this.notify();
    void this.finishRequest(request, this.runRequest(request, firstUtterance), attempt);
    return true;
  }

  private startQueuedRequestAfterPrimerFallback(): boolean {
    if (
      !this.primerFallbackElapsed
      || this.processing
      || this.activationState !== 'priming'
      || this.queue.length === 0
    ) {
      return false;
    }

    this.primerFallbackElapsed = false;
    this.cancelPrimerCurrent = null;
    return this.startQueuedRequestImmediately();
  }

  private tryHandoffQueuedRequestFromGesture(): boolean {
    const source = this.handoffSource;
    if (
      !source
      || this.active !== source
      || !this.hasGestureActivation()
      || this.queue.length === 0
    ) {
      return false;
    }

    this.handoffSource = null;
    return this.startQueuedRequestImmediately(true);
  }

  private async finishRequest(
    request: QueuedSpeechRequest,
    result: Promise<SpeechResultStatus>,
    activationAttempt?: number,
  ): Promise<void> {
    const status = await result;
    this.settleQueued(request, status);
    if (this.handoffSource === request) {
      this.handoffSource = null;
    }
    if (this.active !== request) {
      return;
    }
    this.active = null;
    this.processing = false;
    if (
      activationAttempt === this.activationAttempt
      && this.activationState === 'priming'
    ) {
      this.activationState = 'locked';
    }
    this.notify();
    void this.processQueue();
  }

  private processQueue(): void {
    if (this.startQueuedRequestAfterPrimerFallback()) {
      return;
    }
    if (
      this.processing
      || this.primerSpeaking
      || this.primerTerminalMissing
      || this.activationState !== 'ready'
      || this.queue.length === 0
    ) {
      return;
    }
    const request = this.queue.shift()!;
    this.processing = true;
    this.active = request;
    this.notify();
    void this.finishRequest(request, this.runRequest(request));
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
        this.supersedeActiveRetryAtBoundary();
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

export interface PersonalizedSpeechLine {
  he: string;
  en: string;
  recordedFallbackHe?: string;
  recordedFallbackEn?: string;
  recordedFallbackMode?: 'custom-name' | 'always';
}

const DEFAULT_RECORDED_PERSONALIZATION_FALLBACK = {
  he: 'יופי!',
  en: 'Great!',
} as const;

export function buildPersonalizedPhraseSegments(
  line: PersonalizedSpeechLine,
  settings: ToddlerSettings,
): SpeechSegment[] {
  const customName = !isDefaultChildName(settings.childName);
  const alwaysUseRecordedFallback = line.recordedFallbackMode === 'always';
  const he = personalizeChildName(line.he, settings.childName, 'he');
  const en = personalizeChildName(line.en, settings.childName, 'en');
  const segments = buildPhraseSegments(
    he,
    en,
    settings.languageMode,
    settings.englishVoiceLocale,
  );

  if (!customName && !alwaysUseRecordedFallback) {
    return segments;
  }

  return segments.map((segment) => {
    const language = segment.locale === 'he-IL' ? 'he' : 'en';
    const source = language === 'he' ? line.he : line.en;
    const personalized = language === 'he' ? he : en;
    if (source === personalized && !alwaysUseRecordedFallback) {
      return segment;
    }
    const recordedText = language === 'he'
      ? (line.recordedFallbackHe ?? DEFAULT_RECORDED_PERSONALIZATION_FALLBACK.he)
      : (line.recordedFallbackEn ?? DEFAULT_RECORDED_PERSONALIZATION_FALLBACK.en);
    return { ...segment, recordedText };
  });
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
