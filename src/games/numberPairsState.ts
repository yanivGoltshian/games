import type { NumberPairsRound } from '../domain/types';

export interface NumberPairsState {
  selectedTopIndex: number | null;
  selectedBottomIndex: number | null;
  matchedTopIndices: readonly number[];
  matchedBottomIndices: readonly number[];
  wrongTopIndex: number | null;
  wrongBottomIndex: number | null;
  attempts: number;
  completed: boolean;
}

export type NumberPairsAction =
  | { type: 'select-top'; index: number }
  | { type: 'select-bottom'; index: number }
  | { type: 'clear-wrong' };

export const INITIAL_NUMBER_PAIRS_STATE: NumberPairsState = {
  selectedTopIndex: null,
  selectedBottomIndex: null,
  matchedTopIndices: [],
  matchedBottomIndices: [],
  wrongTopIndex: null,
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
    return state.wrongTopIndex === null && state.wrongBottomIndex === null
      ? state
      : { ...state, wrongTopIndex: null, wrongBottomIndex: null };
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
    
    // If a bottom is already selected, check for a match
    if (state.selectedBottomIndex !== null) {
      const attempts = state.attempts + 1;
      if (round.topRow[action.index] !== round.bottomRow[state.selectedBottomIndex]) {
        return {
          ...state,
          attempts,
          wrongTopIndex: action.index,
          // keep the bottom selected so they can try another top, or clear?
          // The current behavior was to mark the second choice as wrong and keep the first selected.
          // Wait, actually current behavior:
          // selectedTopIndex remains. wrongBottomIndex is set.
          // So here: selectedBottomIndex remains, wrongTopIndex is set.
        };
      }
      const matchedTopIndices = [...state.matchedTopIndices, action.index];
      const matchedBottomIndices = [...state.matchedBottomIndices, state.selectedBottomIndex];
      return {
        selectedTopIndex: null,
        selectedBottomIndex: null,
        matchedTopIndices,
        matchedBottomIndices,
        wrongTopIndex: null,
        wrongBottomIndex: null,
        attempts,
        completed: matchedTopIndices.length === round.topRow.length,
      };
    }

    // Otherwise just select the top
    return {
      ...state,
      selectedTopIndex: action.index,
      selectedBottomIndex: null,
      wrongTopIndex: null,
      wrongBottomIndex: null,
    };
  }

  if (action.type === 'select-bottom') {
    if (
      !isValidIndex(round.bottomRow, action.index)
      || state.matchedBottomIndices.includes(action.index)
      || state.selectedBottomIndex === action.index
    ) {
      return state;
    }

    // If a top is already selected, check for a match
    if (state.selectedTopIndex !== null) {
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
        selectedBottomIndex: null,
        matchedTopIndices,
        matchedBottomIndices,
        wrongTopIndex: null,
        wrongBottomIndex: null,
        attempts,
        completed: matchedTopIndices.length === round.topRow.length,
      };
    }

    // Otherwise just select the bottom
    return {
      ...state,
      selectedTopIndex: null,
      selectedBottomIndex: action.index,
      wrongTopIndex: null,
      wrongBottomIndex: null,
    };
  }

  return state;
}
