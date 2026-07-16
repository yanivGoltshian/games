export type RetryLocale = 'he' | 'en';
export type RetryScope = 'generic' | 'memory-search';
export type RetryTier = 'standard' | 'repeated-effort';

export interface RetryLine {
  id: string;
  text: string;
  scope: RetryScope;
  tier: RetryTier;
}

export const RETRY_HE_STANDARD: RetryLine[] = [
  { id: 'retry-he-standard-01', text: 'כמעט, שון. נסה שוב.', scope: 'generic', tier: 'standard' },
  { id: 'retry-he-standard-02', text: 'ניסיון יפה! בוא ננסה שוב.', scope: 'generic', tier: 'standard' },
  { id: 'retry-he-standard-03', text: 'שון, אתה יכול. עוד ניסיון קטן.', scope: 'generic', tier: 'standard' },
  { id: 'retry-he-standard-04', text: 'יופי שניסית, חמודי. נסה שוב.', scope: 'generic', tier: 'standard' },
  { id: 'retry-he-standard-05', text: 'שון, אתה אלוף בלנסות. בוא ננסה שוב.', scope: 'generic', tier: 'standard' },
];

export const RETRY_EN_STANDARD: RetryLine[] = [
  { id: 'retry-en-standard-01', text: 'Nice try, Sean. Try again.', scope: 'generic', tier: 'standard' },
  { id: 'retry-en-standard-02', text: "Good thinking. Let's try again.", scope: 'generic', tier: 'standard' },
  { id: 'retry-en-standard-03', text: 'You can do it, Sean. One more try.', scope: 'generic', tier: 'standard' },
  { id: 'retry-en-standard-04', text: 'Almost! Try again.', scope: 'generic', tier: 'standard' },
  { id: 'retry-en-standard-05', text: "Great trying, Sean. Let's try again.", scope: 'generic', tier: 'standard' },
];

export const RETRY_HE_REPEATED: RetryLine[] = [
  { id: 'retry-he-repeated-01', text: 'שון, אתה אלוף בלנסות. ניקח רגע וננסה שוב.', scope: 'generic', tier: 'repeated-effort' },
  { id: 'retry-he-repeated-02', text: 'יופי שניסית, חמודי. עוד ניסיון קטן.', scope: 'generic', tier: 'repeated-effort' },
  { id: 'retry-he-repeated-03', text: 'ביחד ובנחת, בוא ננסה שוב.', scope: 'generic', tier: 'repeated-effort' },
];

export const RETRY_EN_REPEATED: RetryLine[] = [
  { id: 'retry-en-repeated-01', text: "Sean, you're great at trying. Let's pause and try again.", scope: 'generic', tier: 'repeated-effort' },
  { id: 'retry-en-repeated-02', text: 'Great trying, Sean. One more small try.', scope: 'generic', tier: 'repeated-effort' },
  { id: 'retry-en-repeated-03', text: "Together and gently, let's try again.", scope: 'generic', tier: 'repeated-effort' },
];

export const RETRY_HE_MEMORY_STANDARD: RetryLine[] = [
  { id: 'retry-he-memory-standard-01', text: 'נמשיך לחפש את הזוג.', scope: 'memory-search', tier: 'standard' },
  { id: 'retry-he-memory-standard-02', text: 'בוא נחפש איפה הזוג מתחבא.', scope: 'memory-search', tier: 'standard' },
  { id: 'retry-he-memory-standard-03', text: 'נחפש יחד את הזוג.', scope: 'memory-search', tier: 'standard' },
];

export const RETRY_EN_MEMORY_STANDARD: RetryLine[] = [
  { id: 'retry-en-memory-standard-01', text: "Let's keep looking for the pair.", scope: 'memory-search', tier: 'standard' },
  { id: 'retry-en-memory-standard-02', text: "Let's find where the pair is hiding.", scope: 'memory-search', tier: 'standard' },
  { id: 'retry-en-memory-standard-03', text: "Let's look for the pair together.", scope: 'memory-search', tier: 'standard' },
];

export const RETRY_HE_MEMORY_REPEATED: RetryLine[] = [
  { id: 'retry-he-memory-repeated-01', text: 'יופי שהמשכת לחפש. ננסה עוד זוג.', scope: 'memory-search', tier: 'repeated-effort' },
  { id: 'retry-he-memory-repeated-02', text: 'ביחד ובנחת, נמשיך לחפש.', scope: 'memory-search', tier: 'repeated-effort' },
];

export const RETRY_EN_MEMORY_REPEATED: RetryLine[] = [
  {
    id: 'retry-en-memory-repeated-01',
    text: "Great job keeping on looking. Let's try another pair.",
    scope: 'memory-search',
    tier: 'repeated-effort',
  },
  {
    id: 'retry-en-memory-repeated-02',
    text: "Together and gently, let's keep looking.",
    scope: 'memory-search',
    tier: 'repeated-effort',
  },
];

const RETRY_BANKS: Record<RetryLocale, Record<RetryScope, Record<RetryTier, RetryLine[]>>> = {
  he: {
    generic: {
      standard: RETRY_HE_STANDARD,
      'repeated-effort': RETRY_HE_REPEATED,
    },
    'memory-search': {
      standard: RETRY_HE_MEMORY_STANDARD,
      'repeated-effort': RETRY_HE_MEMORY_REPEATED,
    },
  },
  en: {
    generic: {
      standard: RETRY_EN_STANDARD,
      'repeated-effort': RETRY_EN_REPEATED,
    },
    'memory-search': {
      standard: RETRY_EN_MEMORY_STANDARD,
      'repeated-effort': RETRY_EN_MEMORY_REPEATED,
    },
  },
};

export function getRetryBank(locale: RetryLocale, scope: RetryScope, tier: RetryTier): RetryLine[] {
  return RETRY_BANKS[locale][scope][tier];
}
