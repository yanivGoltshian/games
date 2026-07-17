import { createSeededRandom } from '../domain/rng';

export type PraiseLocale = 'he' | 'en';
export type PraiseTier = 'standard' | 'milestone';

export interface PraiseLine {
  id: string;
  text: string;
  recordedFallbackText?: string;
  tier: PraiseTier;
}

/**
 * Central, locale-aware praise bank. Ids are stable so tests, analytics-free
 * debugging, and future audio recordings can all key off them without ever
 * depending on the literal text.
 */
export const PRAISE_HE: PraiseLine[] = [
  { id: 'praise-he-01', text: 'כל הכבוד, שון!', recordedFallbackText: 'יופי!', tier: 'standard' },
  { id: 'praise-he-02', text: 'יופי!', tier: 'standard' },
  { id: 'praise-he-03', text: 'הצלחת!', tier: 'standard' },
  { id: 'praise-he-04', text: 'מעולה!', tier: 'standard' },
];

export const PRAISE_EN: PraiseLine[] = [
  { id: 'praise-en-01', text: 'Great job, Sean!', recordedFallbackText: 'Great!', tier: 'standard' },
  { id: 'praise-en-02', text: 'Great!', tier: 'standard' },
  { id: 'praise-en-03', text: 'You did it!', tier: 'standard' },
  { id: 'praise-en-04', text: 'Excellent!', tier: 'standard' },
];

/** Slightly richer wording after a small streak or level-up. Still no pressure, no scoreboard language. */
export const MILESTONE_PRAISE_HE: PraiseLine[] = [
  {
    id: 'praise-he-milestone-01',
    text: 'איזה כיף, שון עולה שלב!',
    recordedFallbackText: 'עברת שלב!',
    tier: 'milestone',
  },
  {
    id: 'praise-he-milestone-02',
    text: 'שון מתמיד כל כך יפה, איזה אלוף!',
    recordedFallbackText: 'עברת שלב!',
    tier: 'milestone',
  },
];

export const MILESTONE_PRAISE_EN: PraiseLine[] = [
  {
    id: 'praise-en-milestone-01',
    text: 'Wow, Sean leveled up!',
    recordedFallbackText: 'You moved up a level!',
    tier: 'milestone',
  },
  { id: 'praise-en-milestone-02', text: "You're doing great again and again!", tier: 'milestone' },
];

/** Gentle, purely visual nudge shown after a milestone. No clinical or pressure language. */
export const REAL_WORLD_PAUSE_HE = 'בואו נלך לשחק ביחד קצת!';
export const REAL_WORLD_PAUSE_EN = "Let's go play together for a bit!";

function bankFor(locale: PraiseLocale, tier: PraiseTier): PraiseLine[] {
  if (tier === 'milestone') {
    return locale === 'he' ? MILESTONE_PRAISE_HE : MILESTONE_PRAISE_EN;
  }
  return locale === 'he' ? PRAISE_HE : PRAISE_EN;
}

/**
 * Pure, deterministic praise selector. The same (locale, tier, seed) always
 * returns the same line, which keeps success screens testable and keeps
 * repeated praise feeling intentional rather than random chatter.
 */
export function selectPraise(locale: PraiseLocale, tier: PraiseTier, seed: string | number): PraiseLine {
  const bank = bankFor(locale, tier);
  const random = createSeededRandom(`praise-${locale}-${tier}-${seed}`);
  return random.pick(bank);
}
