/**
 * Pure state logic for the "Silly Alien" game.
 *
 * The alien has dropped the first syllable of a word and the child is asked to say
 * the whole word. We open the microphone and accumulate *vocal effort*: every
 * animation frame the component measures a normalised RMS level (0..1) and feeds
 * it here as `register-effort` with the elapsed milliseconds since the previous
 * frame. Time only counts while the level is at or above a small threshold, so
 * background hiss doesn't fill the bar but a toddler's "taaaa-puach!" does.
 *
 * Once enough above-threshold time accumulates we move to `success`. `succeed`
 * is an explicit shortcut (a friendly tap fallback for quiet rooms or devices
 * without microphone access). Everything is a pure function that returns the
 * *same* reference when nothing changes, so React re-renders stay minimal.
 */

export type SillyAlienPhase = 'intro' | 'listening' | 'success';

export interface SillyAlienState {
  phase: SillyAlienPhase;
  /** Accumulated milliseconds of at-or-above-threshold vocal effort. */
  effortMs: number;
  /** Latest normalised microphone level (0..1) for real-time visuals. */
  currentLevel: number;
  /** How many times listening has been (re)started this round. */
  listenAttempts: number;
}

export type SillyAlienAction =
  | { type: 'begin-listening' }
  | { type: 'register-effort'; level: number; deltaMs: number }
  | { type: 'succeed' }
  | { type: 'reset' };

/** Minimum normalised RMS level we treat as intentional voice (not room hiss). */
export const SILLY_ALIEN_LEVEL_THRESHOLD = 0.08;

/** Cumulative above-threshold time (ms) needed before the alien "gets it". */
export const SILLY_ALIEN_EFFORT_TARGET_MS = 800;

export const INITIAL_SILLY_ALIEN_STATE: SillyAlienState = {
  phase: 'intro',
  effortMs: 0,
  currentLevel: 0,
  listenAttempts: 0,
};

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 0;
  }
  if (level < 0) {
    return 0;
  }
  if (level > 1) {
    return 1;
  }
  return level;
}

export function reduceSillyAlien(
  state: SillyAlienState,
  action: SillyAlienAction,
): SillyAlienState {
  switch (action.type) {
    case 'reset': {
      const isPristine =
        state.phase === 'intro'
        && state.effortMs === 0
        && state.currentLevel === 0
        && state.listenAttempts === 0;
      return isPristine ? state : INITIAL_SILLY_ALIEN_STATE;
    }

    case 'begin-listening': {
      if (state.phase === 'success') {
        return state;
      }
      return {
        phase: 'listening',
        effortMs: 0,
        currentLevel: 0,
        listenAttempts: state.listenAttempts + 1,
      };
    }

    case 'register-effort': {
      if (state.phase !== 'listening') {
        return state;
      }
      const level = clampLevel(action.level);
      const delta = Number.isFinite(action.deltaMs) ? Math.max(0, action.deltaMs) : 0;
      const nextEffort =
        level >= SILLY_ALIEN_LEVEL_THRESHOLD ? state.effortMs + delta : state.effortMs;

      if (nextEffort >= SILLY_ALIEN_EFFORT_TARGET_MS) {
        return {
          phase: 'success',
          effortMs: SILLY_ALIEN_EFFORT_TARGET_MS,
          currentLevel: level,
          listenAttempts: state.listenAttempts,
        };
      }

      if (level === state.currentLevel && nextEffort === state.effortMs) {
        return state;
      }

      return {
        ...state,
        currentLevel: level,
        effortMs: nextEffort,
      };
    }

    case 'succeed': {
      if (state.phase === 'success') {
        return state;
      }
      return {
        ...state,
        phase: 'success',
        effortMs: SILLY_ALIEN_EFFORT_TARGET_MS,
      };
    }

    default:
      return state;
  }
}

/** Progress toward success, clamped 0..1 (always 1 once succeeded). */
export function selectEffortProgress(state: SillyAlienState): number {
  if (state.phase === 'success') {
    return 1;
  }
  const ratio = state.effortMs / SILLY_ALIEN_EFFORT_TARGET_MS;
  if (ratio < 0) {
    return 0;
  }
  return ratio > 1 ? 1 : ratio;
}
