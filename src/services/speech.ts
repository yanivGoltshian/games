import type { EnglishVoiceLocale, LearningConcept, SpeechLocale, ToddlerSettings } from '../domain/types';

export interface SpeechSegment {
  text: string;
  locale: SpeechLocale;
}

export interface SpeechStatus {
  supported: boolean;
  voiceAvailable: boolean;
}

/**
 * V1 speech seam: every call ultimately routes through `speakSegments`.
 * When a concept has a recorded `audio` file for the active locale this is
 * the single place that would swap SpeechSynthesis for an <audio> element,
 * so callers (games, praise, prompts) never need to change.
 */
class SpeechService {
  private subscribers = new Set<(status: SpeechStatus) => void>();
  private pendingTimer: number | null = null;
  private isUnlocked = false;
  /**
   * Incremented on every cancel/new speak call. Any in-flight async speech
   * chain checks its captured generation before continuing so a stale
   * sequence can never resume after the user has moved on (prevents
   * mixed/overlapping speech across rounds or rapid repeat taps).
   */
  private generation = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', this.handleVoicesChanged);
      window.setTimeout(this.handleVoicesChanged, 120);
    }
  }

  private handleVoicesChanged = (): void => {
    const status = this.getStatus();
    this.subscribers.forEach((subscriber) => subscriber(status));
  };

  getStatus(): SpeechStatus {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    const voices = supported ? window.speechSynthesis.getVoices() : [];
    return {
      supported,
      voiceAvailable: voices.length > 0,
    };
  }

  subscribe(callback: (status: SpeechStatus) => void): () => void {
    this.subscribers.add(callback);
    callback(this.getStatus());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  unlock(): void {
    if (this.isUnlocked || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    this.isUnlocked = true;
    try {
      const utterance = new SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.cancel();
    } catch {
      this.isUnlocked = false;
    }
  }

  /** Bumps the generation token and stops any speech in flight. Safe to call anytime. */
  cancel(): void {
    this.generation += 1;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (this.pendingTimer !== null) {
      window.clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    window.speechSynthesis.cancel();
  }

  private pickVoice(locale: SpeechLocale): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return null;
    }

    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((voice) => voice.lang === locale)
      ?? voices.find((voice) => voice.lang.startsWith(locale.split('-')[0]!))
      ?? null
    );
  }

  private runSegments(segments: SpeechSegment[], settings: ToddlerSettings, generation: number): Promise<boolean> {
    return new Promise((resolve) => {
      let index = 0;
      const speakNext = (): void => {
        if (generation !== this.generation) {
          resolve(false);
          return;
        }

        const segment = segments[index];
        if (!segment) {
          resolve(true);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.lang = segment.locale;
        utterance.rate = segment.locale === 'he-IL' ? 0.78 : 0.82;
        utterance.pitch = 1;
        utterance.volume = Math.min(1, Math.max(0, settings.soundLevel));
        const voice = this.pickVoice(segment.locale);
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onend = () => {
          if (generation !== this.generation) {
            resolve(false);
            return;
          }
          index += 1;
          this.pendingTimer = window.setTimeout(speakNext, 140);
        };
        utterance.onerror = () => resolve(false);
        window.speechSynthesis.speak(utterance);
      };

      this.pendingTimer = window.setTimeout(speakNext, 60);
    });
  }

  /**
   * Speaks a sequence of segments, cancelling anything already in flight
   * first. Returns false immediately (without speaking) in quiet mode or
   * when speech is unsupported.
   */
  async speakSegments(segments: SpeechSegment[], settings: ToddlerSettings): Promise<boolean> {
    if (settings.quietMode || segments.length === 0) {
      return false;
    }

    const status = this.getStatus();
    if (!status.supported) {
      return false;
    }

    this.cancel();
    this.unlock();
    const generation = this.generation;
    return this.runSegments(segments, settings, generation);
  }

  /**
   * Target-then-praise sequencing: speaks the answer/target segments to
   * completion first, then the praise segments, as one cancellation-safe
   * chain. If the round changes mid-sequence (generation bump), the praise
   * half is skipped rather than talking over the new round.
   */
  async speakSuccessSequence(
    targetSegments: SpeechSegment[],
    praiseSegments: SpeechSegment[],
    settings: ToddlerSettings,
  ): Promise<boolean> {
    if (settings.quietMode) {
      return false;
    }

    const status = this.getStatus();
    if (!status.supported) {
      return false;
    }

    this.cancel();
    this.unlock();
    const generation = this.generation;

    if (targetSegments.length > 0) {
      const targetOk = await this.runSegments(targetSegments, settings, generation);
      if (!targetOk || generation !== this.generation) {
        return false;
      }
    }

    if (praiseSegments.length === 0) {
      return true;
    }

    return this.runSegments(praiseSegments, settings, generation);
  }

  speakConcept(concept: LearningConcept, settings: ToddlerSettings): Promise<boolean> {
    const segments = buildConceptSegments(concept, settings.languageMode, settings.englishVoiceLocale);
    return this.speakSegments(segments, settings);
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
      { text: concept.he, locale: 'he-IL' },
      { text: concept.en, locale: englishVoiceLocale },
    ];
  }
  return [{ text: concept.he, locale: 'he-IL' }];
}

/** Builds locale-appropriate segments for any short phrase pair (prompts, answers, praise). */
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
      { text: he, locale: 'he-IL' },
      { text: en, locale: englishVoiceLocale },
    ];
  }
  return [{ text: he, locale: 'he-IL' }];
}

export const speechService = new SpeechService();
