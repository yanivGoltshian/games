import type { CelebrationInfo } from './types';

export const REDUCED_MOTION_REVEAL_HOLD_MS = 450;

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
