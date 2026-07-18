import type { SpeechLocale } from '../domain/types';

export const TOY_PHONE_MAX_CALLS = 3;
export const TOY_PHONE_SESSION_LIMIT_MS = 4 * 60 * 1000;
export const TOY_PHONE_SPEECH_GUARD_MS = 400;
export const TOY_PHONE_AUTO_ANSWER_MS = 5_000;
export const TOY_PHONE_TURN_TIMEOUT_MS = 6_000;

export const TOY_PHONE_STAGES = [
  'tutorial',
  'idle',
  'ringing',
  'answering',
  'greeting',
  'guard1',
  'turn1',
  'request',
  'guard2',
  'turn2',
  'goodbye',
  'reward',
  'rest',
  'paused',
  'asset-error',
  'session-stop',
] as const;

export type ToyPhoneStage = (typeof TOY_PHONE_STAGES)[number];
export type ToyPhoneTutorialStep =
  | 'ringing'
  | 'mascot-answer'
  | 'greeting'
  | 'request'
  | 'goodbye';
export type ToyPhoneStopReason = 'three-calls' | 'four-minutes';
export type ToyPhoneOpportunitySignal = 'touch' | 'effort' | 'timeout';

export interface ToyPhoneGeneration {
  session: number;
  call: number;
  step: number;
}

export interface ToyPhoneState {
  stage: ToyPhoneStage;
  tutorialStep: ToyPhoneTutorialStep | null;
  sessionGeneration: number;
  callGeneration: number;
  stepGeneration: number;
  sessionStartedAt: number | null;
  callsCompleted: number;
  sessionTemplateOffset: number;
  currentTemplateIndex: number;
  locale: SpeechLocale;
  ringStartedAt: number | null;
  guardUntil: number | null;
  pendingIntent: boolean;
  autoRingAllowed: boolean;
  lastAnswerLatencyMs: number | null;
  answerMetricGeneration: number;
  stopReason: ToyPhoneStopReason | null;
}

export type ToyPhoneAction =
  | { type: 'START_SESSION'; now: number; locale: SpeechLocale; templateOffset: number }
  | { type: 'ASSET_ERROR' }
  | { type: 'INTERRUPT_TUTORIAL'; now: number; locale: SpeechLocale }
  | { type: 'TUTORIAL_ADVANCE'; generation: ToyPhoneGeneration }
  | { type: 'START_RING'; now: number; locale: SpeechLocale; automatic: boolean; generation: ToyPhoneGeneration }
  | { type: 'ANSWER'; now: number; generation: ToyPhoneGeneration }
  | { type: 'ANSWERING_DONE'; generation: ToyPhoneGeneration }
  | { type: 'MANDATORY_COMPLETED'; now: number; generation: ToyPhoneGeneration }
  | { type: 'CHILD_INTENT'; generation: ToyPhoneGeneration }
  | { type: 'GUARD_READY'; now: number; generation: ToyPhoneGeneration }
  | {
    type: 'COMPLETE_OPPORTUNITY';
    signal: ToyPhoneOpportunitySignal;
    generation: ToyPhoneGeneration;
  }
  | { type: 'REWARD_DONE'; generation: ToyPhoneGeneration }
  | { type: 'REST_DONE'; now: number; locale: SpeechLocale; generation: ToyPhoneGeneration }
  | { type: 'PAUSE' }
  | { type: 'PAUSE_SETTLED'; generation: ToyPhoneGeneration }
  | { type: 'SESSION_TIMEOUT'; now: number; sessionGeneration: number };

export function createInitialToyPhoneState(): ToyPhoneState {
  return {
    stage: 'tutorial',
    tutorialStep: 'ringing',
    sessionGeneration: 0,
    callGeneration: 0,
    stepGeneration: 0,
    sessionStartedAt: null,
    callsCompleted: 0,
    sessionTemplateOffset: 0,
    currentTemplateIndex: 0,
    locale: 'he-IL',
    ringStartedAt: null,
    guardUntil: null,
    pendingIntent: false,
    autoRingAllowed: false,
    lastAnswerLatencyMs: null,
    answerMetricGeneration: 0,
    stopReason: null,
  };
}

