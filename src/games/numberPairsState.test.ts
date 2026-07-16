import { describe, expect, it } from 'vitest';
import type { NumberPairsRound } from '../domain/types';
import {
  INITIAL_NUMBER_PAIRS_STATE,
  reduceNumberPairs,
  type NumberPairsState,
} from './numberPairsState';

const round: NumberPairsRound = {
  selectedValues: [1, 2, 3],
  topRow: [2, 1, 3],
  bottomRow: [3, 2, 1],
  promptHe: 'לחץ על הזוגות',
  promptEn: 'Press the pairs',
  signature: '1,2,3|2,1,3|3,2,1',
};

function selectTop(state: NumberPairsState, index: number): NumberPairsState {
  return reduceNumberPairs(state, { type: 'select-top', index }, round);
}

function chooseBottom(state: NumberPairsState, index: number): NumberPairsState {
  return reduceNumberPairs(state, { type: 'choose-bottom', index }, round);
}

describe('number pairs transitions', () => {
  it('selects an unmatched top tile without counting an attempt', () => {
    expect(selectTop(INITIAL_NUMBER_PAIRS_STATE, 0)).toEqual({
      ...INITIAL_NUMBER_PAIRS_STATE,
      selectedTopIndex: 0,
    });
  });

  it('changes the active top tile without penalty', () => {
    const first = selectTop(INITIAL_NUMBER_PAIRS_STATE, 0);
    const changed = selectTop(first, 2);

    expect(changed.selectedTopIndex).toBe(2);
    expect(changed.attempts).toBe(0);
  });

  it('ignores a bottom tap before a top tile is selected', () => {
    expect(chooseBottom(INITIAL_NUMBER_PAIRS_STATE, 1)).toBe(INITIAL_NUMBER_PAIRS_STATE);
  });

  it('matches equal values, locks both tiles, and clears the selection', () => {
    const matched = chooseBottom(selectTop(INITIAL_NUMBER_PAIRS_STATE, 0), 1);

    expect(matched).toMatchObject({
      selectedTopIndex: null,
      matchedTopIndices: [0],
      matchedBottomIndices: [1],
      attempts: 1,
      completed: false,
    });
  });

  it('retains the top selection after a mismatch and marks the wrong bottom tile', () => {
    const mismatched = chooseBottom(selectTop(INITIAL_NUMBER_PAIRS_STATE, 0), 0);

    expect(mismatched).toMatchObject({
      selectedTopIndex: 0,
      wrongBottomIndex: 0,
      attempts: 1,
      completed: false,
    });
  });

  it('ignores already matched top and bottom tiles without adding attempts', () => {
    const matched = chooseBottom(selectTop(INITIAL_NUMBER_PAIRS_STATE, 0), 1);

    expect(selectTop(matched, 0)).toBe(matched);
    expect(chooseBottom(selectTop(matched, 1), 1)).toEqual({
      ...matched,
      selectedTopIndex: 1,
    });
  });

  it('counts every bottom answer attempt, including wrong answers', () => {
    const selected = selectTop(INITIAL_NUMBER_PAIRS_STATE, 0);
    const wrong = chooseBottom(selected, 0);
    const right = chooseBottom(wrong, 1);

    expect(right.attempts).toBe(2);
    expect(right.matchedTopIndices).toEqual([0]);
  });

  it('reports completion only after the final pair is matched', () => {
    let state = chooseBottom(selectTop(INITIAL_NUMBER_PAIRS_STATE, 0), 1);
    state = chooseBottom(selectTop(state, 1), 2);
    expect(state.completed).toBe(false);

    state = chooseBottom(selectTop(state, 2), 0);
    expect(state).toMatchObject({
      matchedTopIndices: [0, 1, 2],
      matchedBottomIndices: [1, 2, 0],
      attempts: 3,
      completed: true,
    });
    expect(selectTop(state, 0)).toBe(state);
  });
});
