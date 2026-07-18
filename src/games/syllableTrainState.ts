import { MAX_COMMUNICATION_OPPORTUNITIES } from '../domain/communicationGame';

export const WORD_TRAIN_FIRST_OPPORTUNITY_MS = 5_000;
export const WORD_TRAIN_SECOND_OPPORTUNITY_MS = 4_000;
export const WORD_TRAIN_REWARD_MS = 1_100;
export const WORD_TRAIN_REST_MS = 650;
export const WORD_TRAIN_MAX_TRAINS = 5;
export const WORD_TRAIN_SESSION_LIMIT_MS = 4 * 60 * 1_000;
export const WORD_TRAIN_SNAP_RADIUS_PX = 150;

export const SYLLABLE_TRAIN_PHASES = [
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
] as const;

export type SyllableTrainPhase = (typeof SYLLABLE_TRAIN_PHASES)[number];
export type WordTrainTutorialStep =
  | 'waiting'
  | 'ready'
  | 'tap-left'
  | 'tap-right'
  | 'connected'
  | 'lit'
  | 'modeling';

export interface SyllableTrainState {
  phase: SyllableTrainPhase;
  tutorialStep: WordTrainTutorialStep;
  pendingConnect: boolean;
  connected: boolean;
  conceptLit: boolean;
  opportunity: 0 | 1 | 2;
  pointerOwner: number | null;
  pointerOffset: Readonly<{ x: number; y: number }>;
  trainsSeen: number;
  trainsConnected: number;
  dragCancellations: number;
  roundNumber: number;
  sessionStartedAt: number;
  roundStartedAt: number;
  modelCompletedAt: number | null;
  assetErrorReturn: 'tutorial' | 'preparation';
  advanceRoundOnForeground: boolean;
}

export interface CreateSyllableTrainStateOptions {
  tutorialRequired?: boolean;
  now?: number;
}

export type SyllableTrainAction =
  | { type: 'tutorial-assets-ready' }
  | { type: 'tutorial-step'; step: Exclude<WordTrainTutorialStep, 'waiting' | 'ready'> }
  | { type: 'tutorial-complete'; now: number }
  | { type: 'tutorial-interrupt'; now: number }
  | { type: 'assets-ready' }
  | { type: 'asset-error' }
  | { type: 'retry-assets' }
  | { type: 'model-complete'; now: number }
  | { type: 'request-connect' }
  | { type: 'begin-first-opportunity' }
  | { type: 'opportunity-expired' }
  | { type: 'pointer-begin'; pointerId: number }
  | { type: 'pointer-move'; pointerId: number; x: number; y: number }
  | { type: 'pointer-end'; pointerId: number; cancelled: boolean }
  | { type: 'orientation-change' }
  | { type: 'reward-finished' }
  | { type: 'rest-finished'; now: number }
  | { type: 'background' }
  | { type: 'foreground'; now: number }
  | { type: 'session-timeout' };

const ZERO_OFFSET = Object.freeze({ x: 0, y: 0 });

export function createInitialSyllableTrainState(
  options: CreateSyllableTrainStateOptions = {},
): SyllableTrainState {
  const now = options.now ?? Date.now();
  const tutorialRequired = options.tutorialRequired ?? true;
  return {
    phase: tutorialRequired ? 'tutorial' : 'preparation',
    tutorialStep: 'waiting',
    pendingConnect: false,
    connected: false,
    conceptLit: false,
    opportunity: 0,
    pointerOwner: null,
    pointerOffset: ZERO_OFFSET,
    trainsSeen: tutorialRequired ? 0 : 1,
    trainsConnected: 0,
    dragCancellations: 0,
    roundNumber: 1,
    sessionStartedAt: now,
    roundStartedAt: now,
    modelCompletedAt: null,
    assetErrorReturn: tutorialRequired ? 'tutorial' : 'preparation',
    advanceRoundOnForeground: false,
  };
}

export const INITIAL_SYLLABLE_TRAIN_STATE = createInitialSyllableTrainState({ now: 0 });

