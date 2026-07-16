import {
  countingConceptIds,
  countingConcepts,
  requireLearningConcept,
  type CountingConceptId,
} from './concepts';
import type { HebrewGrammaticalGender } from '../domain/types';
import type { RetryLocale } from './retry';

export type { CountingConceptId } from './concepts';

export const SUPPORTED_COUNTING_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type SupportedCountingCount = (typeof SUPPORTED_COUNTING_COUNTS)[number];

export interface CountingQuantityForms {
  he: string;
  heSpoken: string;
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

export const COUNT_ALOUD_WORDS_HE_SPOKEN: Record<SupportedCountingCount, string> = {
  1: 'אַחַת',
  2: 'שְׁתַּיִים',
  3: 'שָׁלוֹשׁ',
  4: 'אַרְבַּע',
  5: 'חָמֵשׁ',
  6: 'שֵׁשׁ',
  7: 'שֶׁבַע',
  8: 'שְׁמוֹנֶה',
  9: 'תֵּשַׁע',
  10: 'עֶשֶׂר',
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

const HEBREW_QUANTITY_WORDS_SPOKEN: Record<
  HebrewGrammaticalGender,
  Record<SupportedCountingCount, string>
> = {
  masculine: {
    1: 'אֶחָד',
    2: 'שְׁנֵי',
    3: 'שְׁלוֹשָׁה',
    4: 'אַרְבָּעָה',
    5: 'חֲמִישָׁה',
    6: 'שִׁישָׁה',
    7: 'שִׁבְעָה',
    8: 'שְׁמוֹנָה',
    9: 'תִּשְׁעָה',
    10: 'עֲשָׂרָה',
  },
  feminine: {
    1: 'אַחַת',
    2: 'שְׁתֵּי',
    3: 'שָׁלוֹשׁ',
    4: 'אַרְבַּע',
    5: 'חָמֵשׁ',
    6: 'שֵׁשׁ',
    7: 'שֶׁבַע',
    8: 'שְׁמוֹנֶה',
    9: 'תֵּשַׁע',
    10: 'עֶשֶׂר',
  },
};

function toSupportedCountingCount(count: number): SupportedCountingCount {
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new Error(`Counting quantities support only integers 1-10. Received: ${count}`);
  }

  return count as SupportedCountingCount;
}

function requireCountingQuantity(conceptId: CountingConceptId) {
  const concept = requireLearningConcept(conceptId);
  if (!concept.quantity) {
    throw new Error(`Concept is not available for counting: ${conceptId}`);
  }
  return concept.quantity;
}

function buildHebrewQuantityPhrase(
  conceptId: CountingConceptId,
  count: SupportedCountingCount,
): Pick<CountingQuantityForms, 'he' | 'heSpoken'> {
  const concept = requireCountingQuantity(conceptId);
  const quantityWord = HEBREW_QUANTITY_WORDS[concept.he.gender][count];
  const quantityWordSpoken = HEBREW_QUANTITY_WORDS_SPOKEN[concept.he.gender][count];
  if (count === 1) {
    return {
      he: `${concept.he.singular} ${quantityWord}`,
      heSpoken: `${concept.he.singularSpoken} ${quantityWordSpoken}`,
    };
  }

  return {
    he: `${quantityWord} ${concept.he.countedPlural}`,
    heSpoken: `${quantityWordSpoken} ${concept.he.countedPluralSpoken}`,
  };
}

function buildEnglishQuantityPhrase(
  conceptId: CountingConceptId,
  count: SupportedCountingCount,
): string {
  const concept = requireCountingQuantity(conceptId);
  const quantityWord = COUNT_ALOUD_WORDS_EN[count];
  const noun = count === 1 ? concept.en.singular : concept.en.plural;
  return `${quantityWord} ${noun}`;
}

function createQuantityFormSet(conceptId: CountingConceptId): CountingQuantityFormSet {
  const form = (count: SupportedCountingCount): CountingQuantityForms => ({
    ...buildHebrewQuantityPhrase(conceptId, count),
    en: buildEnglishQuantityPhrase(conceptId, count),
  });

  return {
    1: form(1),
    2: form(2),
    3: form(3),
    4: form(4),
    5: form(5),
    6: form(6),
    7: form(7),
    8: form(8),
    9: form(9),
    10: form(10),
  };
}

export const COUNTING_QUANTITY_FORMS = Object.fromEntries(
  countingConcepts.map((concept) => [concept.id, createQuantityFormSet(concept.id)]),
) as Readonly<Record<CountingConceptId, CountingQuantityFormSet>>;

export const SUPPORTED_COUNTING_CONCEPT_IDS: readonly CountingConceptId[] = countingConceptIds;

export function getCountingQuantityPhrase(
  locale: RetryLocale,
  conceptId: CountingConceptId,
  count: number,
): string {
  const supportedCount = toSupportedCountingCount(count);
  return COUNTING_QUANTITY_FORMS[conceptId][supportedCount][locale];
}

export function getCountingQuantitySpokenPhrase(
  conceptId: CountingConceptId,
  count: number,
): string {
  const supportedCount = toSupportedCountingCount(count);
  return COUNTING_QUANTITY_FORMS[conceptId][supportedCount].heSpoken;
}

export function getCountingQuestion(locale: RetryLocale, conceptId: CountingConceptId): string {
  const concept = requireCountingQuantity(conceptId);
  return locale === 'he'
    ? `כמה ${concept.he.plural} יש כאן?`
    : `How many ${concept.en.plural} are here?`;
}

export function getCountingQuestionSpoken(conceptId: CountingConceptId): string {
  const concept = requireCountingQuantity(conceptId);
  return `כַּמָּה ${concept.he.pluralSpoken} יֵשׁ כָּאן?`;
}

export function getCountAloudWord(locale: RetryLocale, count: number): string {
  const supportedCount = toSupportedCountingCount(count);
  return locale === 'he' ? COUNT_ALOUD_WORDS_HE[supportedCount] : COUNT_ALOUD_WORDS_EN[supportedCount];
}

export function getCountAloudSpokenWord(count: number): string {
  return COUNT_ALOUD_WORDS_HE_SPOKEN[toSupportedCountingCount(count)];
}

export function countingConceptQuantityCoverage(): string[] {
  return [...countingConceptIds];
}
