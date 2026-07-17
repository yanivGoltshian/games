/**
 * Pure state logic for the "Syllable Train" game.
 *
 * A word arrives as a train. The locomotive already carries the first syllable;
 * Sean couples the loose car (the remaining syllable) to it. We track how far
 * the loose car has been dragged toward the locomotive as `progress` (0..1).
 * Once `progress` reaches {@link SYLLABLE_TRAIN_COUPLE_THRESHOLD} the cars lock
 * and we move to `success`. `couple` is an explicit shortcut — a single tap or
 * keyboard press couples immediately, which keeps the game completable for
 * toddlers and on devices without precise pointers.
 *
 * Like the other games, every case returns the *same* reference when nothing
 * changes so React re-renders stay minimal.
 */

export type SyllableTrainPhase = 'intro' | 'connecting' | 'success';

export interface SyllableTrainState {
  phase: SyllableTrainPhase;
  /** How far the loose car has been dragged toward coupling (0..1). */
  progress: number;
  /** How many coupling attempts Sean has started this round. */
  attempts: number;
}

export type SyllableTrainAction =
  | { type: 'grab' }
  | { type: 'drag'; progress: number }
  | { type: 'release' }
  | { type: 'couple' }
  | { type: 'reset' };

/** Fraction of the coupling distance that snaps the cars together. */
export const SYLLABLE_TRAIN_COUPLE_THRESHOLD = 0.72;

export const INITIAL_SYLLABLE_TRAIN_STATE: SyllableTrainState = {
  phase: 'intro',
  progress: 0,
  attempts: 0,
};

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  if (progress < 0) {
    return 0;
  }
  if (progress > 1) {
    return 1;
  }
  return progress;
}

export function reduceSyllableTrain(
  state: SyllableTrainState,
  action: SyllableTrainAction,
): SyllableTrainState {
  switch (action.type) {
    case 'reset': {
      const isPristine =
        state.phase === 'intro' && state.progress === 0 && state.attempts === 0;
      return isPristine ? state : INITIAL_SYLLABLE_TRAIN_STATE;
    }

    case 'grab': {
      if (state.phase === 'success') {
        return state;
      }
      return {
        phase: 'connecting',
        progress: 0,
        attempts: state.attempts + 1,
      };
    }

    case 'drag': {
      if (state.phase !== 'connecting') {
        return state;
      }
      const progress = clampProgress(action.progress);
      if (progress >= SYLLABLE_TRAIN_COUPLE_THRESHOLD) {
        return {
          phase: 'success',
          progress: 1,
          attempts: state.attempts,
        };
      }
      if (progress === state.progress) {
        return state;
      }
      return {
        ...state,
        progress,
      };
    }

    case 'release': {
      if (state.phase !== 'connecting' || state.progress === 0) {
        return state;
      }
      return {
        ...state,
        progress: 0,
      };
    }

    case 'couple': {
      if (state.phase === 'success') {
        return state;
      }
      return {
        phase: 'success',
        progress: 1,
        attempts: state.phase === 'intro' ? state.attempts + 1 : state.attempts,
      };
    }

    default:
      return state;
  }
}

/** Progress toward coupling, clamped 0..1 (always 1 once coupled). */
export function selectCoupleProgress(state: SyllableTrainState): number {
  if (state.phase === 'success') {
    return 1;
  }
  return clampProgress(state.progress);
}
