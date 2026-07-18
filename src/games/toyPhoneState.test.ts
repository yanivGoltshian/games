import { describe, expect, it } from 'vitest';
import {
  TOY_PHONE_SESSION_LIMIT_MS,
  TOY_PHONE_SPEECH_GUARD_MS,
  TOY_PHONE_STAGES,
  createInitialToyPhoneState,
  reduceToyPhone,
  toyPhoneGeneration,
  type ToyPhoneOpportunitySignal,
  type ToyPhoneState,
} from './toyPhoneState';

function startSession(
  locale: 'he-IL' | 'en-US' | 'en-GB' = 'he-IL',
  templateOffset = 0,
): ToyPhoneState {
  return reduceToyPhone(createInitialToyPhoneState(), {
    type: 'START_SESSION',
    now: 1_000,
    locale,
    templateOffset,
  });
}

function startCall(locale: 'he-IL' | 'en-US' | 'en-GB' = 'he-IL'): ToyPhoneState {
  const tutorial = startSession(locale);
  return reduceToyPhone(tutorial, {
    type: 'INTERRUPT_TUTORIAL',
    now: 2_000,
    locale,
  });
}

function reachTurn1(locale: 'he-IL' | 'en-US' | 'en-GB' = 'he-IL'): ToyPhoneState {
  let state = startCall(locale);
  state = reduceToyPhone(state, {
    type: 'ANSWER',
    now: 2_300,
    generation: toyPhoneGeneration(state),
  });
  state = reduceToyPhone(state, {
    type: 'ANSWERING_DONE',
    generation: toyPhoneGeneration(state),
  });
  state = reduceToyPhone(state, {
    type: 'MANDATORY_COMPLETED',
    now: 3_000,
    generation: toyPhoneGeneration(state),
  });
  return reduceToyPhone(state, {
    type: 'GUARD_READY',
    now: 3_000 + TOY_PHONE_SPEECH_GUARD_MS,
    generation: toyPhoneGeneration(state),
  });
}

function completeCall(state: ToyPhoneState, now: number): ToyPhoneState {
  let current = state;
  if (current.stage === 'ringing') {
    current = reduceToyPhone(current, {
      type: 'ANSWER',
      now,
      generation: toyPhoneGeneration(current),
    });
  }
  if (current.stage === 'answering') {
    current = reduceToyPhone(current, {
      type: 'ANSWERING_DONE',
      generation: toyPhoneGeneration(current),
    });
  }
  current = reduceToyPhone(current, {
    type: 'MANDATORY_COMPLETED',
    now: now + 10,
    generation: toyPhoneGeneration(current),
  });
  current = reduceToyPhone(current, {
    type: 'GUARD_READY',
    now: now + 10 + TOY_PHONE_SPEECH_GUARD_MS,
    generation: toyPhoneGeneration(current),
  });
  current = reduceToyPhone(current, {
    type: 'COMPLETE_OPPORTUNITY',
    signal: 'touch',
    generation: toyPhoneGeneration(current),
  });
  current = reduceToyPhone(current, {
    type: 'MANDATORY_COMPLETED',
    now: now + 500,
    generation: toyPhoneGeneration(current),
  });
  current = reduceToyPhone(current, {
    type: 'GUARD_READY',
    now: now + 500 + TOY_PHONE_SPEECH_GUARD_MS,
    generation: toyPhoneGeneration(current),
  });
  current = reduceToyPhone(current, {
    type: 'COMPLETE_OPPORTUNITY',
    signal: 'timeout',
    generation: toyPhoneGeneration(current),
  });
  return reduceToyPhone(current, {
    type: 'MANDATORY_COMPLETED',
    now: now + 1_000,
    generation: toyPhoneGeneration(current),
  });
}

