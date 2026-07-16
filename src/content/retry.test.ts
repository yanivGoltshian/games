import { describe, expect, it } from 'vitest';
import {
  RETRY_EN_MEMORY_REPEATED,
  RETRY_EN_MEMORY_STANDARD,
  RETRY_EN_NUMBER_PAIRS_REPEATED,
  RETRY_EN_NUMBER_PAIRS_STANDARD,
  RETRY_EN_REPEATED,
  RETRY_EN_STANDARD,
  RETRY_HE_MEMORY_REPEATED,
  RETRY_HE_MEMORY_STANDARD,
  RETRY_HE_NUMBER_PAIRS_REPEATED,
  RETRY_HE_NUMBER_PAIRS_STANDARD,
  RETRY_HE_REPEATED,
  RETRY_HE_STANDARD,
  getRetryBank,
} from './retry';

describe('retry content banks', () => {
  it('keeps stable generic ids and text for Hebrew and English', () => {
    expect(RETRY_HE_STANDARD).toEqual([
      { id: 'retry-he-standard-01', text: 'כמעט, שון. נסה שוב.', scope: 'generic', tier: 'standard' },
      { id: 'retry-he-standard-02', text: 'ניסיון יפה, שון! בוא ננסה שוב.', scope: 'generic', tier: 'standard' },
      { id: 'retry-he-standard-03', text: 'שון, אתה יכול. עוד ניסיון קטן.', scope: 'generic', tier: 'standard' },
      { id: 'retry-he-standard-04', text: 'יופי שניסית, חמודי. נסה שוב.', scope: 'generic', tier: 'standard' },
      { id: 'retry-he-standard-05', text: 'שון, אתה אלוף בלנסות. בוא ננסה שוב.', scope: 'generic', tier: 'standard' },
      { id: 'retry-he-standard-06', text: 'נסה שוב, חמודי. אני איתך.', scope: 'generic', tier: 'standard' },
      { id: 'retry-he-standard-07', text: 'שון, אהבתי שניסית. בוא ננסה שוב.', scope: 'generic', tier: 'standard' },
      { id: 'retry-he-standard-08', text: 'שון, אתה אלוף בלנסות. ננסה שוב ביחד.', scope: 'generic', tier: 'standard' },
    ]);
    expect(RETRY_EN_STANDARD).toEqual([
      { id: 'retry-en-standard-01', text: 'Nice try, Sean. Try again.', scope: 'generic', tier: 'standard' },
      { id: 'retry-en-standard-02', text: "Good thinking, Sean. Let's try again.", scope: 'generic', tier: 'standard' },
      { id: 'retry-en-standard-03', text: 'You can do it, Sean. One more try.', scope: 'generic', tier: 'standard' },
      { id: 'retry-en-standard-04', text: 'Almost, Sean! Try again.', scope: 'generic', tier: 'standard' },
      { id: 'retry-en-standard-05', text: "Great trying, Sean. Let's try again.", scope: 'generic', tier: 'standard' },
      { id: 'retry-en-standard-06', text: "Try again, sweetie. I'm with you.", scope: 'generic', tier: 'standard' },
      { id: 'retry-en-standard-07', text: "Sean, I love how you tried. Let's try again.", scope: 'generic', tier: 'standard' },
      { id: 'retry-en-standard-08', text: "Sean, you're a champion at trying. Let's try together.", scope: 'generic', tier: 'standard' },
    ]);
  });

  it('keeps stable repeated-effort ids for both locales', () => {
    expect(RETRY_HE_REPEATED.map((line) => line.id)).toEqual([
      'retry-he-repeated-01',
      'retry-he-repeated-02',
      'retry-he-repeated-03',
      'retry-he-repeated-04',
      'retry-he-repeated-05',
    ]);
    expect(RETRY_EN_REPEATED.map((line) => line.id)).toEqual([
      'retry-en-repeated-01',
      'retry-en-repeated-02',
      'retry-en-repeated-03',
      'retry-en-repeated-04',
      'retry-en-repeated-05',
    ]);
  });

  it('keeps stable warm memory-search ids for both locales and tiers', () => {
    expect(RETRY_HE_MEMORY_STANDARD.map((line) => line.id)).toEqual([
      'retry-he-memory-standard-01',
      'retry-he-memory-standard-02',
      'retry-he-memory-standard-03',
      'retry-he-memory-standard-04',
    ]);
    expect(RETRY_EN_MEMORY_STANDARD.map((line) => line.id)).toEqual([
      'retry-en-memory-standard-01',
      'retry-en-memory-standard-02',
      'retry-en-memory-standard-03',
      'retry-en-memory-standard-04',
    ]);
    expect(RETRY_HE_MEMORY_REPEATED.map((line) => line.id)).toEqual([
      'retry-he-memory-repeated-01',
      'retry-he-memory-repeated-02',
      'retry-he-memory-repeated-03',
    ]);
    expect(RETRY_EN_MEMORY_REPEATED.map((line) => line.id)).toEqual([
      'retry-en-memory-repeated-01',
      'retry-en-memory-repeated-02',
      'retry-en-memory-repeated-03',
    ]);
  });

  it('returns the expected locale/scope/tier bank', () => {
    expect(getRetryBank('he', 'generic', 'standard')).toBe(RETRY_HE_STANDARD);
    expect(getRetryBank('en', 'generic', 'repeated-effort')).toBe(RETRY_EN_REPEATED);
    expect(getRetryBank('he', 'memory-search', 'repeated-effort')).toBe(RETRY_HE_MEMORY_REPEATED);
    expect(getRetryBank('en', 'memory-search', 'standard')).toBe(RETRY_EN_MEMORY_STANDARD);
    expect(getRetryBank('he', 'number-pairs', 'standard')).toBe(RETRY_HE_NUMBER_PAIRS_STANDARD);
    expect(getRetryBank('en', 'number-pairs', 'repeated-effort')).toBe(RETRY_EN_NUMBER_PAIRS_REPEATED);
  });

  it('keeps number-pairs correction warm, concise, and locale complete', () => {
    expect(RETRY_HE_NUMBER_PAIRS_STANDARD.map((line) => line.text)).toEqual([
      'נעשה שוב.',
      'כמעט. נמצא את הזוג.',
    ]);
    expect(RETRY_EN_NUMBER_PAIRS_STANDARD).toHaveLength(RETRY_HE_NUMBER_PAIRS_STANDARD.length);
    expect(RETRY_HE_NUMBER_PAIRS_REPEATED).toHaveLength(2);
    expect(RETRY_EN_NUMBER_PAIRS_REPEATED).toHaveLength(RETRY_HE_NUMBER_PAIRS_REPEATED.length);
  });

  it('uses Sean frequently while keeping routine encouragement concise', () => {
    expect(RETRY_HE_STANDARD.filter((line) => line.text.includes('שון')).length).toBeGreaterThanOrEqual(6);
    expect(RETRY_EN_STANDARD.filter((line) => line.text.includes('Sean')).length).toBeGreaterThanOrEqual(6);
    expect(RETRY_HE_STANDARD.every((line) => line.text.split(/\s+/).length <= 9)).toBe(true);
    expect(RETRY_EN_STANDARD.every((line) => line.text.split(/\s+/).length <= 10)).toBe(true);
    expect(RETRY_HE_REPEATED.every((line) => line.text.includes('שון'))).toBe(true);
    expect(RETRY_EN_REPEATED.every((line) => line.text.includes('Sean'))).toBe(true);
  });
});
