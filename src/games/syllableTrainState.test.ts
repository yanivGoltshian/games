import { describe, expect, it } from 'vitest';
import { MAX_COMMUNICATION_OPPORTUNITIES } from '../domain/communicationGame';
import {
  createInitialSyllableTrainState,
  hasWordTrainSessionEnded,
  isPointNearCoupler,
  reduceSyllableTrain,
  SYLLABLE_TRAIN_PHASES,
  WORD_TRAIN_MAX_TRAINS,
  WORD_TRAIN_SESSION_LIMIT_MS,
  type SyllableTrainAction,
  type SyllableTrainPhase,
  type SyllableTrainState,
} from './syllableTrainState';

function inPhase(
  phase: SyllableTrainPhase,
  overrides: Partial<SyllableTrainState> = {},
): SyllableTrainState {
  return {
    ...createInitialSyllableTrainState({ tutorialRequired: false, now: 1_000 }),
    phase,
    ...overrides,
  };
}

function modelToAvailable(): SyllableTrainState {
  return reduceSyllableTrain(inPhase('mandatory-model'), {
    type: 'model-complete',
    now: 2_000,
  });
}

describe('whole-word Train state machine', () => {
  it('declares every required phase and starts in tutorial or stable preparation', () => {
    expect(SYLLABLE_TRAIN_PHASES).toEqual([
      'tutorial',
      'preparation',
      'mandatory-model',
      'available',
      'first-opportunity',
      'second-opportunity',
      'auto-connect',
      'reward',
      'rest',
      'paused',
      'asset-error',
      'session-stop',
    ]);
    expect(createInitialSyllableTrainState({ now: 10 }).phase).toBe('tutorial');
    expect(createInitialSyllableTrainState({
      tutorialRequired: false,
      now: 10,
    })).toMatchObject({
      phase: 'preparation',
      trainsSeen: 1,
      trainsConnected: 0,
      sessionStartedAt: 10,
    });
  });

  it('runs the no-text tutorial sequence and enters the first preparation', () => {
    let state = createInitialSyllableTrainState({ now: 100 });
    state = reduceSyllableTrain(state, { type: 'tutorial-assets-ready' });
    expect(state.tutorialStep).toBe('ready');

    for (const step of ['tap-left', 'tap-right', 'connected', 'lit', 'modeling'] as const) {
      state = reduceSyllableTrain(state, { type: 'tutorial-step', step });
    }
    expect(state).toMatchObject({
      phase: 'tutorial',
      tutorialStep: 'modeling',
      connected: true,
      conceptLit: true,
    });

    state = reduceSyllableTrain(state, { type: 'tutorial-complete', now: 700 });
    expect(state).toMatchObject({
      phase: 'preparation',
      trainsSeen: 1,
      connected: false,
      conceptLit: false,
      roundStartedAt: 700,
    });
  });

  it('lets any tutorial touch interrupt immediately without counting a connection', () => {
    const interrupted = reduceSyllableTrain(
      inPhase('tutorial', {
        tutorialStep: 'tap-right',
        connected: false,
        trainsSeen: 0,
      }),
      { type: 'tutorial-interrupt', now: 1_500 },
    );
    expect(interrupted).toMatchObject({
      phase: 'preparation',
      trainsSeen: 1,
      trainsConnected: 0,
      connected: false,
    });
  });

  it('validates assets before entering the mandatory whole-word model', () => {
    const preparation = inPhase('preparation');
    expect(reduceSyllableTrain(preparation, { type: 'assets-ready' }).phase)
      .toBe('mandatory-model');

    const failed = reduceSyllableTrain(preparation, { type: 'asset-error' });
    expect(failed.phase).toBe('asset-error');
    expect(reduceSyllableTrain(failed, { type: 'retry-assets' }).phase)
      .toBe('preparation');
  });

  it('queues exactly one connection during the mandatory model and connects only after completion', () => {
    const mandatory = inPhase('mandatory-model');
    const pending = reduceSyllableTrain(mandatory, { type: 'request-connect' });
    expect(pending).toMatchObject({
      phase: 'mandatory-model',
      pendingConnect: true,
      connected: false,
      trainsConnected: 0,
    });
    expect(reduceSyllableTrain(pending, { type: 'request-connect' })).toBe(pending);

    const completed = reduceSyllableTrain(pending, {
      type: 'model-complete',
      now: 2_000,
    });
    expect(completed).toMatchObject({
      phase: 'reward',
      pendingConnect: false,
      connected: true,
      conceptLit: true,
      trainsConnected: 1,
    });
  });

  it('opens action only after the mandatory model completes', () => {
    const available = modelToAvailable();
    expect(available).toMatchObject({
      phase: 'available',
      modelCompletedAt: 2_000,
      connected: false,
    });
    const preparation = inPhase('preparation');
    expect(reduceSyllableTrain(preparation, {
      type: 'request-connect',
    })).toBe(preparation);
  });

  it('uses the identical connection transition for tap, drag, voice, and timeout', () => {
    const first = reduceSyllableTrain(modelToAvailable(), {
      type: 'begin-first-opportunity',
    });
    const touch = reduceSyllableTrain(first, { type: 'request-connect' });
    const drag = reduceSyllableTrain(first, { type: 'request-connect' });
    const voice = reduceSyllableTrain(first, { type: 'request-connect' });

    let automatic = reduceSyllableTrain(first, { type: 'opportunity-expired' });
    automatic = reduceSyllableTrain(automatic, { type: 'opportunity-expired' });
    expect(automatic.phase).toBe('auto-connect');
    automatic = reduceSyllableTrain(automatic, { type: 'request-connect' });

    for (const result of [touch, drag, voice, automatic]) {
      expect(result).toMatchObject({
        phase: 'reward',
        connected: true,
        conceptLit: true,
        trainsConnected: 1,
      });
    }
  });

  it('enforces the two-window ceiling with a visual-only second opportunity', () => {
    expect(MAX_COMMUNICATION_OPPORTUNITIES).toBe(2);
    let state = reduceSyllableTrain(modelToAvailable(), {
      type: 'begin-first-opportunity',
    });
    expect(state).toMatchObject({ phase: 'first-opportunity', opportunity: 1 });

    state = reduceSyllableTrain(state, { type: 'opportunity-expired' });
    expect(state).toMatchObject({
      phase: 'second-opportunity',
      opportunity: MAX_COMMUNICATION_OPPORTUNITIES,
    });

    state = reduceSyllableTrain(state, { type: 'opportunity-expired' });
    expect(state.phase).toBe('auto-connect');
    expect(reduceSyllableTrain(state, { type: 'opportunity-expired' })).toBe(state);
  });

  it('gives the first pointer ownership and merges rapid or extra input', () => {
    const available = modelToAvailable();
    const first = reduceSyllableTrain(available, {
      type: 'pointer-begin',
      pointerId: 4,
    });
    expect(first.pointerOwner).toBe(4);
    expect(reduceSyllableTrain(first, {
      type: 'pointer-begin',
      pointerId: 9,
    })).toBe(first);
    expect(reduceSyllableTrain(first, {
      type: 'pointer-move',
      pointerId: 9,
      x: 40,
      y: 20,
    })).toBe(first);

    const moved = reduceSyllableTrain(first, {
      type: 'pointer-move',
      pointerId: 4,
      x: 40,
      y: 20,
    });
    expect(moved.pointerOffset).toEqual({ x: 40, y: 20 });
    const connected = reduceSyllableTrain(moved, { type: 'request-connect' });
    expect(reduceSyllableTrain(connected, { type: 'request-connect' })).toBe(connected);
    expect(connected.trainsConnected).toBe(1);
  });

  it('softly returns a far drag and cancels pointer ownership on orientation', () => {
    let state = reduceSyllableTrain(modelToAvailable(), {
      type: 'pointer-begin',
      pointerId: 1,
    });
    state = reduceSyllableTrain(state, {
      type: 'pointer-end',
      pointerId: 1,
      cancelled: true,
    });
    expect(state).toMatchObject({
      pointerOwner: null,
      pointerOffset: { x: 0, y: 0 },
      dragCancellations: 1,
      connected: false,
    });

    state = reduceSyllableTrain(state, { type: 'pointer-begin', pointerId: 2 });
    state = reduceSyllableTrain(state, { type: 'orientation-change' });
    expect(state).toMatchObject({
      pointerOwner: null,
      dragCancellations: 2,
    });
  });

  it('pauses from every active phase and resumes only at stable preparation', () => {
    for (const phase of SYLLABLE_TRAIN_PHASES.filter(
      (candidate) => candidate !== 'paused' && candidate !== 'session-stop',
    )) {
      const backgrounded = reduceSyllableTrain(
        inPhase(phase, { pointerOwner: 3, pendingConnect: true }),
        { type: 'background' },
      );
      expect(backgrounded).toMatchObject({
        phase: 'paused',
        pointerOwner: null,
        pendingConnect: false,
        advanceRoundOnForeground: phase === 'reward' || phase === 'rest',
      });
      expect(reduceSyllableTrain(backgrounded, {
        type: 'foreground',
        now: 5_000,
      })).toMatchObject({
        phase: 'preparation',
        connected: false,
        roundStartedAt: 5_000,
        trainsSeen: phase === 'reward' || phase === 'rest' ? 2 : 1,
        roundNumber: phase === 'reward' || phase === 'rest' ? 2 : 1,
        advanceRoundOnForeground: false,
      });
    }
  });

  it('stops on foreground after the four-minute limit instead of replaying a paused train', () => {
    const paused = reduceSyllableTrain(
      inPhase('first-opportunity', { sessionStartedAt: 1_000 }),
      { type: 'background' },
    );
    const stopped = reduceSyllableTrain(paused, {
      type: 'foreground',
      now: 1_000 + WORD_TRAIN_SESSION_LIMIT_MS,
    });
    expect(stopped.phase).toBe('session-stop');
  });

  it('ends calmly after five trains or four minutes and never auto-restarts', () => {
    const fifthRest = inPhase('rest', {
      trainsSeen: WORD_TRAIN_MAX_TRAINS,
      sessionStartedAt: 1_000,
    });
    expect(reduceSyllableTrain(fifthRest, {
      type: 'rest-finished',
      now: 2_000,
    }).phase).toBe('session-stop');

    const timedRest = inPhase('rest', {
      trainsSeen: 2,
      sessionStartedAt: 1_000,
    });
    expect(hasWordTrainSessionEnded(
      timedRest,
      1_000 + WORD_TRAIN_SESSION_LIMIT_MS - 1,
    )).toBe(false);
    expect(reduceSyllableTrain(timedRest, {
      type: 'rest-finished',
      now: 1_000 + WORD_TRAIN_SESSION_LIMIT_MS,
    }).phase).toBe('session-stop');

    const stopped = reduceSyllableTrain(timedRest, { type: 'session-timeout' });
    expect(reduceSyllableTrain(stopped, {
      type: 'rest-finished',
      now: 999_999,
    })).toBe(stopped);
  });

  it('advances to rest and the next preparation without clinical counters', () => {
    let state = reduceSyllableTrain(modelToAvailable(), { type: 'request-connect' });
    state = reduceSyllableTrain(state, { type: 'reward-finished' });
    expect(state.phase).toBe('rest');
    state = reduceSyllableTrain(state, { type: 'rest-finished', now: 3_000 });
    expect(state).toMatchObject({
      phase: 'preparation',
      trainsSeen: 2,
      trainsConnected: 1,
      roundNumber: 2,
    });
    expect(state).not.toHaveProperty('attempts');
    expect(state).not.toHaveProperty('correctness');
    expect(state).not.toHaveProperty('mastery');
  });

  it('ignores stale phase callbacks and exhaustively accepts every action shape', () => {
    const stable = inPhase('session-stop');
    const actions: SyllableTrainAction[] = [
      { type: 'tutorial-assets-ready' },
      { type: 'tutorial-step', step: 'tap-left' },
      { type: 'tutorial-complete', now: 1 },
      { type: 'tutorial-interrupt', now: 1 },
      { type: 'assets-ready' },
      { type: 'asset-error' },
      { type: 'retry-assets' },
      { type: 'model-complete', now: 1 },
      { type: 'request-connect' },
      { type: 'begin-first-opportunity' },
      { type: 'opportunity-expired' },
      { type: 'pointer-begin', pointerId: 1 },
      { type: 'pointer-move', pointerId: 1, x: 1, y: 1 },
      { type: 'pointer-end', pointerId: 1, cancelled: true },
      { type: 'orientation-change' },
      { type: 'reward-finished' },
      { type: 'rest-finished', now: 1 },
      { type: 'background' },
      { type: 'foreground', now: 1 },
      { type: 'session-timeout' },
    ];
    for (const action of actions) {
      expect(reduceSyllableTrain(stable, action)).toBe(stable);
    }
    const available = modelToAvailable();
    expect(reduceSyllableTrain(available, {
      type: 'model-complete',
      now: 99_999,
    })).toBe(available);
  });
});

describe('whole-word Train coupling geometry', () => {
  const target = { left: 100, right: 220, top: 100, bottom: 220 };

  it('accepts points in the large target or generous snap radius', () => {
    expect(isPointNearCoupler({ x: 160, y: 160 }, target)).toBe(true);
    expect(isPointNearCoupler({ x: 40, y: 160 }, target, 60)).toBe(true);
    expect(isPointNearCoupler({ x: 39, y: 160 }, target, 60)).toBe(false);
  });
});
