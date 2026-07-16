import { describe, expect, it } from 'vitest';
import { createTouchZoomGuard } from './touchZoomGuard';

function createTouch(identifier: number, clientX: number, clientY: number) {
  return { identifier, clientX, clientY };
}

function createTouches(...touches: Array<ReturnType<typeof createTouch>>): TouchList {
  return touches as unknown as TouchList;
}

describe('touch zoom guard', () => {
  it('keeps single-finger drag interactions unprevented', () => {
    const guard = createTouchZoomGuard();
    const target = {} as EventTarget;

    expect(
      guard.handleTouchStart({
        target,
        touches: createTouches(createTouch(1, 24, 24)),
        changedTouches: createTouches(createTouch(1, 24, 24)),
        timeStamp: 1000,
      }),
    ).toBe(false);

    expect(
      guard.handleTouchMove({
        target,
        touches: createTouches(createTouch(1, 60, 68)),
        changedTouches: createTouches(createTouch(1, 60, 68)),
        timeStamp: 1080,
      }),
    ).toBe(false);

    expect(
      guard.handleTouchEnd({
        target,
        touches: createTouches(),
        changedTouches: createTouches(createTouch(1, 60, 68)),
        timeStamp: 1140,
      }),
    ).toBe(false);
  });

  it('prevents a qualifying second stationary tap', () => {
    const guard = createTouchZoomGuard();
    const target = {} as EventTarget;

    expect(
      guard.handleTouchStart({
        target,
        touches: createTouches(createTouch(1, 40, 40)),
        changedTouches: createTouches(createTouch(1, 40, 40)),
        timeStamp: 2000,
      }),
    ).toBe(false);

    expect(
      guard.handleTouchEnd({
        target,
        touches: createTouches(),
        changedTouches: createTouches(createTouch(1, 40, 40)),
        timeStamp: 2080,
      }),
    ).toBe(false);

    expect(
      guard.handleTouchStart({
        target,
        touches: createTouches(createTouch(1, 42, 41)),
        changedTouches: createTouches(createTouch(1, 42, 41)),
        timeStamp: 2240,
      }),
    ).toBe(false);

    expect(
      guard.handleTouchEnd({
        target,
        touches: createTouches(),
        changedTouches: createTouches(createTouch(1, 42, 41)),
        timeStamp: 2300,
      }),
    ).toBe(true);
  });

  it('prevents gesturestart, gesturechange, and gestureend', () => {
    const guard = createTouchZoomGuard();

    expect(guard.handleGestureEvent()).toBe(true);
    expect(guard.handleGestureEvent()).toBe(true);
    expect(guard.handleGestureEvent()).toBe(true);
  });
});
