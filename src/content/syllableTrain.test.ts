import { describe, expect, it } from 'vitest';
import { createInitialSettings } from '../domain/progression';
import { requireLearningConcept } from './concepts';
import {
  SYLLABLE_TRAIN_WORDS,
  WORD_TRAIN_CONCEPT_IDS,
  WORD_TRAIN_CONTENT_VERSION,
  WORD_TRAIN_LOCALES,
  WordTrainRoundLocaleLock,
} from './syllableTrain';

describe('whole-word Train V2 content', () => {
  it('contains exactly the ten approved existing concepts', () => {
    expect(WORD_TRAIN_CONCEPT_IDS).toEqual([
      'ball',
      'apple',
      'cat',
      'dog',
      'orange',
      'carrot',
      'airplane',
      'flower',
      'car',
      'shoe',
    ]);
    expect(SYLLABLE_TRAIN_WORDS.map((word) => word.conceptId))
      .toEqual(WORD_TRAIN_CONCEPT_IDS);
  });

  it('maps every locale to an existing complete-word recording and concept image', () => {
    expect(WORD_TRAIN_LOCALES).toEqual(['he-IL', 'en-US', 'en-GB']);
    for (const word of SYLLABLE_TRAIN_WORDS) {
      const concept = requireLearningConcept(word.conceptId);
      expect(word.contentVersion).toBe(WORD_TRAIN_CONTENT_VERSION);
      expect(word.image).toBe(concept.image);
      expect(word.recordings).toEqual({
        'he-IL': concept.he,
        'en-US': concept.en,
        'en-GB': concept.en,
      });
      expect(Object.keys(word).sort()).toEqual([
        'conceptId',
        'contentVersion',
        'image',
        'recordings',
      ]);
    }
  });

  it('locks one exact locale for a train and applies settings on the next train', () => {
    const controller = new WordTrainRoundLocaleLock();
    const settings = createInitialSettings();
    const enUs = {
      ...settings,
      languageMode: 'en' as const,
      englishVoiceLocale: 'en-US' as const,
    };
    const enGb = {
      ...settings,
      languageMode: 'en' as const,
      englishVoiceLocale: 'en-GB' as const,
    };

    expect(controller.forRound('train-1', enUs)).toBe('en-US');
    expect(controller.forRound('train-1', enGb)).toBe('en-US');
    expect(controller.forRound('train-2', enGb)).toBe('en-GB');
  });
});
