import { describe, expect, it } from 'vitest';
import { requireLearningConcept } from '../content/concepts';
import { requireWordStretchWord } from '../content/wordStretch';
import { createInitialSettings } from '../domain/progression';
import {
  buildWordStretchSegments,
  WORD_STRETCH_CUE_PREFIX,
  WORD_STRETCH_PLAYBACK_RATE,
} from './wordStretchSpeech';

describe('word stretch speech', () => {
  it('uses expressive text for browser speech and the base word for recorded lookup', () => {
    const word = requireWordStretchWord('dog');
    const concept = requireLearningConcept('dog');
    const settings = createInitialSettings();

    expect(buildWordStretchSegments(word, concept, settings)).toEqual([{
      text: word.stretchedHe,
      recordedText: concept.he,
      locale: 'he-IL',
      cue: `${WORD_STRETCH_CUE_PREFIX}dog`,
      stretch: {
        leadSeconds: word.leadSeconds,
        playbackRate: WORD_STRETCH_PLAYBACK_RATE,
      },
    }]);
  });

  it('keeps the same live cue across both bilingual pronunciations', () => {
    const word = requireWordStretchWord('cat');
    const concept = requireLearningConcept('cat');
    const settings = {
      ...createInitialSettings(),
      languageMode: 'bilingual' as const,
      englishVoiceLocale: 'en-GB' as const,
    };

    const segments = buildWordStretchSegments(word, concept, settings);
    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.cue)).toEqual([
      `${WORD_STRETCH_CUE_PREFIX}cat`,
      `${WORD_STRETCH_CUE_PREFIX}cat`,
    ]);
    expect(segments[0]).toMatchObject({
      recordedText: concept.he,
      locale: 'he-IL',
      pauseAfterMs: 220,
    });
    expect(segments[1]).toMatchObject({
      recordedText: concept.en,
      locale: 'en-GB',
    });
  });
});
