import { describe, expect, it } from 'vitest';
import {
  INITIAL_SILLY_ALIEN_STATE,
  reduceSillyAlien,
  selectEffortProgress,
  SILLY_ALIEN_EFFORT_TARGET_MS,
  SILLY_ALIEN_LEVEL_THRESHOLD,
  type SillyAlienState,
} from './sillyAlienState';

/** Build an unlocked state in an arbitrary phase for focused transition tests. */
function make(overrides: Partial<SillyAlienState> = {}): SillyAlienState {
  return {
    phase: 'listening',
    unlocked: true,
    micDenied: false,
    effortMs: 0,
    currentLevel: 0,
    listenAttempts: 1,
    nudges: 0,
    ...overrides,
  };
}

describe('silly alien — unlock + round lifecycle', () => {
  it('starts locked, not unlocked, with no effort', () => {
    expect(INITIAL_SILLY_ALIEN_STATE).toEqual({
      phase: 'locked',
      unlocked: false,
      micDenied: false,
      effortMs: 0,
      currentLevel: 0,
      listenAttempts: 0,
      nudges: 0,
    });
  });

  it('unlock with mic granted moves to presenting and latches unlocked', () => {
    const next = reduceSillyAlien(INITIAL_SILLY_ALIEN_STATE, {
      type: 'unlock',
      micGranted: true,
    });
    expect(next.phase).toBe('presenting');
    expect(next.unlocked).toBe(true);
    expect(next.micDenied).toBe(false);
  });

  it('unlock with mic denied latches micDenied but still presents first', () => {
    const next = reduceSillyAlien(INITIAL_SILLY_ALIEN_STATE, {
      type: 'unlock',
      micGranted: false,
    });
    expect(next.phase).toBe('presenting');
    expect(next.micDenied).toBe(true);
  });

  it('unlock is idempotent once already unlocked (same reference)', () => {
    const unlocked = make({ phase: 'listening' });
    expect(reduceSillyAlien(unlocked, { type: 'unlock', micGranted: true })).toBe(unlocked);
  });

  it('begin-round is ignored while still locked (same reference)', () => {
    expect(reduceSillyAlien(INITIAL_SILLY_ALIEN_STATE, { type: 'begin-round' })).toBe(
      INITIAL_SILLY_ALIEN_STATE,
    );
  });

  it('begin-round replays the gag on a new word, resetting per-round counters', () => {
    const midRound = make({
      phase: 'success',
      effortMs: SILLY_ALIEN_EFFORT_TARGET_MS,
      currentLevel: 0.4,
      listenAttempts: 3,
      nudges: 2,
    });
    const next = reduceSillyAlien(midRound, { type: 'begin-round' });
    expect(next).toEqual({
      phase: 'presenting',
      unlocked: true,
      micDenied: false,
      effortMs: 0,
      currentLevel: 0,
      listenAttempts: 0,
      nudges: 0,
    });
  });

  it('begin-round preserves the micDenied latch across rounds', () => {
    const denied = make({ phase: 'success', micDenied: true });
    const next = reduceSillyAlien(denied, { type: 'begin-round' });
    expect(next.micDenied).toBe(true);
    expect(next.phase).toBe('presenting');
  });
});

describe('silly alien — present-done gate (speech finished)', () => {
  it('opens the mic and counts a listen attempt when the mic is available', () => {
    const presenting = make({ phase: 'presenting', listenAttempts: 0 });
    const next = reduceSillyAlien(presenting, { type: 'present-done' });
    expect(next.phase).toBe('listening');
    expect(next.listenAttempts).toBe(1);
  });

  it('routes to the parent fallback when the mic was denied', () => {
    const presenting = make({ phase: 'presenting', micDenied: true });
    const next = reduceSillyAlien(presenting, { type: 'present-done' });
    expect(next.phase).toBe('parentFallback');
  });

  it('ignores present-done outside the presenting phase (same reference)', () => {
    const listening = make({ phase: 'listening' });
    expect(reduceSillyAlien(listening, { type: 'present-done' })).toBe(listening);
  });
});

