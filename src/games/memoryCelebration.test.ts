import { describe, expect, it } from 'vitest';
import {
  INITIAL_MEMORY_CELEBRATION_STATE,
  REDUCED_MOTION_REVEAL_HOLD_MS,
  memoryRevealFallbackMs,
  reduceMemoryCelebration,
} from './memoryCelebration';
import type { CelebrationInfo } from './types';

const celebration: CelebrationInfo = {
  seed: 'final-pair',
  targetSegments: [{ text: 'כלב', locale: 'he-IL' }],
  tier: 'standard',
};

describe('memory final-pair reveal', () => {
  it('keeps the success overlay hidden until the final card reports a completed reveal', () => {
    const revealing = reduceMemoryCelebration(INITIAL_MEMORY_CELEBRATION_STATE, {
      type: 'queue',
      finalCardId: 'card-last',
      info: celebration,
    });

    expect(revealing).toMatchObject({ visible: null });
    expect(reduceMemoryCelebration(revealing, {
      type: 'reveal-complete',
      cardId: 'card-other',
    })).toBe(revealing);

    const revealed = reduceMemoryCelebration(revealing, {
      type: 'reveal-complete',
      cardId: 'card-last',
    });
    expect(revealed).toEqual({ pending: null, visible: celebration });
  });

  it('uses an intentional visual hold when card transitions are disabled', () => {
    expect(memoryRevealFallbackMs(false, false)).toBeNull();
    expect(memoryRevealFallbackMs(true, false)).toBe(REDUCED_MOTION_REVEAL_HOLD_MS);
    expect(memoryRevealFallbackMs(false, true)).toBe(REDUCED_MOTION_REVEAL_HOLD_MS);
  });
});