describe('Toy Phone state machine', () => {
  it('declares every required stage exactly once', () => {
    expect(TOY_PHONE_STAGES).toEqual([
      'tutorial', 'idle', 'ringing', 'answering', 'greeting', 'guard1', 'turn1',
      'request', 'guard2', 'turn2', 'goodbye', 'reward', 'rest', 'paused',
      'asset-error', 'session-stop',
    ]);
    expect(new Set(TOY_PHONE_STAGES).size).toBe(TOY_PHONE_STAGES.length);
  });

  it('runs the wordless demo in order and lets any child touch interrupt it immediately', () => {
    let demo = startSession();
    for (const expected of ['mascot-answer', 'greeting', 'request', 'goodbye'] as const) {
      demo = reduceToyPhone(demo, {
        type: 'TUTORIAL_ADVANCE',
        generation: toyPhoneGeneration(demo),
      });
      expect(demo.tutorialStep).toBe(expected);
    }
    demo = reduceToyPhone(demo, {
      type: 'TUTORIAL_ADVANCE',
      generation: toyPhoneGeneration(demo),
    });
    expect(demo).toMatchObject({ stage: 'idle', autoRingAllowed: true });

    const interrupted = reduceToyPhone(startSession('en-GB'), {
      type: 'INTERRUPT_TUTORIAL',
      now: 2_000,
      locale: 'en-GB',
    });
    expect(interrupted).toMatchObject({
      stage: 'ringing',
      locale: 'en-GB',
      callGeneration: 1,
      callsCompleted: 0,
    });
  });

  it('answers one ringing call once even after ten rapid taps', () => {
    let state = startCall();
    const generation = toyPhoneGeneration(state);
    for (let index = 0; index < 10; index += 1) {
      state = reduceToyPhone(state, {
        type: 'ANSWER',
        now: 2_250,
        generation,
      });
    }
    expect(state).toMatchObject({
      stage: 'answering',
      callGeneration: 1,
      callsCompleted: 0,
      lastAnswerLatencyMs: 250,
      answerMetricGeneration: 1,
    });
  });

  it('requires true greeting completion and the full 400 ms guard', () => {
    let state = startCall();
    state = reduceToyPhone(state, {
      type: 'ANSWER',
      now: 2_100,
      generation: toyPhoneGeneration(state),
    });
    state = reduceToyPhone(state, {
      type: 'ANSWERING_DONE',
      generation: toyPhoneGeneration(state),
    });
    expect(state.stage).toBe('greeting');

    state = reduceToyPhone(state, {
      type: 'MANDATORY_COMPLETED',
      now: 3_000,
      generation: toyPhoneGeneration(state),
    });
    expect(state.stage).toBe('guard1');
    const at399 = reduceToyPhone(state, {
      type: 'GUARD_READY',
      now: 3_399,
      generation: toyPhoneGeneration(state),
    });
    expect(at399).toBe(state);
    expect(reduceToyPhone(state, {
      type: 'GUARD_READY',
      now: 3_400,
      generation: toyPhoneGeneration(state),
    }).stage).toBe('turn1');
  });

  it('keeps one latest touch during mandatory speech and consumes it only after the guard', () => {
    let state = startCall();
    state = reduceToyPhone(state, {
      type: 'ANSWER',
      now: 2_100,
      generation: toyPhoneGeneration(state),
    });
    state = reduceToyPhone(state, {
      type: 'ANSWERING_DONE',
      generation: toyPhoneGeneration(state),
    });
    const intentGeneration = toyPhoneGeneration(state);
    state = reduceToyPhone(state, { type: 'CHILD_INTENT', generation: intentGeneration });
    const duplicate = reduceToyPhone(state, { type: 'CHILD_INTENT', generation: intentGeneration });
    expect(duplicate).toBe(state);
    state = reduceToyPhone(state, {
      type: 'MANDATORY_COMPLETED',
      now: 3_000,
      generation: intentGeneration,
    });
    expect(state).toMatchObject({ stage: 'guard1', pendingIntent: true });
    state = reduceToyPhone(state, {
      type: 'GUARD_READY',
      now: 3_400,
      generation: toyPhoneGeneration(state),
    });
    expect(state).toMatchObject({ stage: 'request', pendingIntent: false });
  });

  it('makes touch, coarse effort, and timeout produce the identical transition', () => {
    const turn = reachTurn1();
    const nextStates = (['touch', 'effort', 'timeout'] satisfies ToyPhoneOpportunitySignal[])
      .map((signal) => reduceToyPhone(turn, {
        type: 'COMPLETE_OPPORTUNITY',
        signal,
        generation: toyPhoneGeneration(turn),
      }));
    expect(nextStates[0]).toEqual(nextStates[1]);
    expect(nextStates[1]).toEqual(nextStates[2]);
    expect(nextStates[0]).toMatchObject({ stage: 'request', pendingIntent: false });
    expect(nextStates[0]).not.toHaveProperty('completionMethod');
    expect(nextStates[0]).not.toHaveProperty('effort');
  });

  it('keeps one exact locale for the complete call', () => {
    let state = reachTurn1('en-GB');
    expect(state.locale).toBe('en-GB');
    state = reduceToyPhone(state, {
      type: 'COMPLETE_OPPORTUNITY',
      signal: 'touch',
      generation: toyPhoneGeneration(state),
    });
    state = reduceToyPhone(state, {
      type: 'MANDATORY_COMPLETED',
      now: 5_000,
      generation: toyPhoneGeneration(state),
    });
    expect(state.locale).toBe('en-GB');
  });

  it('makes every reviewed template reachable while advancing calls within one session', () => {
    const firstTemplates = Array.from({ length: 6 }, (_, templateOffset) => {
      const session = startSession('en-US', templateOffset);
      return reduceToyPhone(session, {
        type: 'INTERRUPT_TUTORIAL',
        now: 2_000,
        locale: 'en-US',
      }).currentTemplateIndex;
    });
    expect(firstTemplates).toEqual([0, 1, 2, 3, 4, 5]);

    let state = reduceToyPhone(startSession('en-US', 4), {
      type: 'INTERRUPT_TUTORIAL',
      now: 2_000,
      locale: 'en-US',
    });
    expect(state.currentTemplateIndex).toBe(4);
    state = completeCall(state, 10_000);
    state = reduceToyPhone(state, {
      type: 'REWARD_DONE',
      generation: toyPhoneGeneration(state),
    });
    state = reduceToyPhone(state, {
      type: 'REST_DONE',
      now: 15_000,
      locale: 'en-US',
      generation: toyPhoneGeneration(state),
    });
    expect(state.currentTemplateIndex).toBe(5);
  });

  it('makes stale audio, timer, and input completions no-ops after pause', () => {
    const greeting = reduceToyPhone(
      reduceToyPhone(startCall(), {
        type: 'ANSWER',
        now: 2_100,
        generation: toyPhoneGeneration(startCall()),
      }),
      {
        type: 'ANSWERING_DONE',
        generation: { session: 1, call: 1, step: 3 },
      },
    );
    const stale = toyPhoneGeneration(greeting);
    const paused = reduceToyPhone(greeting, { type: 'PAUSE' });
    expect(paused.stage).toBe('paused');
    expect(reduceToyPhone(paused, {
      type: 'MANDATORY_COMPLETED',
      now: 4_000,
      generation: stale,
    })).toBe(paused);
    const idle = reduceToyPhone(paused, {
      type: 'PAUSE_SETTLED',
      generation: toyPhoneGeneration(paused),
    });
    expect(idle).toMatchObject({ stage: 'idle', autoRingAllowed: false });
  });

  it('stops after three complete calls and never starts a fourth', () => {
    let state = startCall();
    for (let call = 0; call < 3; call += 1) {
      state = completeCall(state, 10_000 + call * 10_000);
      expect(state.stage).toBe('reward');
      state = reduceToyPhone(state, {
        type: 'REWARD_DONE',
        generation: toyPhoneGeneration(state),
      });
      if (call < 2) {
        expect(state.stage).toBe('rest');
        state = reduceToyPhone(state, {
          type: 'REST_DONE',
          now: 15_000 + call * 10_000,
          locale: 'he-IL',
          generation: toyPhoneGeneration(state),
        });
        expect(state.stage).toBe('ringing');
      }
    }
    expect(state).toMatchObject({
      stage: 'session-stop',
      callsCompleted: 3,
      stopReason: 'three-calls',
    });
    expect(reduceToyPhone(state, {
      type: 'START_RING',
      now: 99_000,
      locale: 'he-IL',
      automatic: true,
      generation: toyPhoneGeneration(state),
    })).toBe(state);
  });

  it('enforces the four-minute ceiling at the exact boundary', () => {
    const state = startCall();
    const before = reduceToyPhone(state, {
      type: 'SESSION_TIMEOUT',
      now: 1_000 + TOY_PHONE_SESSION_LIMIT_MS - 1,
      sessionGeneration: state.sessionGeneration,
    });
    expect(before).toBe(state);
    expect(reduceToyPhone(state, {
      type: 'SESSION_TIMEOUT',
      now: 1_000 + TOY_PHONE_SESSION_LIMIT_MS,
      sessionGeneration: state.sessionGeneration,
    })).toMatchObject({
      stage: 'session-stop',
      stopReason: 'four-minutes',
    });
  });

  it('ignores stage-specific actions in every other stage', () => {
    for (const stage of TOY_PHONE_STAGES) {
      const state = { ...startSession(), stage };
      const result = reduceToyPhone(state, {
        type: 'ANSWER',
        now: 5_000,
        generation: toyPhoneGeneration(state),
      });
      if (stage === 'ringing') {
        expect(result.stage).toBe('answering');
      } else {
        expect(result).toBe(state);
      }
    }
  });
});
