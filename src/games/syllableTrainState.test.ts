import { describe, expect, it } from 'vitest';
import {
  INITIAL_SYLLABLE_TRAIN_STATE,
  reduceSyllableTrain,
  selectCoupleProgress,
  SYLLABLE_TRAIN_COUPLE_THRESHOLD,
  type SyllableTrainState,
} from './syllableTrainState';

function connecting(overrides: Partial<SyllableTrainState> = {}): SyllableTrainState {
  return {
    phase: 'connecting',
    progress: 0,
    attempts: 1,
    ...overrides,
  };
}

describe('syllable train transitions', () => {
  it('starts in the intro phase with no progress', () => {
    expect(INITIAL_SYLLABLE_TRAIN_STATE).toEqual({
      phase: 'intro',
      progress: 0,
      attempts: 0,
    });
  });

  it('grabs into connecting, clearing progress and counting the attempt', () => {
    const next = reduceSyllableTrain(INITIAL_SYLLABLE_TRAIN_STATE, { type: 'grab' });

    expect(next).toEqual({
      phase: 'connecting',
      progress: 0,
      attempts: 1,
    });
  });

  it('counts each fresh grab and clears prior progress', () => {
    const partial = connecting({ progress: 0.4, attempts: 1 });
    const regrabbed = reduceSyllableTrain(partial, { type: 'grab' });

    expect(regrabbed).toEqual({
      phase: 'connecting',
      progress: 0,
      attempts: 2,
    });
  });

  it('ignores a grab once coupled and keeps the same reference', () => {
    const success = reduceSyllableTrain(connecting(), { type: 'couple' });

    expect(reduceSyllableTrain(success, { type: 'grab' })).toBe(success);
  });

  it('ignores drag while not connecting and keeps the same reference', () => {
    const next = reduceSyllableTrain(INITIAL_SYLLABLE_TRAIN_STATE, {
      type: 'drag',
      progress: 0.5,
    });

    expect(next).toBe(INITIAL_SYLLABLE_TRAIN_STATE);
  });

  it('accumulates below-threshold drag without coupling', () => {
    const start = connecting();
    const dragged = reduceSyllableTrain(start, {
      type: 'drag',
      progress: SYLLABLE_TRAIN_COUPLE_THRESHOLD - 0.1,
    });

    expect(dragged.phase).toBe('connecting');
    expect(dragged.progress).toBeCloseTo(SYLLABLE_TRAIN_COUPLE_THRESHOLD - 0.1);
    expect(dragged.attempts).toBe(start.attempts);
  });

  it('returns the same reference when a repeated drag sample changes nothing', () => {
    const start = connecting({ progress: 0.3 });
    const repeated = reduceSyllableTrain(start, { type: 'drag', progress: 0.3 });

    expect(repeated).toBe(start);
  });

  it('couples once the drag crosses the threshold and pins progress to one', () => {
    const start = connecting({ attempts: 2 });
    const coupled = reduceSyllableTrain(start, {
      type: 'drag',
      progress: SYLLABLE_TRAIN_COUPLE_THRESHOLD,
    });

    expect(coupled.phase).toBe('success');
    expect(coupled.progress).toBe(1);
    expect(coupled.attempts).toBe(2);
  });

  it('clamps out-of-range and non-finite drag samples', () => {
    const start = connecting();

    const over = reduceSyllableTrain(start, { type: 'drag', progress: 5 });
    expect(over.phase).toBe('success');
    expect(over.progress).toBe(1);

    const under = reduceSyllableTrain(start, { type: 'drag', progress: -3 });
    expect(under.progress).toBe(0);
    expect(under).toBe(start);

    const nan = reduceSyllableTrain(connecting({ progress: 0.2 }), {
      type: 'drag',
      progress: Number.NaN,
    });
    expect(nan.progress).toBe(0);
  });

  it('releases a partial drag back to zero but no-ops when nothing was dragged', () => {
    const dragged = connecting({ progress: 0.5 });
    const released = reduceSyllableTrain(dragged, { type: 'release' });
    expect(released.progress).toBe(0);
    expect(released.phase).toBe('connecting');

    const untouched = connecting({ progress: 0 });
    expect(reduceSyllableTrain(untouched, { type: 'release' })).toBe(untouched);
    expect(reduceSyllableTrain(INITIAL_SYLLABLE_TRAIN_STATE, { type: 'release' })).toBe(
      INITIAL_SYLLABLE_TRAIN_STATE,
    );
  });

  it('couples immediately from intro via the explicit tap and counts the attempt', () => {
    const coupled = reduceSyllableTrain(INITIAL_SYLLABLE_TRAIN_STATE, { type: 'couple' });

    expect(coupled).toEqual({
      phase: 'success',
      progress: 1,
      attempts: 1,
    });
  });

  it('couples from connecting without double-counting the in-flight attempt', () => {
    const coupled = reduceSyllableTrain(connecting({ attempts: 1 }), { type: 'couple' });

    expect(coupled.phase).toBe('success');
    expect(coupled.attempts).toBe(1);
  });

  it('keeps the same reference when coupling actions repeat', () => {
    const success = reduceSyllableTrain(connecting(), { type: 'couple' });

    expect(reduceSyllableTrain(success, { type: 'couple' })).toBe(success);
    expect(reduceSyllableTrain(success, { type: 'drag', progress: 0.9 })).toBe(success);
    expect(reduceSyllableTrain(success, { type: 'release' })).toBe(success);
  });

  it('resets back to intro from success but no-ops when pristine', () => {
    const success = reduceSyllableTrain(connecting(), { type: 'couple' });

    expect(reduceSyllableTrain(success, { type: 'reset' })).toEqual(INITIAL_SYLLABLE_TRAIN_STATE);
    expect(reduceSyllableTrain(INITIAL_SYLLABLE_TRAIN_STATE, { type: 'reset' })).toBe(
      INITIAL_SYLLABLE_TRAIN_STATE,
    );
  });
});

describe('selectCoupleProgress', () => {
  it('is zero before any drag', () => {
    expect(selectCoupleProgress(INITIAL_SYLLABLE_TRAIN_STATE)).toBe(0);
  });

  it('reports the clamped drag progress while connecting', () => {
    expect(selectCoupleProgress(connecting({ progress: 0.5 }))).toBeCloseTo(0.5);
    expect(selectCoupleProgress(connecting({ progress: 4 }))).toBe(1);
  });

  it('is one once coupled', () => {
    const success = reduceSyllableTrain(connecting(), { type: 'couple' });
    expect(selectCoupleProgress(success)).toBe(1);
  });
});