export function toyPhoneGeneration(state: ToyPhoneState): ToyPhoneGeneration {
  return {
    session: state.sessionGeneration,
    call: state.callGeneration,
    step: state.stepGeneration,
  };
}

function owns(state: ToyPhoneState, generation: ToyPhoneGeneration): boolean {
  return (
    generation.session === state.sessionGeneration
    && generation.call === state.callGeneration
    && generation.step === state.stepGeneration
  );
}

function transition(
  state: ToyPhoneState,
  stage: ToyPhoneStage,
  patch: Partial<ToyPhoneState> = {},
): ToyPhoneState {
  return {
    ...state,
    stage,
    stepGeneration: state.stepGeneration + 1,
    guardUntil: null,
    ...patch,
  };
}

function startRing(
  state: ToyPhoneState,
  now: number,
  locale: SpeechLocale,
): ToyPhoneState {
  return {
    ...transition(state, 'ringing'),
    tutorialStep: null,
    callGeneration: state.callGeneration + 1,
    currentTemplateIndex: (state.sessionTemplateOffset + state.callsCompleted) % 6,
    locale,
    ringStartedAt: now,
    pendingIntent: false,
    autoRingAllowed: false,
    stopReason: null,
  };
}

function stopSession(state: ToyPhoneState, reason: ToyPhoneStopReason): ToyPhoneState {
  return {
    ...transition(state, 'session-stop'),
    callGeneration: state.callGeneration + 1,
    tutorialStep: null,
    ringStartedAt: null,
    pendingIntent: false,
    autoRingAllowed: false,
    stopReason: reason,
  };
}

