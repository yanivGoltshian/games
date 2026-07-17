import { describe, expect, it } from 'vitest';
import {
  INITIAL_SILLY_ALIEN_STATE,
  reduceSillyAlien,
  selectEffortProgress,
  SILLY_ALIEN_EFFORT_TARGET_MS,
  SILLY_ALIEN_LEVEL_THRESHOLD,
  type SillyAlienState,
} from './sillyAlienState';

function listening(overrides: Partial<SillyAlienState> = {}): SillyAlienState {
  return {
    phase: 'listening',
    effortMs: 0,
    currentLevel: 0,
    listenAttempts: 1,
    ...overrides,
  };
}

describe('silly alien transitions', () => {
  it('starts in the intro phase with no effort', () => {
    expect(INITIAL_SILLY_ALIEN_STATE).toEqual({
      phase: 'intro',
      effortMs: 0,
      currentLevel: 0,
      listenAttempts: 0,
    });
  });

  it('begins listening, resetting effort and counting the attempt', () => {
    const next = reduceSillyAlien(INITIAL_SILLY_ALIEN_STATE, { type: 'begin-listening' });

    expect(next).toEqual({
      phase: 'listening',
      effortMs: 0,
      currentLevel: 0,
      listenAttempts: 1,
    });
  });

  it('counts each listening restart and clears prior effort', () => {
    const partial = listening({ effortMs: 400, currentLevel: 0.3, listenAttempts: 1 });
    const restarted = reduceSillyAlien(partial, { type: 'begin-listening' });

    expect(restarted).toEqual({
      phase: 'listening',
      effortMs: 0,
      currentLevel: 0,
      listenAttempts: 2,
    });
  });

  it('ignores effort while not listening and keeps the same reference', () => {
    const next = reduceSillyAlien(INITIAL_SILLY_ALIEN_STATE, {
      type: 'register-effort',
      level: 0.9,
      deltaMs: 500,
    });

    expect(next).toBe(INITIAL_SILLY_ALIEN_STATE);
  });

  it('accumulates only above-threshold effort', () => {
    const start = listening();
    const loud = reduceSillyAlien(start, {
      type: 'register-effort',
      level: SILLY_ALIEN_LEVEL_THRESHOLD + 0.2,
      deltaMs: 300,
    });

    expect(loud.effortMs).toBe(300);
    expect(loud.currentLevel).toBeCloseTo(SILLY_ALIEN_LEVEL_THRESHOLD + 0.2);
  });

  it('tracks the live level but adds no effort below threshold', () => {
    const start = listening();
    const quiet = reduceSillyAlien(start, {
      type: 'register-effort',
      level: SILLY_ALIEN_LEVEL_THRESHOLD - 0.02,
      deltaMs: 300,
    });

    expect(quiet.effortMs).toBe(0);
    expect(quiet.currentLevel).toBeCloseTo(SILLY_ALIEN_LEVEL_THRESHOLD - 0.02);
  });

  it('returns the same reference when a repeated sample changes nothing', () => {
    const start = listening();
    const first = reduceSillyAlien(start, { type: 'register-effort', level: 0, deltaMs: 16 });

    expect(first).toBe(start);
  });

  it('reaches success once enough effort accumulates and caps the total', () => {
    let state = listening();
    state = reduceSillyAlien(state, { type: 'register-effort', level: 0.5, deltaMs: 300 });
    state = reduceSillyAlien(state, { type: 'register-effort', level: 0.5, deltaMs: 300 });
    expect(state.phase).toBe('listening');

    state = reduceSillyAlien(state, { type: 'register-effort', level: 0.5, deltaMs: 300 });
    expect(state.phase).toBe('success');
    expect(state.effortMs).toBe(SILLY_ALIEN_EFFORT_TARGET_MS);
  });

  it('clamps out-of-range levels and non-finite deltas', () => {
    const start = listening();
    const over = reduceSillyAlien(start, { type: 'register-effort', level: 5, deltaMs: 100 });
    expect(over.currentLevel).toBe(1);
    expect(over.effortMs).toBe(100);

    const under = reduceSillyAlien(start, { type: 'register-effort', level: -3, deltaMs: 100 });
    expect(under.currentLevel).toBe(0);
    expect(under.effortMs).toBe(0);

    const nanDelta = reduceSillyAlien(start, {
      type: 'register-effort',
      level: 0.9,
      deltaMs: Number.NaN,
    });
    expect(nanDelta.effortMs).toBe(0);
    expect(nanDelta.currentLevel).toBeCloseTo(0.9);
  });

  it('forces success on the explicit tap fallback', () => {
    const forced = reduceSillyAlien(listening({ effortMs: 120 }), { type: 'succeed' });

    expect(forced.phase).toBe('success');
    expect(forced.effortMs).toBe(SILLY_ALIEN_EFFORT_TARGET_MS);
  });

  it('keeps the same reference when success actions repeat', () => {
    const success = reduceSillyAlien(listening(), { type: 'succeed' });

    expect(reduceSillyAlien(success, { type: 'succeed' })).toBe(success);
    expect(reduceSillyAlien(success, { type: 'begin-listening' })).toBe(success);
    expect(
      reduceSillyAlien(success, { type: 'register-effort', level: 0.9, deltaMs: 200 }),
    ).toBe(success);
  });

  it('resets back to intro from success but no-ops when pristine', () => {
    const success = reduceSillyAlien(listening(), { type: 'succeed' });

    expect(reduceSillyAlien(success, { type: 'reset' })).toEqual(INITIAL_SILLY_ALIEN_STATE);
    expect(reduceSillyAlien(INITIAL_SILLY_ALIEN_STATE, { type: 'reset' })).toBe(
      INITIAL_SILLY_ALIEN_STATE,
    );
  });
});

describe('selectEffortProgress', () => {
  it('is zero before any effort', () => {
    expect(selectEffortProgress(INITIAL_SILLY_ALIEN_STATE)).toBe(0);
  });

  it('reports the clamped ratio while listening', () => {
    const half = listening({ effortMs: SILLY_ALIEN_EFFORT_TARGET_MS / 2 });
    expect(selectEffortProgress(half)).toBeCloseTo(0.5);
  });

  it('is one once success is reached', () => {
    const success = reduceSillyAlien(listening(), { type: 'succeed' });
    expect(selectEffortProgress(success)).toBe(1);
  });
});
