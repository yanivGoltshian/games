import type { CelebrationInfo } from './types';

export const REDUCED_MOTION_REVEAL_HOLD_MS = 450;

// Deliberate toddler-facing hold that keeps a non-matching pair visible before it
// flips back. Closing is driven purely by this timeout so it is guaranteed even on
// WebKit/iPad where speech-synthesis and transition callbacks are unreliable.
export const MEMORY_MISMATCH_HOLD_MS = 1100;
export const REDUCED_MOTION_MISMATCH_HOLD_MS = 650;

interface MemoryRevealScheduler {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timerId: number): void;
}

interface PendingMemoryCelebration {
  finalCardId: string;
  info: CelebrationInfo;
}

export interface MemoryCelebrationState {
  pending: PendingMemoryCelebration | null;
  visible: CelebrationInfo | null;
}

export type MemoryCelebrationAction =
  | { type: 'queue'; finalCardId: string; info: CelebrationInfo }
  | { type: 'reveal-complete'; cardId: string }
  | { type: 'dismiss' }
  | { type: 'reset' };

export const INITIAL_MEMORY_CELEBRATION_STATE: MemoryCelebrationState = {
  pending: null,
  visible: null,
};

export function reduceMemoryCelebration(
  state: MemoryCelebrationState,
  action: MemoryCelebrationAction,
): MemoryCelebrationState {
  switch (action.type) {
    case 'queue':
      return {
        pending: { finalCardId: action.finalCardId, info: action.info },
        visible: null,
      };
    case 'reveal-complete':
      if (state.pending?.finalCardId !== action.cardId) {
        return state;
      }
      return { pending: null, visible: state.pending.info };
    case 'dismiss':
      return { ...state, visible: null };
    case 'reset':
      return INITIAL_MEMORY_CELEBRATION_STATE;
  }
}

export function memoryRevealFallbackMs(
  caregiverReducedMotion: boolean,
  systemReducedMotion: boolean,
): number | null {
  return caregiverReducedMotion || systemReducedMotion
    ? REDUCED_MOTION_REVEAL_HOLD_MS
    : null;
}

export function scheduleMemoryRevealFallback(
  delayMs: number,
  onComplete: () => void,
  scheduler: MemoryRevealScheduler,
): () => void {
  let active = true;
  const timer = scheduler.setTimeout(() => {
    if (active) {
      onComplete();
    }
  }, delayMs);

  return () => {
    active = false;
    scheduler.clearTimeout(timer);
  };
}

export function memoryMismatchHoldMs(
  caregiverReducedMotion: boolean,
  systemReducedMotion: boolean,
): number {
  return caregiverReducedMotion || systemReducedMotion
    ? REDUCED_MOTION_MISMATCH_HOLD_MS
    : MEMORY_MISMATCH_HOLD_MS;
}

export interface MemoryMismatchCloseHandle {
  /** Cancel the pending close, e.g. on unmount or round change. Prevents any late close. */
  cancel(): void;
  /** Optionally confirm/shorten the close early (e.g. from a transition event). Fires once. */
  confirm(): void;
}

/**
 * Schedule a mismatched pair to flip back after a deliberate hold.
 *
 * The timeout is the reliable source of truth: `onClose` always runs once when it
 * elapses, even if no transition/animation event ever arrives (WebKit/iPad). A
 * transition event may call `confirm()` to close early, and `cancel()` guarantees
 * no state update happens after teardown. `onClose` is invoked at most once.
 */
export function scheduleMemoryMismatchClose(
  delayMs: number,
  onClose: () => void,
  scheduler: MemoryRevealScheduler,
): MemoryMismatchCloseHandle {
  let settled = false;
  const finish = (run: boolean): void => {
    if (settled) {
      return;
    }
    settled = true;
    scheduler.clearTimeout(timer);
    if (run) {
      onClose();
    }
  };
  const timer = scheduler.setTimeout(() => finish(true), delayMs);

  return {
    cancel: () => finish(false),
    confirm: () => finish(true),
  };
}
