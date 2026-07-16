import { describe, expect, it } from 'vitest';
import {
  COUNTING_QUANTITY_FORMS,
  SUPPORTED_COUNTING_CONCEPT_IDS,
  SUPPORTED_COUNTING_COUNTS,
  countingConceptQuantityCoverage,
  getCountAloudWord,
  getCountingQuestion,
  getCountingQuantityPhrase,
} from './countingQuantity';

describe('counting quantity wording', () => {
  it('covers exactly the current counting concepts', () => {
    expect(SUPPORTED_COUNTING_CONCEPT_IDS).toEqual(['apple', 'ball', 'banana']);
    expect(countingConceptQuantityCoverage()).toEqual(SUPPORTED_COUNTING_CONCEPT_IDS);
  });

  it('keeps all Hebrew and English quantity forms for counts 1-10', () => {
    const expected = {
      apple: {
        1: { he: 'תפוח אחד', en: 'one apple' },
        2: { he: 'שני תפוחים', en: 'two apples' },
        3: { he: 'שלושה תפוחים', en: 'three apples' },
        4: { he: 'ארבעה תפוחים', en: 'four apples' },
        5: { he: 'חמישה תפוחים', en: 'five apples' },
        6: { he: 'שישה תפוחים', en: 'six apples' },
        7: { he: 'שבעה תפוחים', en: 'seven apples' },
        8: { he: 'שמונה תפוחים', en: 'eight apples' },
        9: { he: 'תשעה תפוחים', en: 'nine apples' },
        10: { he: 'עשרה תפוחים', en: 'ten apples' },
      },
      ball: {
        1: { he: 'כדור אחד', en: 'one ball' },
        2: { he: 'שני כדורים', en: 'two balls' },
        3: { he: 'שלושה כדורים', en: 'three balls' },
        4: { he: 'ארבעה כדורים', en: 'four balls' },
        5: { he: 'חמישה כדורים', en: 'five balls' },
        6: { he: 'שישה כדורים', en: 'six balls' },
        7: { he: 'שבעה כדורים', en: 'seven balls' },
        8: { he: 'שמונה כדורים', en: 'eight balls' },
        9: { he: 'תשעה כדורים', en: 'nine balls' },
        10: { he: 'עשרה כדורים', en: 'ten balls' },
      },
      banana: {
        1: { he: 'בננה אחת', en: 'one banana' },
        2: { he: 'שתי בננות', en: 'two bananas' },
        3: { he: 'שלוש בננות', en: 'three bananas' },
        4: { he: 'ארבע בננות', en: 'four bananas' },
        5: { he: 'חמש בננות', en: 'five bananas' },
        6: { he: 'שש בננות', en: 'six bananas' },
        7: { he: 'שבע בננות', en: 'seven bananas' },
        8: { he: 'שמונה בננות', en: 'eight bananas' },
        9: { he: 'תשע בננות', en: 'nine bananas' },
        10: { he: 'עשר בננות', en: 'ten bananas' },
      },
    } as const;

    for (const conceptId of SUPPORTED_COUNTING_CONCEPT_IDS) {
      for (const count of SUPPORTED_COUNTING_COUNTS) {
        expect(COUNTING_QUANTITY_FORMS[conceptId][count]).toEqual(expected[conceptId][count]);
        expect(getCountingQuantityPhrase('he', conceptId, count)).toBe(expected[conceptId][count].he);
        expect(getCountingQuantityPhrase('en', conceptId, count)).toBe(expected[conceptId][count].en);
      }
    }
  });

  it('keeps count-aloud words and English singular/plural wording natural', () => {
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
    expect(getCountingQuantityPhrase('en', 'apple', 1)).toBe('one apple');
    expect(getCountingQuantityPhrase('en', 'apple', 2)).toBe('two apples');
    expect(getCountingQuantityPhrase('en', 'banana', 1)).toBe('one banana');
    expect(getCountingQuantityPhrase('en', 'banana', 6)).toBe('six bananas');
  });

  it('builds toddler-natural concept-specific counting questions', () => {
    expect(SUPPORTED_COUNTING_CONCEPT_IDS.map((conceptId) => getCountingQuestion('he', conceptId))).toEqual([
      'כמה תפוחים יש כאן?',
      'כמה כדורים יש כאן?',
      'כמה בננות יש כאן?',
    ]);
    expect(SUPPORTED_COUNTING_CONCEPT_IDS.map((conceptId) => getCountingQuestion('en', conceptId))).toEqual([
      'How many apples are here?',
      'How many balls are here?',
      'How many bananas are here?',
    ]);
  });
});
