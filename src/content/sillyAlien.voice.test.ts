import { describe, expect, it } from 'vitest';
import type { SpeechSegment } from '../services/speech';
import {
  buildLocalizedSegments,
  buildPersonalizedPhraseSegments,
  buildPhraseSegments,
} from '../services/speech';
import { NARRATION_VOICE_PROFILES } from '../domain/narrationVoice';
import { createInitialSettings } from '../domain/progression';
import type { ToddlerSettings } from '../domain/types';
import {
  SILLY_ALIEN_PROMPT,
  SILLY_ALIEN_RETRY,
  SILLY_ALIEN_WORDS,
} from './sillyAlien';

/**
 * Voice-routing regression for the Silly Alien game.
 *
 * Acceptance criterion: the app's approved *child* narration voice must remain
 * the default. Every new English prompt and broken-word / full-word sequence
 * the game speaks has to flow through the existing default child-voice routing —
 * it must never hardcode or select an adult English voice. Hebrew must keep the
 * currently approved voice (there is no verified child Hebrew voice in the repo).
 *
 * These tests exercise the *exact* segment builders the game calls at every
 * spoken site (see SillyAlienGame.tsx: presenting / repeat / nudge / success
 * reveal / parent fallback) so that if anyone ever introduces a voice-selection
 * path or an adult English locale here, this fails.
 */

/** Mirror of every segment the game can speak for a single word, in one mode. */
function collectGameSegments(
  settings: ToddlerSettings,
  word: (typeof SILLY_ALIEN_WORDS)[number],
): SpeechSegment[] {
  return [
    // presenting / repeat / parent fallback: broken word + personalized prompt.
    ...buildLocalizedSegments(
      [{ he: word.brokenHe, en: word.brokenEn, pauseAfterMs: 420 }],
      settings.languageMode,
      settings.englishVoiceLocale,
    ),
    ...buildPersonalizedPhraseSegments(SILLY_ALIEN_PROMPT, settings),
    // nudge: broken word again + gentle retry line.
    ...buildLocalizedSegments(
      [
        { he: word.brokenHe, en: word.brokenEn, pauseAfterMs: 360 },
        SILLY_ALIEN_RETRY,
      ],
      settings.languageMode,
      settings.englishVoiceLocale,
    ),
    // success: the full word snaps back and is modeled clearly.
    ...buildPhraseSegments(
      word.he,
      word.en,
      settings.languageMode,
      settings.englishVoiceLocale,
    ),
  ];
}

const englishSegments = (segments: readonly SpeechSegment[]): SpeechSegment[] =>
  segments.filter((segment) => segment.locale !== 'he-IL');

const hebrewSegments = (segments: readonly SpeechSegment[]): SpeechSegment[] =>
  segments.filter((segment) => segment.locale === 'he-IL');

describe('Silly Alien narration voice routing', () => {
  it('speaks every English prompt and broken/full word with the approved child voice by default', () => {
    const settings = createInitialSettings();
    expect(settings.englishVoiceLocale).toBe('en-US');

    const spoken = SILLY_ALIEN_WORDS.flatMap((word) =>
      collectGameSegments({ ...settings, languageMode: 'bilingual' }, word),
    );
    const english = englishSegments(spoken);
    expect(english.length).toBeGreaterThan(0);

    for (const segment of english) {
      const profile = NARRATION_VOICE_PROFILES[segment.locale];
      expect(profile).toBeDefined();
      // The whole point of the criterion: never an adult English voice.
      expect(profile.classification).toBe('child');
    }
    // Default English locale resolves to the approved US child voice (Ana).
    expect(NARRATION_VOICE_PROFILES[settings.englishVoiceLocale].azureName).toBe(
      'en-US-AnaNeural',
    );
  });

  it('keeps the approved child voice when the parent picks the UK English voice', () => {
    const settings: ToddlerSettings = {
      ...createInitialSettings(),
      englishVoiceLocale: 'en-GB',
      languageMode: 'en',
    };

    const spoken = SILLY_ALIEN_WORDS.flatMap((word) =>
      collectGameSegments(settings, word),
    );
    const english = englishSegments(spoken);
    expect(english.length).toBeGreaterThan(0);
    expect(english.every((segment) => segment.locale === 'en-GB')).toBe(true);

    for (const segment of english) {
      expect(NARRATION_VOICE_PROFILES[segment.locale].classification).toBe('child');
    }
    expect(NARRATION_VOICE_PROFILES['en-GB'].azureName).toBe('en-GB-MaisieNeural');
  });

  it('never emits an adult English narration segment in any language mode', () => {
    const modes: ToddlerSettings['languageMode'][] = ['he', 'en', 'bilingual'];
    const locales = ['en-US', 'en-GB'] as const;

    for (const languageMode of modes) {
      for (const englishVoiceLocale of locales) {
        const settings: ToddlerSettings = {
          ...createInitialSettings(),
          languageMode,
          englishVoiceLocale,
        };
        const spoken = SILLY_ALIEN_WORDS.flatMap((word) =>
          collectGameSegments(settings, word),
        );
        const adultEnglish = englishSegments(spoken).filter(
          (segment) => NARRATION_VOICE_PROFILES[segment.locale].classification === 'adult',
        );
        expect(adultEnglish).toEqual([]);
      }
    }
  });

  it('preserves the approved Hebrew narration voice (no verified child Hebrew voice exists)', () => {
    const settings: ToddlerSettings = {
      ...createInitialSettings(),
      languageMode: 'bilingual',
    };

    const spoken = SILLY_ALIEN_WORDS.flatMap((word) =>
      collectGameSegments(settings, word),
    );
    const hebrew = hebrewSegments(spoken);
    expect(hebrew.length).toBeGreaterThan(0);
    expect(hebrew.every((segment) => segment.locale === 'he-IL')).toBe(true);

    // The one approved Hebrew profile is preserved exactly — Silly Alien did not
    // introduce or swap in a different Hebrew voice.
    expect(NARRATION_VOICE_PROFILES['he-IL'].azureName).toBe('he-IL-HilaNeural');
    // There is intentionally no verified child Hebrew voice to switch to.
    expect(NARRATION_VOICE_PROFILES['he-IL'].classification).toBe('adult');
  });
});