export function reduceToyPhone(
  state: ToyPhoneState,
  action: ToyPhoneAction,
): ToyPhoneState {
  switch (action.type) {
    case 'START_SESSION':
      if (state.sessionStartedAt !== null || state.stage === 'asset-error') {
        return state;
      }
      return {
        ...state,
        stage: 'tutorial',
        tutorialStep: 'ringing',
        sessionGeneration: state.sessionGeneration + 1,
        stepGeneration: state.stepGeneration + 1,
        sessionStartedAt: action.now,
        sessionTemplateOffset: Math.max(0, Math.min(5, Math.floor(action.templateOffset))),
        locale: action.locale,
      };

    case 'ASSET_ERROR':
      if (state.stage === 'asset-error') {
        return state;
      }
      return {
        ...transition(state, 'asset-error'),
        sessionGeneration: state.sessionGeneration + 1,
        callGeneration: state.callGeneration + 1,
        tutorialStep: null,
        ringStartedAt: null,
        pendingIntent: false,
        autoRingAllowed: false,
      };

    case 'INTERRUPT_TUTORIAL':
      return state.stage === 'tutorial'
        ? startRing(state, action.now, action.locale)
        : state;

    case 'TUTORIAL_ADVANCE':
      if (state.stage !== 'tutorial' || !owns(state, action.generation)) {
        return state;
      }
      switch (state.tutorialStep) {
        case 'ringing':
          return transition(state, 'tutorial', { tutorialStep: 'mascot-answer' });
        case 'mascot-answer':
          return transition(state, 'tutorial', { tutorialStep: 'greeting' });
        case 'greeting':
          return transition(state, 'tutorial', { tutorialStep: 'request' });
        case 'request':
          return transition(state, 'tutorial', { tutorialStep: 'goodbye' });
        case 'goodbye':
          return transition(state, 'idle', {
            tutorialStep: null,
            autoRingAllowed: true,
          });
        default:
          return state;
      }

    case 'START_RING':
      if (
        state.stage !== 'idle'
        || !owns(state, action.generation)
        || (action.automatic && !state.autoRingAllowed)
      ) {
        return state;
      }
      return startRing(state, action.now, action.locale);

    case 'ANSWER':
      if (state.stage !== 'ringing' || !owns(state, action.generation)) {
        return state;
      }
      return transition(state, 'answering', {
        ringStartedAt: null,
        lastAnswerLatencyMs: Math.max(0, action.now - (state.ringStartedAt ?? action.now)),
        answerMetricGeneration: state.answerMetricGeneration + 1,
      });

    case 'ANSWERING_DONE':
      return state.stage === 'answering' && owns(state, action.generation)
        ? transition(state, 'greeting', { pendingIntent: false })
        : state;

    case 'MANDATORY_COMPLETED':
      if (!owns(state, action.generation)) {
        return state;
      }
      if (state.stage === 'greeting') {
        return transition(state, 'guard1', {
          guardUntil: action.now + TOY_PHONE_SPEECH_GUARD_MS,
        });
      }
      if (state.stage === 'request') {
        return transition(state, 'guard2', {
          guardUntil: action.now + TOY_PHONE_SPEECH_GUARD_MS,
        });
      }
      if (state.stage === 'goodbye') {
        return transition(state, 'reward', {
          callsCompleted: state.callsCompleted + 1,
          pendingIntent: false,
        });
      }
      return state;

    case 'CHILD_INTENT':
      if (!owns(state, action.generation)) {
        return state;
      }
      if (state.stage === 'greeting' || state.stage === 'request' || state.stage === 'goodbye') {
        return state.pendingIntent ? state : { ...state, pendingIntent: true };
      }
      if (state.stage === 'turn1') {
        return transition(state, 'request', { pendingIntent: false });
      }
      if (state.stage === 'turn2') {
        return transition(state, 'goodbye', { pendingIntent: false });
      }
      return state;

    case 'GUARD_READY':
      if (
        !owns(state, action.generation)
        || state.guardUntil === null
        || action.now < state.guardUntil
      ) {
        return state;
      }
      if (state.stage === 'guard1') {
        return transition(state, state.pendingIntent ? 'request' : 'turn1', {
          pendingIntent: false,
        });
      }
      if (state.stage === 'guard2') {
        return transition(state, state.pendingIntent ? 'goodbye' : 'turn2', {
          pendingIntent: false,
        });
      }
      return state;

    case 'COMPLETE_OPPORTUNITY':
      if (!owns(state, action.generation)) {
        return state;
      }
      if (state.stage === 'turn1') {
        return transition(state, 'request', { pendingIntent: false });
      }
      if (state.stage === 'turn2') {
        return transition(state, 'goodbye', { pendingIntent: false });
      }
      return state;

    case 'REWARD_DONE':
      if (state.stage !== 'reward' || !owns(state, action.generation)) {
        return state;
      }
      return state.callsCompleted >= TOY_PHONE_MAX_CALLS
        ? stopSession(state, 'three-calls')
        : transition(state, 'rest');

    case 'REST_DONE':
      if (state.stage !== 'rest' || !owns(state, action.generation)) {
        return state;
      }
      return startRing(state, action.now, action.locale);

    case 'PAUSE':
      if (
        state.stage === 'paused'
        || state.stage === 'asset-error'
        || state.stage === 'session-stop'
      ) {
        return state;
      }
      return {
        ...transition(state, 'paused'),
        callGeneration: state.callGeneration + 1,
        tutorialStep: null,
        ringStartedAt: null,
        pendingIntent: false,
        autoRingAllowed: false,
      };

    case 'PAUSE_SETTLED':
      return state.stage === 'paused' && owns(state, action.generation)
        ? transition(state, 'idle', { autoRingAllowed: false })
        : state;

    case 'SESSION_TIMEOUT':
      if (
        action.sessionGeneration !== state.sessionGeneration
        || state.sessionStartedAt === null
        || action.now - state.sessionStartedAt < TOY_PHONE_SESSION_LIMIT_MS
        || state.stage === 'asset-error'
        || state.stage === 'session-stop'
      ) {
        return state;
      }
      return stopSession(state, 'four-minutes');
  }
}
