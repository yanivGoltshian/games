import type { NumberPairsRound } from '../domain/types';

export interface NumberPairsState {
  selectedTopIndex: number | null;
  matchedTopIndices: readonly number[];
  matchedBottomIndices: readonly number[];
  wrongBottomIndex: number | null;
  attempts: number;
  completed: boolean;
}

export type NumberPairsAction =
  | { type: 'select-top'; index: number }
  | { type: 'choose-bottom'; index: number }
  | { type: 'clear-wrong' };

export const INITIAL_NUMBER_PAIRS_STATE: NumberPairsState = {
  selectedTopIndex: null,
  matchedTopIndices: [],
  matchedBottomIndices: [],
  wrongBottomIndex: null,
  attempts: 0,
  completed: false,
};

function isValidIndex(row: readonly number[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < row.length;
}

export function reduceNumberPairs(
  state: NumberPairsState,
  action: NumberPairsAction,
  round: Pick<NumberPairsRound, 'topRow' | 'bottomRow'>,
): NumberPairsState {
  if (action.type === 'clear-wrong') {
    return state.wrongBottomIndex === null ? state : { ...state, wrongBottomIndex: null };
  }

  if (state.completed) {
    return state;
  }

  if (action.type === 'select-top') {
    if (
      !isValidIndex(round.topRow, action.index)
      || state.matchedTopIndices.includes(action.index)
      || state.selectedTopIndex === action.index
    ) {
      return state;
    }
    return {
      ...state,
      selectedTopIndex: action.index,
      wrongBottomIndex: null,
    };
  }

  if (
    state.selectedTopIndex === null
    || !isValidIndex(round.bottomRow, action.index)
    || state.matchedBottomIndices.includes(action.index)
  ) {
    return state;
  }

  const attempts = state.attempts + 1;
  if (round.topRow[state.selectedTopIndex] !== round.bottomRow[action.index]) {
    return {
      ...state,
      attempts,
      wrongBottomIndex: action.index,
    };
  }

  const matchedTopIndices = [...state.matchedTopIndices, state.selectedTopIndex];
  const matchedBottomIndices = [...state.matchedBottomIndices, action.index];
  return {
    selectedTopIndex: null,
    matchedTopIndices,
    matchedBottomIndices,
    wrongBottomIndex: null,
    attempts,
    completed: matchedTopIndices.length === round.topRow.length,
  };
}
