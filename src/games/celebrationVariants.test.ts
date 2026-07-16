import { describe, expect, it } from 'vitest';
import {
  CELEBRATION_VARIANTS,
  selectCelebrationVariant,
  type CelebrationVariant,
} from './celebrationVariants';

describe('selectCelebrationVariant', () => {
  it('is deterministic for the same seed and previous variant', () => {
    expect(selectCelebrationVariant('final-round', null)).toBe(selectCelebrationVariant('final-round', null));
    expect(selectCelebrationVariant(17, 'balloons')).toBe(selectCelebrationVariant(17, 'balloons'));
    expect(selectCelebrationVariant('story-time', 'cake-candles')).toBe(selectCelebrationVariant('story-time', 'cake-candles'));
  });

  it('covers every celebration variant across many seeds', () => {
    const seen = new Set<CelebrationVariant>();

    for (let seed = 0; seed < 5000; seed += 1) {
      seen.add(selectCelebrationVariant(seed));
    }

    expect(seen.size).toBe(CELEBRATION_VARIANTS.length);
    for (const variant of CELEBRATION_VARIANTS) {
      expect(seen.has(variant)).toBe(true);
    }
  });

  it('never repeats the immediate previous variant', () => {
    for (const previousVariant of CELEBRATION_VARIANTS) {
      for (let seed = 0; seed < 250; seed += 1) {
        expect(selectCelebrationVariant(seed, previousVariant)).not.toBe(previousVariant);
      }
    }
  });

  it('keeps the published variant set stable', () => {
    expect(CELEBRATION_VARIANTS).toEqual([
      'puppy-confetti',
      'cake-candles',
      'balloons',
      'rainbow-hop',
      'trophy-spark',
    ]);
  });
});