describe('silly alien — effort accumulation', () => {
  it('accumulates only above-threshold effort', () => {
    const listening = make({ effortMs: 0 });
    const quiet = reduceSillyAlien(listening, {
      type: 'register-effort',
      level: SILLY_ALIEN_LEVEL_THRESHOLD - 0.01,
      deltaMs: 100,
    });
    expect(quiet.effortMs).toBe(0);
    const loud = reduceSillyAlien(quiet, {
      type: 'register-effort',
      level: SILLY_ALIEN_LEVEL_THRESHOLD + 0.2,
      deltaMs: 100,
    });
    expect(loud.effortMs).toBe(100);
  });

  it('ignores effort unless listening and keeps the same reference', () => {
    const presenting = make({ phase: 'presenting' });
    expect(
      reduceSillyAlien(presenting, { type: 'register-effort', level: 0.9, deltaMs: 100 }),
    ).toBe(presenting);
  });

  it('returns the same reference when a repeated sample changes nothing', () => {
    const listening = make({ currentLevel: 0, effortMs: 0 });
    const next = reduceSillyAlien(listening, {
      type: 'register-effort',
      level: 0,
      deltaMs: 16,
    });
    expect(next).toBe(listening);
  });

  it('reaches success once enough effort accumulates and caps the total', () => {
    const almost = make({ effortMs: SILLY_ALIEN_EFFORT_TARGET_MS - 50 });
    const next = reduceSillyAlien(almost, {
      type: 'register-effort',
      level: 0.5,
      deltaMs: 200,
    });
    expect(next.phase).toBe('success');
    expect(next.effortMs).toBe(SILLY_ALIEN_EFFORT_TARGET_MS);
  });

  it('clamps out-of-range levels and non-finite deltas', () => {
    const listening = make({ effortMs: 0 });
    const clamped = reduceSillyAlien(listening, {
      type: 'register-effort',
      level: 5,
      deltaMs: Number.NaN,
    });
    expect(clamped.currentLevel).toBe(1);
    expect(clamped.effortMs).toBe(0);
  });
});

describe('silly alien — supportive nudges (no failure framing)', () => {
  it('a listen timeout moves to a gentle nudge and counts it', () => {
    const listening = make({ phase: 'listening', nudges: 0 });
    const next = reduceSillyAlien(listening, { type: 'listen-timeout' });
    expect(next.phase).toBe('nudge');
    expect(next.nudges).toBe(1);
  });

  it('ignores a listen timeout when not listening (same reference)', () => {
    const nudge = make({ phase: 'nudge' });
    expect(reduceSillyAlien(nudge, { type: 'listen-timeout' })).toBe(nudge);
  });

  it('finishing a nudge re-opens the mic for another attempt', () => {
    const nudge = make({ phase: 'nudge', listenAttempts: 1, effortMs: 0 });
    const next = reduceSillyAlien(nudge, { type: 'nudge-done' });
    expect(next.phase).toBe('listening');
    expect(next.listenAttempts).toBe(2);
  });

  it('ignores nudge-done outside the nudge phase (same reference)', () => {
    const listening = make({ phase: 'listening' });
    expect(reduceSillyAlien(listening, { type: 'nudge-done' })).toBe(listening);
  });
});

describe('silly alien — microphone denial + success shortcuts', () => {
  it('mic-denied routes to the parent fallback from any live phase', () => {
    const listening = make({ phase: 'listening' });
    const next = reduceSillyAlien(listening, { type: 'mic-denied' });
    expect(next.phase).toBe('parentFallback');
    expect(next.micDenied).toBe(true);
  });

  it('mic-denied never overrides an already-celebrated round (same reference)', () => {
    const success = make({ phase: 'success', effortMs: SILLY_ALIEN_EFFORT_TARGET_MS });
    expect(reduceSillyAlien(success, { type: 'mic-denied' })).toBe(success);
  });

  it('mic-denied is idempotent once in the fallback (same reference)', () => {
    const fallback = make({ phase: 'parentFallback', micDenied: true });
    expect(reduceSillyAlien(fallback, { type: 'mic-denied' })).toBe(fallback);
  });

  it('succeed forces success from the parent fallback tap', () => {
    const fallback = make({ phase: 'parentFallback', micDenied: true });
    const next = reduceSillyAlien(fallback, { type: 'succeed' });
    expect(next.phase).toBe('success');
    expect(next.effortMs).toBe(SILLY_ALIEN_EFFORT_TARGET_MS);
  });

  it('keeps the same reference when success actions repeat', () => {
    const success = make({ phase: 'success', effortMs: SILLY_ALIEN_EFFORT_TARGET_MS });
    expect(reduceSillyAlien(success, { type: 'succeed' })).toBe(success);
  });
});

describe('silly alien — reset', () => {
  it('resets back to the locked initial state from mid-round', () => {
    const midRound = make({ phase: 'listening', effortMs: 400, nudges: 2 });
    expect(reduceSillyAlien(midRound, { type: 'reset' })).toBe(INITIAL_SILLY_ALIEN_STATE);
  });

  it('no-ops when already pristine (same reference)', () => {
    expect(reduceSillyAlien(INITIAL_SILLY_ALIEN_STATE, { type: 'reset' })).toBe(
      INITIAL_SILLY_ALIEN_STATE,
    );
  });
});

describe('selectEffortProgress', () => {
  it('is zero before any effort', () => {
    expect(selectEffortProgress(make({ effortMs: 0 }))).toBe(0);
  });

  it('reports the clamped ratio while listening', () => {
    const half = make({ effortMs: SILLY_ALIEN_EFFORT_TARGET_MS / 2 });
    expect(selectEffortProgress(half)).toBeCloseTo(0.5, 5);
  });

  it('is one once success is reached', () => {
    expect(selectEffortProgress(make({ phase: 'success' }))).toBe(1);
  });
});
