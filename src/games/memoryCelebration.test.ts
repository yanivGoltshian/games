import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INITIAL_MEMORY_CELEBRATION_STATE,
  MEMORY_MISMATCH_HOLD_MS,
  REDUCED_MOTION_MISMATCH_HOLD_MS,
  REDUCED_MOTION_REVEAL_HOLD_MS,
  memoryMismatchHoldMs,
  memoryRevealFallbackMs,
  reduceMemoryCelebration,
  scheduleMemoryMismatchClose,
  scheduleMemoryRevealFallback,
} from './memoryCelebration';
import type { CelebrationInfo } from './types';

const celebration: CelebrationInfo = {
  seed: 'final-pair',
  targetSegments: [{ text: 'כלב', locale: 'he-IL' }],
  tier: 'standard',
  recommendation: null,
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

describe('memory mismatch close', () => {
  it('uses a shorter deliberate hold when reduced motion is requested', () => {
    expect(memoryMismatchHoldMs(false, false)).toBe(MEMORY_MISMATCH_HOLD_MS);
    expect(memoryMismatchHoldMs(true, false)).toBe(REDUCED_MOTION_MISMATCH_HOLD_MS);
    expect(memoryMismatchHoldMs(false, true)).toBe(REDUCED_MOTION_MISMATCH_HOLD_MS);
    expect(REDUCED_MOTION_MISMATCH_HOLD_MS).toBeLessThan(MEMORY_MISMATCH_HOLD_MS);
  });

  it('closes via the timeout even when no transition event ever arrives (WebKit/iPad)', () => {
    const clearTimeout = vi.fn();
    const onClose = vi.fn();
    let runScheduled = (): void => undefined;

    scheduleMemoryMismatchClose(MEMORY_MISMATCH_HOLD_MS, onClose, {
      setTimeout(callback) {
        runScheduled = callback;
        return 42;
      },
      clearTimeout,
    });

    expect(onClose).not.toHaveBeenCalled();
    runScheduled();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(clearTimeout).toHaveBeenCalledWith(42);
  });

  it('closes exactly once when a transition confirms before the timeout fires', () => {
    const clearTimeout = vi.fn();
    const onClose = vi.fn();
    let runScheduled = (): void => undefined;

    const handle = scheduleMemoryMismatchClose(MEMORY_MISMATCH_HOLD_MS, onClose, {
      setTimeout(callback) {
        runScheduled = callback;
        return 7;
      },
      clearTimeout,
    });

    handle.confirm();
    handle.confirm();
    runScheduled();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(clearTimeout).toHaveBeenCalledWith(7);
  });

  it('cancels the pending close so no late update runs after teardown', () => {
    const clearTimeout = vi.fn();
    const onClose = vi.fn();
    let runScheduled = (): void => undefined;

    const handle = scheduleMemoryMismatchClose(MEMORY_MISMATCH_HOLD_MS, onClose, {
      setTimeout(callback) {
        runScheduled = callback;
        return 5;
      },
      clearTimeout,
    });

    handle.cancel();
    runScheduled();
    handle.confirm();

    expect(onClose).not.toHaveBeenCalled();
    expect(clearTimeout).toHaveBeenCalledWith(5);
  });

  describe('with fake timers', () => {
    const timerScheduler = {
      setTimeout: (callback: () => void, delayMs: number): number =>
        globalThis.setTimeout(callback, delayMs) as unknown as number,
      clearTimeout: (timerId: number): void =>
        globalThis.clearTimeout(timerId as unknown as ReturnType<typeof globalThis.setTimeout>),
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('flips the pair back exactly once after the hold with a real timer scheduler', () => {
      const onClose = vi.fn();
      scheduleMemoryMismatchClose(MEMORY_MISMATCH_HOLD_MS, onClose, timerScheduler);

      vi.advanceTimersByTime(MEMORY_MISMATCH_HOLD_MS - 1);
      expect(onClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onClose).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(MEMORY_MISMATCH_HOLD_MS);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close after cancel even once the hold elapses', () => {
      const onClose = vi.fn();
      const handle = scheduleMemoryMismatchClose(MEMORY_MISMATCH_HOLD_MS, onClose, timerScheduler);

      handle.cancel();
      vi.advanceTimersByTime(MEMORY_MISMATCH_HOLD_MS * 2);

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
