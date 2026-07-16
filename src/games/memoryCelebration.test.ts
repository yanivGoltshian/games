import { describe, expect, it, vi } from 'vitest';
import {
  INITIAL_MEMORY_CELEBRATION_STATE,
  REDUCED_MOTION_REVEAL_HOLD_MS,
  memoryRevealFallbackMs,
  reduceMemoryCelebration,
  scheduleMemoryRevealFallback,
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

  it('cancels the reduced-motion fallback without a late state update after exit', () => {
    let runScheduled = (): void => undefined;
    const clearTimeout = vi.fn();
    const onComplete = vi.fn();
    const cancel = scheduleMemoryRevealFallback(
      REDUCED_MOTION_REVEAL_HOLD_MS,
      onComplete,
      {
        setTimeout(callback) {
          runScheduled = callback;
          return 17;
        },
        clearTimeout,
      },
    );

    cancel();
    runScheduled();

    expect(clearTimeout).toHaveBeenCalledWith(17);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
