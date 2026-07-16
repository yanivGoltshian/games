import { describe, expect, it } from 'vitest';
import {
  COUNTING_QUANTITY_FORMS,
  SUPPORTED_COUNTING_CONCEPT_IDS,
  SUPPORTED_COUNTING_COUNTS,
  countingConceptQuantityCoverage,
  getCountAloudWord,
  getCountingQuantityPhrase,
} from './countingQuantity';

describe('counting quantity wording', () => {
  it('covers exactly the current counting concepts', () => {
    expect(SUPPORTED_COUNTING_CONCEPT_IDS).toEqual(['apple', 'ball', 'banana', 'flower', 'sun', 'cup']);
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
      flower: {
        1: { he: 'פרח אחד', en: 'one flower' },
        2: { he: 'שני פרחים', en: 'two flowers' },
        3: { he: 'שלושה פרחים', en: 'three flowers' },
        4: { he: 'ארבעה פרחים', en: 'four flowers' },
        5: { he: 'חמישה פרחים', en: 'five flowers' },
        6: { he: 'שישה פרחים', en: 'six flowers' },
        7: { he: 'שבעה פרחים', en: 'seven flowers' },
        8: { he: 'שמונה פרחים', en: 'eight flowers' },
        9: { he: 'תשעה פרחים', en: 'nine flowers' },
        10: { he: 'עשרה פרחים', en: 'ten flowers' },
      },
      sun: {
        1: { he: 'שמש אחת', en: 'one sun' },
        2: { he: 'שתי שמשות', en: 'two suns' },
        3: { he: 'שלוש שמשות', en: 'three suns' },
        4: { he: 'ארבע שמשות', en: 'four suns' },
        5: { he: 'חמש שמשות', en: 'five suns' },
        6: { he: 'שש שמשות', en: 'six suns' },
        7: { he: 'שבע שמשות', en: 'seven suns' },
        8: { he: 'שמונה שמשות', en: 'eight suns' },
        9: { he: 'תשע שמשות', en: 'nine suns' },
        10: { he: 'עשר שמשות', en: 'ten suns' },
      },
      cup: {
        1: { he: 'כוס אחת', en: 'one cup' },
        2: { he: 'שתי כוסות', en: 'two cups' },
        3: { he: 'שלוש כוסות', en: 'three cups' },
        4: { he: 'ארבע כוסות', en: 'four cups' },
        5: { he: 'חמש כוסות', en: 'five cups' },
        6: { he: 'שש כוסות', en: 'six cups' },
        7: { he: 'שבע כוסות', en: 'seven cups' },
        8: { he: 'שמונה כוסות', en: 'eight cups' },
        9: { he: 'תשע כוסות', en: 'nine cups' },
        10: { he: 'עשר כוסות', en: 'ten cups' },
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
    expect(getCountingQuantityPhrase('en', 'cup', 1)).toBe('one cup');
    expect(getCountingQuantityPhrase('en', 'cup', 6)).toBe('six cups');
  });
});
