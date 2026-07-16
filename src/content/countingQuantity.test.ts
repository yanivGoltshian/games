import { describe, expect, it } from 'vitest';
import { learningConcepts } from './concepts';
import {
  getHebrewPronunciationSkeleton,
  hasNiqqud,
  stripNiqqud,
} from './hebrewPronunciation';
import {
  COUNTING_QUANTITY_FORMS,
  SUPPORTED_COUNTING_CONCEPT_IDS,
  SUPPORTED_COUNTING_COUNTS,
  countingConceptQuantityCoverage,
  getCountAloudWord,
  getCountingQuestion,
  getCountingQuantityPhrase,
} from './countingQuantity';

const EXPECTED_COUNTING_IDS = [
  'apple',
  'ball',
  'banana',
  'duck',
  'rabbit',
  'elephant',
  'strawberry',
  'orange',
  'carrot',
  'cup',
  'spoon',
  'chair',
  'bus',
  'train',
  'airplane',
  'flower',
  'tree',
] as const;

describe('counting quantity wording', () => {
  it('covers every semantically countable concept in stable progression order', () => {
    expect(SUPPORTED_COUNTING_CONCEPT_IDS).toEqual(EXPECTED_COUNTING_IDS);
    expect(countingConceptQuantityCoverage()).toEqual(EXPECTED_COUNTING_IDS);
    expect(learningConcepts.filter((concept) => concept.quantity !== null).map((concept) => concept.id))
      .toEqual(expect.arrayContaining([...EXPECTED_COUNTING_IDS]));
  });

  it('keeps complete, pointed Hebrew and natural English forms for counts 1-10', () => {
    for (const conceptId of SUPPORTED_COUNTING_CONCEPT_IDS) {
      for (const count of SUPPORTED_COUNTING_COUNTS) {
        const form = COUNTING_QUANTITY_FORMS[conceptId][count];
        expect(form.he).not.toBe('');
        expect(form.en).not.toBe('');
        expect(hasNiqqud(form.he)).toBe(false);
        expect(hasNiqqud(form.heSpoken)).toBe(true);
        expect(stripNiqqud(form.heSpoken).normalize('NFC'))
          .toBe(getHebrewPronunciationSkeleton(form.he));
        expect(getCountingQuantityPhrase('he', conceptId, count)).toBe(form.he);
        expect(getCountingQuantityPhrase('en', conceptId, count)).toBe(form.en);
      }
    }
  });

  it('preserves the original apple, ball, and banana quantity phrases', () => {
    expect(getCountingQuantityPhrase('he', 'apple', 1)).toBe('תפוח אחד');
    expect(getCountingQuantityPhrase('he', 'apple', 10)).toBe('עשרה תפוחים');
    expect(getCountingQuantityPhrase('he', 'ball', 2)).toBe('שני כדורים');
    expect(getCountingQuantityPhrase('he', 'banana', 3)).toBe('שלוש בננות');
    expect(getCountingQuantityPhrase('en', 'banana', 6)).toBe('six bananas');
  });

  it('uses reviewed gender and irregular plurals for critical new nouns', () => {
    expect(getCountingQuantityPhrase('he', 'cup', 1)).toBe('כוס אחת');
    expect(getCountingQuantityPhrase('he', 'cup', 2)).toBe('שתי כוסות');
    expect(getCountingQuantityPhrase('he', 'spoon', 1)).toBe('כפית אחת');
    expect(getCountingQuantityPhrase('he', 'spoon', 3)).toBe('שלוש כפיות');
    expect(getCountingQuantityPhrase('he', 'train', 1)).toBe('רכבת אחת');
    expect(getCountingQuantityPhrase('he', 'train', 2)).toBe('שתי רכבות');
    expect(getCountingQuantityPhrase('he', 'chair', 2)).toBe('שני כיסאות');
    expect(getCountingQuantityPhrase('he', 'tree', 2)).toBe('שני עצים');
    expect(getCountingQuantityPhrase('en', 'strawberry', 2)).toBe('two strawberries');
  });

  it('keeps count-aloud words independent from noun gender', () => {
    expect(SUPPORTED_COUNTING_COUNTS.map((count) => getCountAloudWord('he', count))).toEqual([
      'אחת',
      'שתיים',
      'שלוש',
      'ארבע',
      'חמש',
      'שש',
      'שבע',
      'שמונה',
      'תשע',
      'עשר',
    ]);
    expect(SUPPORTED_COUNTING_COUNTS.map((count) => getCountAloudWord('en', count))).toEqual([
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
    ]);
  });

  it('builds toddler-natural concept-specific counting questions', () => {
    expect(getCountingQuestion('he', 'cup')).toBe('כמה כוסות יש כאן?');
    expect(getCountingQuestion('he', 'spoon')).toBe('כמה כפיות יש כאן?');
    expect(getCountingQuestion('he', 'train')).toBe('כמה רכבות יש כאן?');
    expect(getCountingQuestion('en', 'tree')).toBe('How many trees are here?');
  });
});