function isActionPhase(phase: SyllableTrainPhase): boolean {
  return (
    phase === 'available'
    || phase === 'first-opportunity'
    || phase === 'second-opportunity'
  );
}

function resetRoundInteraction(
  state: SyllableTrainState,
  phase: SyllableTrainPhase,
): SyllableTrainState {
  return {
    ...state,
    phase,
    tutorialStep: 'waiting',
    pendingConnect: false,
    connected: false,
    conceptLit: false,
    opportunity: 0,
    pointerOwner: null,
    pointerOffset: ZERO_OFFSET,
    modelCompletedAt: null,
    advanceRoundOnForeground: false,
  };
}

function connect(state: SyllableTrainState): SyllableTrainState {
  if (state.connected || state.phase === 'reward' || state.phase === 'rest') {
    return state;
  }
  if (
    !isActionPhase(state.phase)
    && state.phase !== 'auto-connect'
    && state.phase !== 'mandatory-model'
  ) {
    return state;
  }
  if (state.phase === 'mandatory-model') {
    return state.pendingConnect ? state : { ...state, pendingConnect: true };
  }
  return {
    ...state,
    phase: 'reward',
    pendingConnect: false,
    connected: true,
    conceptLit: true,
    pointerOwner: null,
    pointerOffset: ZERO_OFFSET,
    trainsConnected: state.trainsConnected + 1,
  };
}

export function hasWordTrainSessionEnded(
  state: Pick<SyllableTrainState, 'trainsSeen' | 'sessionStartedAt'>,
  now: number,
): boolean {
  return (
    state.trainsSeen >= WORD_TRAIN_MAX_TRAINS
    || now - state.sessionStartedAt >= WORD_TRAIN_SESSION_LIMIT_MS
  );
}

export function isPointNearCoupler(
  point: Readonly<{ x: number; y: number }>,
  rect: Readonly<{ left: number; right: number; top: number; bottom: number }>,
  radius = WORD_TRAIN_SNAP_RADIUS_PX,
): boolean {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy) <= radius;
}

