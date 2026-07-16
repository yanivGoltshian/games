import {
  getCountAloudWord,
  getCountingQuantityPhrase,
  type CountingConceptId,
} from '../content/countingQuantity';
import { classifyRetryAttempt, type RetryAttemptState } from './retry';

export type CountingMissVariant = 'first-miss' | 'subsequent-miss';
export type CountingLayoutDensity = 'single' | 'early' | 'middle' | 'full';

export interface LocalizedCountingModelLine {
  he: string;
  en: string;
  pauseAfterMs?: number;
  cue?: string;
}

export interface CountingMissModel {
  attemptState: RetryAttemptState;
  variant: CountingMissVariant;
  quantity: { he: string; en: string };
  lines: LocalizedCountingModelLine[];
}

export interface CountingLayout {
  columns: number;
  density: CountingLayoutDensity;
}

function quantitySentence(locale: 'he' | 'en', conceptId: CountingConceptId, count: number): string {
  const quantity = getCountingQuantityPhrase(locale, conceptId, count);
  if (locale === 'he') {
    return `יש כאן ${quantity}.`;
  }
  return count === 1 ? `There is ${quantity}.` : `There are ${quantity}.`;
}

export function buildCountingMissModel(
  conceptId: CountingConceptId,
  count: number,
  missCount: number,
): CountingMissModel {
  const attemptState = classifyRetryAttempt(missCount);
  const variant: CountingMissVariant = attemptState.useSubsequentCountingModel ? 'subsequent-miss' : 'first-miss';
  const quantity = {
    he: getCountingQuantityPhrase('he', conceptId, count),
    en: getCountingQuantityPhrase('en', conceptId, count),
  };

  const lines: LocalizedCountingModelLine[] = variant === 'first-miss'
    ? [
        { he: 'בוא נספור יחד.', en: "Let's count together.", pauseAfterMs: 180 },
        ...Array.from({ length: count }, (_, index) => ({
          he: getCountAloudWord('he', index + 1),
          en: getCountAloudWord('en', index + 1),
          pauseAfterMs: 220,
          cue: `count-item:${index}`,
        })),
        {
          he: quantitySentence('he', conceptId, count),
          en: quantitySentence('en', conceptId, count),
          pauseAfterMs: 220,
        },
      ]
    : [
        {
          he: quantitySentence('he', conceptId, count),
          en: quantitySentence('en', conceptId, count),
          pauseAfterMs: 220,
          cue: `count-answer:${count}`,
        },
      ];

  return { attemptState, variant, quantity, lines };
}

export function getCountingLayout(count: number): CountingLayout {
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new Error(`Counting layouts support only integers 1-10. Received: ${count}`);
  }
  if (count === 1) {
    return { columns: 1, density: 'single' };
  }
  if (count <= 3) {
    return { columns: count, density: 'early' };
  }
  if (count <= 5) {
    return { columns: count === 4 ? 2 : 3, density: 'middle' };
  }
  return { columns: count <= 6 ? 3 : count <= 8 ? 4 : 5, density: 'full' };
}
