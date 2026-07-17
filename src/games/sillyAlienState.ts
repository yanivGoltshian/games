/**
 * Pure state logic for the "Silly Alien" game — hands-free redesign.
 *
 * The game is built for a pre-reading toddler, so after a single "wake the
 * alien" tap the whole round runs by itself: the alien performs a silent comic
 * gag (the first syllable pops off as a bubble), models the broken word, and
 * then *listens*. While listening we accumulate *vocal effort*: every animation
 * frame the component measures a normalised RMS level (0..1) and feeds it here
 * as `register-effort` with the elapsed milliseconds since the previous frame.
 * Time only counts while the level is at or above a small threshold, so room
 * hiss doesn't fill the bar but a toddler's "taaaa-puach!" does.
 *
 * Phases:
 *   locked          – waiting for the one obvious tap that unlocks audio + mic.
 *   presenting       – the comic gag + spoken model is playing; mic is OFF so the
 *                      app never hears its own narration.
 *   listening        – mic is open, waiting for Sean's voice.
 *   nudge            – no voice yet; replay a short supportive model (never framed
 *                      as failure), then listen again.
 *   success          – enough effort (or an explicit help tap); the word snaps
 *                      back together and the alien celebrates.
 *   parentFallback   – microphone denied/unavailable; a single tap (no
 *                      press-and-hold) lets a grown-up advance the round.
 *
 * Everything is a pure function that returns the *same* reference when nothing
 * changes, so React re-renders stay minimal. Timers, speech and capture all
 * live in the component; this module only owns the transitions.
 */

export type SillyAlienPhase =
  | 'locked'
  | 'presenting'
  | 'listening'
  | 'nudge'
  | 'success'
  | 'parentFallback';

export interface SillyAlienState {
  phase: SillyAlienPhase;
  /** True once the child has performed the one-time unlock gesture. */
  unlocked: boolean;
  /** True when the microphone was denied or is unavailable this session. */
  micDenied: boolean;
  /** Accumulated milliseconds of at-or-above-threshold vocal effort. */
  effortMs: number;
  /** Latest normalised microphone level (0..1) for real-time visuals. */
  currentLevel: number;
  /** How many times listening has been (re)started this round. */
  listenAttempts: number;
  /** How many supportive replays we have offered this round. */
  nudges: number;
}

export type SillyAlienAction =
  | { type: 'unlock'; micGranted: boolean }
  | { type: 'begin-round' }
  | { type: 'present-done' }
  | { type: 'register-effort'; level: number; deltaMs: number }
  | { type: 'listen-timeout' }
  | { type: 'nudge-done' }
  | { type: 'mic-denied' }
  | { type: 'succeed' }
  | { type: 'reset' };

/** Minimum normalised RMS level we treat as intentional voice (not room hiss). */
export const SILLY_ALIEN_LEVEL_THRESHOLD = 0.08;

/** Cumulative above-threshold time (ms) needed before the alien "gets it". */
export const SILLY_ALIEN_EFFORT_TARGET_MS = 800;

/** Generous toddler response window (ms) before we offer a gentle replay. */
export const SILLY_ALIEN_LISTEN_WINDOW_MS = 12000;

export const INITIAL_SILLY_ALIEN_STATE: SillyAlienState = {
  phase: 'locked',
  unlocked: false,
  micDenied: false,
  effortMs: 0,
  currentLevel: 0,
  listenAttempts: 0,
  nudges: 0,
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

/** Fresh per-round counters, preserving the session-wide unlock/mic latches. */
function freshRound(state: SillyAlienState, phase: SillyAlienPhase): SillyAlienState {
  return {
    phase,
    unlocked: state.unlocked,
    micDenied: state.micDenied,
    effortMs: 0,
    currentLevel: 0,
    listenAttempts: 0,
    nudges: 0,
  };
}

export function reduceSillyAlien(
  state: SillyAlienState,
  action: SillyAlienAction,
): SillyAlienState {
  switch (action.type) {
    case 'reset': {
      const isPristine =
        state.phase === 'locked'
        && !state.unlocked
        && !state.micDenied
        && state.effortMs === 0
        && state.currentLevel === 0
        && state.listenAttempts === 0
        && state.nudges === 0;
      return isPristine ? state : INITIAL_SILLY_ALIEN_STATE;
    }

    case 'unlock': {
      if (state.unlocked) {
        return state;
      }
      return {
        phase: 'presenting',
        unlocked: true,
        micDenied: !action.micGranted,
        effortMs: 0,
        currentLevel: 0,
        listenAttempts: 0,
        nudges: 0,
      };
    }

    case 'begin-round': {
      // Ignored until the child has unlocked; the very first round waits for the
      // tap. Once unlocked, every new word replays the comic gag.
      if (!state.unlocked) {
        return state;
      }
      return freshRound(state, 'presenting');
    }

    case 'present-done': {
      if (state.phase !== 'presenting') {
        return state;
      }
      // A denied microphone routes straight to the grown-up fallback; otherwise
      // we open the mic and start a fresh listen attempt.
      if (state.micDenied) {
        return { ...state, phase: 'parentFallback', currentLevel: 0 };
      }
      return {
        ...state,
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
          ...state,
          phase: 'success',
          effortMs: SILLY_ALIEN_EFFORT_TARGET_MS,
          currentLevel: level,
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

    case 'listen-timeout': {
      if (state.phase !== 'listening') {
        return state;
      }
      return {
        ...state,
        phase: 'nudge',
        currentLevel: 0,
        nudges: state.nudges + 1,
      };
    }

    case 'nudge-done': {
      if (state.phase !== 'nudge') {
        return state;
      }
      return {
        ...state,
        phase: 'listening',
        effortMs: 0,
        currentLevel: 0,
        listenAttempts: state.listenAttempts + 1,
      };
    }

    case 'mic-denied': {
      if (state.phase === 'success') {
        return state;
      }
      if (state.micDenied && state.phase === 'parentFallback') {
        return state;
      }
      return { ...state, phase: 'parentFallback', micDenied: true, currentLevel: 0 };
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