export function reduceSyllableTrain(
  state: SyllableTrainState,
  action: SyllableTrainAction,
): SyllableTrainState {
  switch (action.type) {
    case 'tutorial-assets-ready':
      return state.phase === 'tutorial' && state.tutorialStep === 'waiting'
        ? { ...state, tutorialStep: 'ready' }
        : state;

    case 'tutorial-step':
      return state.phase === 'tutorial' && state.tutorialStep !== action.step
        ? {
          ...state,
          tutorialStep: action.step,
          connected: action.step === 'connected' || action.step === 'lit' || action.step === 'modeling',
          conceptLit: action.step === 'lit' || action.step === 'modeling',
        }
        : state;

    case 'tutorial-complete':
    case 'tutorial-interrupt':
      return state.phase === 'tutorial'
        ? {
          ...resetRoundInteraction(state, 'preparation'),
          trainsSeen: 1,
          roundStartedAt: action.now,
          assetErrorReturn: 'preparation',
        }
        : state;

    case 'assets-ready':
      return state.phase === 'preparation'
        ? { ...state, phase: 'mandatory-model', assetErrorReturn: 'preparation' }
        : state;

    case 'asset-error': {
      if (
        state.phase === 'session-stop'
        || state.phase === 'paused'
        || state.phase === 'asset-error'
      ) {
        return state;
      }
      return {
        ...state,
        phase: 'asset-error',
        assetErrorReturn: state.phase === 'tutorial' ? 'tutorial' : 'preparation',
        pointerOwner: null,
        pointerOffset: ZERO_OFFSET,
      };
    }

    case 'retry-assets':
      return state.phase === 'asset-error'
        ? resetRoundInteraction(state, state.assetErrorReturn)
        : state;

    case 'model-complete': {
      if (state.phase !== 'mandatory-model') {
        return state;
      }
      const available = {
        ...state,
        phase: 'available' as const,
        modelCompletedAt: action.now,
      };
      return state.pendingConnect ? connect(available) : available;
    }

    case 'request-connect':
      return connect(state);

    case 'begin-first-opportunity':
      return state.phase === 'available'
        ? {
          ...state,
          phase: 'first-opportunity',
          opportunity: Math.min(1, MAX_COMMUNICATION_OPPORTUNITIES) as 1,
        }
        : state;

    case 'opportunity-expired':
      if (state.phase === 'first-opportunity') {
        return {
          ...state,
          phase: 'second-opportunity',
          opportunity: MAX_COMMUNICATION_OPPORTUNITIES,
          pointerOwner: null,
          pointerOffset: ZERO_OFFSET,
        };
      }
      return state.phase === 'second-opportunity'
        ? {
          ...state,
          phase: 'auto-connect',
          pointerOwner: null,
          pointerOffset: ZERO_OFFSET,
        }
        : state;

    case 'pointer-begin':
      return isActionPhase(state.phase) && state.pointerOwner === null
        ? { ...state, pointerOwner: action.pointerId, pointerOffset: ZERO_OFFSET }
        : state;

    case 'pointer-move':
      if (state.pointerOwner !== action.pointerId || !isActionPhase(state.phase)) {
        return state;
      }
      if (
        state.pointerOffset.x === action.x
        && state.pointerOffset.y === action.y
      ) {
        return state;
      }
      return { ...state, pointerOffset: { x: action.x, y: action.y } };

    case 'pointer-end':
      if (state.pointerOwner !== action.pointerId) {
        return state;
      }
      return {
        ...state,
        pointerOwner: null,
        pointerOffset: ZERO_OFFSET,
        dragCancellations: state.dragCancellations + (action.cancelled ? 1 : 0),
      };

    case 'orientation-change':
      return state.pointerOwner === null
        ? state
        : {
          ...state,
          pointerOwner: null,
          pointerOffset: ZERO_OFFSET,
          dragCancellations: state.dragCancellations + 1,
        };

    case 'reward-finished':
      return state.phase === 'reward' ? { ...state, phase: 'rest' } : state;

    case 'rest-finished':
      if (state.phase !== 'rest') {
        return state;
      }
      if (hasWordTrainSessionEnded(state, action.now)) {
        return {
          ...state,
          phase: 'session-stop',
          pointerOwner: null,
          pointerOffset: ZERO_OFFSET,
        };
      }
      return {
        ...resetRoundInteraction(state, 'preparation'),
        trainsSeen: state.trainsSeen + 1,
        roundNumber: state.roundNumber + 1,
        roundStartedAt: action.now,
        assetErrorReturn: 'preparation',
      };

    case 'background':
      return state.phase === 'session-stop' || state.phase === 'paused'
        ? state
        : {
          ...state,
          phase: 'paused',
          pendingConnect: false,
          pointerOwner: null,
          pointerOffset: ZERO_OFFSET,
          advanceRoundOnForeground: state.phase === 'reward' || state.phase === 'rest',
        };

    case 'foreground':
      if (state.phase !== 'paused') {
        return state;
      }
      if (hasWordTrainSessionEnded(state, action.now)) {
        return {
          ...state,
          phase: 'session-stop',
          pendingConnect: false,
          connected: false,
          conceptLit: false,
          pointerOwner: null,
          pointerOffset: ZERO_OFFSET,
          advanceRoundOnForeground: false,
        };
      }
      return {
        ...resetRoundInteraction(state, 'preparation'),
        trainsSeen: state.advanceRoundOnForeground
          ? state.trainsSeen + 1
          : Math.max(1, state.trainsSeen),
        roundNumber: state.advanceRoundOnForeground
          ? state.roundNumber + 1
          : state.roundNumber,
        roundStartedAt: action.now,
        assetErrorReturn: 'preparation',
      };

    case 'session-timeout':
      return state.phase === 'session-stop'
        ? state
        : {
          ...state,
          phase: 'session-stop',
          pendingConnect: false,
          pointerOwner: null,
          pointerOffset: ZERO_OFFSET,
        };
  }
}
