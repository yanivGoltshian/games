import { countingConceptIds } from './concepts';
import type { RetryLocale } from './retry';

export const SUPPORTED_COUNTING_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type SupportedCountingCount = (typeof SUPPORTED_COUNTING_COUNTS)[number];
export type CountingConceptId = 'apple' | 'ball' | 'banana' | 'flower' | 'sun' | 'cup';
export type HebrewGrammaticalGender = 'masculine' | 'feminine';

interface CountingConceptQuantityMeta {
  he: {
    singular: string;
    plural: string;
    gender: HebrewGrammaticalGender;
  };
  en: {
    singular: string;
    plural: string;
  };
}

export interface CountingQuantityForms {
  he: string;
  en: string;
}

export type CountingQuantityFormSet = Record<SupportedCountingCount, CountingQuantityForms>;

export const COUNT_ALOUD_WORDS_HE: Record<SupportedCountingCount, string> = {
  1: 'אחת',
  2: 'שתיים',
  3: 'שלוש',
  4: 'ארבע',
  5: 'חמש',
  6: 'שש',
  7: 'שבע',
  8: 'שמונה',
  9: 'תשע',
  10: 'עשר',
};

export const COUNT_ALOUD_WORDS_EN: Record<SupportedCountingCount, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
};

const HEBREW_QUANTITY_WORDS: Record<HebrewGrammaticalGender, Record<SupportedCountingCount, string>> = {
  masculine: {
    1: 'אחד',
    2: 'שני',
    3: 'שלושה',
    4: 'ארבעה',
    5: 'חמישה',
    6: 'שישה',
    7: 'שבעה',
    8: 'שמונה',
    9: 'תשעה',
    10: 'עשרה',
  },
  feminine: {
    1: 'אחת',
    2: 'שתי',
    3: 'שלוש',
    4: 'ארבע',
    5: 'חמש',
    6: 'שש',
    7: 'שבע',
    8: 'שמונה',
    9: 'תשע',
    10: 'עשר',
  },
};

export const COUNTING_CONCEPT_QUANTITY_META: Record<CountingConceptId, CountingConceptQuantityMeta> = {
  apple: {
    he: { singular: 'תפוח', plural: 'תפוחים', gender: 'masculine' },
    en: { singular: 'apple', plural: 'apples' },
  },
  ball: {
    he: { singular: 'כדור', plural: 'כדורים', gender: 'masculine' },
    en: { singular: 'ball', plural: 'balls' },
  },
  banana: {
    he: { singular: 'בננה', plural: 'בננות', gender: 'feminine' },
    en: { singular: 'banana', plural: 'bananas' },
  },
  flower: {
    he: { singular: 'פרח', plural: 'פרחים', gender: 'masculine' },
    en: { singular: 'flower', plural: 'flowers' },
  },
  sun: {
    he: { singular: 'שמש', plural: 'שמשות', gender: 'feminine' },
    en: { singular: 'sun', plural: 'suns' },
  },
  cup: {
    he: { singular: 'כוס', plural: 'כוסות', gender: 'feminine' },
    en: { singular: 'cup', plural: 'cups' },
  },
};

function toSupportedCountingCount(count: number): SupportedCountingCount {
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new Error(`Counting quantities support only integers 1-10. Received: ${count}`);
  }

  return count as SupportedCountingCount;
}

function buildHebrewQuantityPhrase(conceptId: CountingConceptId, count: SupportedCountingCount): string {
  const concept = COUNTING_CONCEPT_QUANTITY_META[conceptId];
  const quantityWord = HEBREW_QUANTITY_WORDS[concept.he.gender][count];
  if (count === 1) {
    return `${concept.he.singular} ${quantityWord}`;
  }

  return `${quantityWord} ${concept.he.plural}`;
}

function buildEnglishQuantityPhrase(conceptId: CountingConceptId, count: SupportedCountingCount): string {
  const concept = COUNTING_CONCEPT_QUANTITY_META[conceptId];
  const quantityWord = COUNT_ALOUD_WORDS_EN[count];
  const noun = count === 1 ? concept.en.singular : concept.en.plural;
  return `${quantityWord} ${noun}`;
}

function createQuantityFormSet(conceptId: CountingConceptId): CountingQuantityFormSet {
  return {
    1: { he: buildHebrewQuantityPhrase(conceptId, 1), en: buildEnglishQuantityPhrase(conceptId, 1) },
    2: { he: buildHebrewQuantityPhrase(conceptId, 2), en: buildEnglishQuantityPhrase(conceptId, 2) },
    3: { he: buildHebrewQuantityPhrase(conceptId, 3), en: buildEnglishQuantityPhrase(conceptId, 3) },
    4: { he: buildHebrewQuantityPhrase(conceptId, 4), en: buildEnglishQuantityPhrase(conceptId, 4) },
    5: { he: buildHebrewQuantityPhrase(conceptId, 5), en: buildEnglishQuantityPhrase(conceptId, 5) },
    6: { he: buildHebrewQuantityPhrase(conceptId, 6), en: buildEnglishQuantityPhrase(conceptId, 6) },
    7: { he: buildHebrewQuantityPhrase(conceptId, 7), en: buildEnglishQuantityPhrase(conceptId, 7) },
    8: { he: buildHebrewQuantityPhrase(conceptId, 8), en: buildEnglishQuantityPhrase(conceptId, 8) },
    9: { he: buildHebrewQuantityPhrase(conceptId, 9), en: buildEnglishQuantityPhrase(conceptId, 9) },
    10: { he: buildHebrewQuantityPhrase(conceptId, 10), en: buildEnglishQuantityPhrase(conceptId, 10) },
  };
}

export const COUNTING_QUANTITY_FORMS: Record<CountingConceptId, CountingQuantityFormSet> = {
  apple: createQuantityFormSet('apple'),
  ball: createQuantityFormSet('ball'),
  banana: createQuantityFormSet('banana'),
  flower: createQuantityFormSet('flower'),
  sun: createQuantityFormSet('sun'),
  cup: createQuantityFormSet('cup'),
};

export const SUPPORTED_COUNTING_CONCEPT_IDS = Object.keys(
  COUNTING_CONCEPT_QUANTITY_META,
) as CountingConceptId[];

export function getCountingQuantityPhrase(locale: RetryLocale, conceptId: CountingConceptId, count: number): string {
  const supportedCount = toSupportedCountingCount(count);
  return COUNTING_QUANTITY_FORMS[conceptId][supportedCount][locale];
}

export function getCountAloudWord(locale: RetryLocale, count: number): string {
  const supportedCount = toSupportedCountingCount(count);
  return locale === 'he' ? COUNT_ALOUD_WORDS_HE[supportedCount] : COUNT_ALOUD_WORDS_EN[supportedCount];
}

export function countingConceptQuantityCoverage(): string[] {
  return [...countingConceptIds];
}
