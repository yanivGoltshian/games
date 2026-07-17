import type { SpeechLocale } from '../domain/types';
import type { StoryThatWaitsStoryId } from '../content/storyThatWaits';

export const STORY_THAT_WAITS_PHASES = [
  'tutorial',
  'loading-story',
  'narrating-page',
  'guard',
  'turn1',
  'turn2',
  'page-action',
  'page-transition',
  'ending',
  'rest',
  'paused',
  'asset-error',
] as const;

export const STORY_THAT_WAITS_PAGE_COUNT = 4;
export const STORY_THAT_WAITS_GUARD_MS = 400;
export const STORY_THAT_WAITS_TURN1_WINDOW_MS = 5000;
export const STORY_THAT_WAITS_TURN2_WINDOW_MS = 5000;
export const STORY_THAT_WAITS_MAX_OPPORTUNITIES = 2;
export const STORY_THAT_WAITS_SESSION_MAX_MS = 150000;
export const STORY_THAT_WAITS_MISSING_SENTENCE_CODE = 'story-page-missing-sentence' as const;
export const STORY_THAT_WAITS_MEDIA_ERROR_CODE = 'mandatory-media-error' as const;

export type StoryThatWaitsPhase = (typeof STORY_THAT_WAITS_PHASES)[number];
export type StoryThatWaitsPageIndex = 0 | 1 | 2 | 3;
export type StoryThatWaitsAssetErrorCode =
  | typeof STORY_THAT_WAITS_MISSING_SENTENCE_CODE
  | typeof STORY_THAT_WAITS_MEDIA_ERROR_CODE;
export type StoryThatWaitsResumeTarget = Exclude<
  StoryThatWaitsPhase,
  'paused' | 'rest' | 'asset-error'
>;
export type MandatoryNarrationPages = readonly [boolean, boolean, boolean, boolean];

export interface StoryThatWaitsGenerationToken {
  sessionGeneration: number;
  storyGeneration: number;
  pageGeneration: number;
  stepGeneration: number;
}

export interface StoryThatWaitsState extends StoryThatWaitsGenerationToken {
  phase: StoryThatWaitsPhase;
  readiness: boolean;
  storyId: StoryThatWaitsStoryId | null;
  locale: SpeechLocale | null;
  pageIndex: StoryThatWaitsPageIndex | null;
  mandatoryNarrationPages: MandatoryNarrationPages | null;
  queuedPageAdvanceIntent: boolean;
  opportunityCount: 0 | 1 | 2;
  narrationCompleted: boolean;
  pausedResumeTarget: StoryThatWaitsResumeTarget | null;
  diagnostic: string | null;
  assetErrorCode: StoryThatWaitsAssetErrorCode | null;
  elapsedMs: number;
  sessionStartedAtMs: number | null;
  sessionDeadlineMs: number | null;
  stateEnteredAtMs: number;
}

export type StoryThatWaitsAction =
  | { type: 'set-readiness'; ready: boolean }
  | { type: 'request-story'; storyId: StoryThatWaitsStoryId; locale: SpeechLocale }
  | {
      type: 'story-ready';
      storyId: StoryThatWaitsStoryId;
      locale: SpeechLocale;
      mandatoryNarrationPages: MandatoryNarrationPages;
    }
  | {
      type: 'narration-completed';
      token: StoryThatWaitsGenerationToken;
      completed: boolean;
    }
  | { type: 'touch-advance' }
  | { type: 'coarse-effort-detected'; token: StoryThatWaitsGenerationToken }
  | { type: 'microphone-denied'; token: StoryThatWaitsGenerationToken }
  | { type: 'mandatory-media-failed'; diagnostic: string }
  | { type: 'page-action-finished'; token: StoryThatWaitsGenerationToken }
  | { type: 'page-transition-finished'; token: StoryThatWaitsGenerationToken }
  | { type: 'ending-finished'; token: StoryThatWaitsGenerationToken }
  | { type: 'set-elapsed'; elapsedMs: number }
  | { type: 'pause' }
  | { type: 'resume-after-pause' }
  | { type: 'foregrounded' }
  | { type: 'interrupt-to-tutorial' }
  | { type: 'orientation-changed' }
  | { type: 'layout-changed' };

export const INITIAL_STORY_THAT_WAITS_STATE: StoryThatWaitsState = {
  phase: 'tutorial',
  readiness: false,
  storyId: null,
  locale: null,
  pageIndex: null,
  mandatoryNarrationPages: null,
  queuedPageAdvanceIntent: false,
  opportunityCount: 0,
  narrationCompleted: false,
  pausedResumeTarget: null,
  diagnostic: null,
  assetErrorCode: null,
  elapsedMs: 0,
  sessionStartedAtMs: null,
  sessionDeadlineMs: null,
  stateEnteredAtMs: 0,
  sessionGeneration: 0,
  storyGeneration: 0,
  pageGeneration: 0,
  stepGeneration: 0,
};

function toPageIndex(index: number): StoryThatWaitsPageIndex | null {
  switch (index) {
    case 0:
    case 1:
    case 2:
    case 3:
      return index;
    default:
      return null;
  }
}

function matchesToken(
  state: StoryThatWaitsState,
  token: StoryThatWaitsGenerationToken,
): boolean {
  return state.sessionGeneration === token.sessionGeneration
    && state.storyGeneration === token.storyGeneration
    && state.pageGeneration === token.pageGeneration
    && state.stepGeneration === token.stepGeneration;
}

function isActivePhase(phase: StoryThatWaitsPhase): phase is StoryThatWaitsResumeTarget {
  return phase !== 'paused' && phase !== 'rest' && phase !== 'asset-error';
}

function isStoryPagePhase(phase: StoryThatWaitsPhase): boolean {
  return phase === 'narrating-page'
    || phase === 'guard'
    || phase === 'turn1'
    || phase === 'turn2'
    || phase === 'page-action'
    || phase === 'page-transition';
}

function firstMissingMandatoryPageIndex(
  pages: MandatoryNarrationPages,
): StoryThatWaitsPageIndex | null {
  for (let index = 0; index < pages.length; index += 1) {
    if (!pages[index]) {
      return toPageIndex(index);
    }
  }
  return null;
}

function withPhase(
  state: StoryThatWaitsState,
  phase: StoryThatWaitsPhase,
  patch: Partial<StoryThatWaitsState> = {},
): StoryThatWaitsState {
  return {
    ...state,
    ...patch,
    phase,
    stepGeneration: state.stepGeneration + 1,
    stateEnteredAtMs: patch.stateEnteredAtMs ?? state.elapsedMs,
  };
}

function startNarratingPage(
  state: StoryThatWaitsState,
  pageIndex: StoryThatWaitsPageIndex,
): StoryThatWaitsState {
  return {
    ...state,
    phase: 'narrating-page',
    pageIndex,
    queuedPageAdvanceIntent: false,
    opportunityCount: 0,
    narrationCompleted: false,
    pausedResumeTarget: null,
    diagnostic: null,
    assetErrorCode: null,
    pageGeneration: state.pageGeneration + 1,
    stepGeneration: state.stepGeneration + 1,
    stateEnteredAtMs: state.elapsedMs,
  };
}

function toPageAction(
  state: StoryThatWaitsState,
): StoryThatWaitsState {
  return withPhase(state, 'page-action', {
    queuedPageAdvanceIntent: false,
  });
}

function toAssetError(
  state: StoryThatWaitsState,
  missingPageIndex: StoryThatWaitsPageIndex,
): StoryThatWaitsState {
  return {
    ...state,
    phase: 'asset-error',
    pageIndex: missingPageIndex,
    queuedPageAdvanceIntent: false,
    opportunityCount: 0,
    narrationCompleted: false,
    pausedResumeTarget: null,
    diagnostic: `Missing mandatory story narration for page ${missingPageIndex + 1}.`,
    assetErrorCode: STORY_THAT_WAITS_MISSING_SENTENCE_CODE,
    stepGeneration: state.stepGeneration + 1,
    stateEnteredAtMs: state.elapsedMs,
  };
}

function applyAutomaticProgress(state: StoryThatWaitsState): StoryThatWaitsState {
  if (
    state.sessionDeadlineMs !== null
    && state.elapsedMs >= state.sessionDeadlineMs
    && state.phase !== 'rest'
    && state.phase !== 'asset-error'
    && state.phase !== 'ending'
  ) {
    return withPhase(state, 'ending', {
      queuedPageAdvanceIntent: false,
      opportunityCount: state.opportunityCount,
      narrationCompleted: false,
      pausedResumeTarget: null,
      diagnostic: 'Session reached its maximum duration.',
    });
  }

  if (
    state.phase === 'guard'
    && state.elapsedMs - state.stateEnteredAtMs >= STORY_THAT_WAITS_GUARD_MS
  ) {
    if (state.queuedPageAdvanceIntent) {
      return toPageAction(state);
    }
    return withPhase(state, 'turn1', {
      opportunityCount: 1,
    });
  }

  if (
    state.phase === 'turn1'
    && state.elapsedMs - state.stateEnteredAtMs >= STORY_THAT_WAITS_TURN1_WINDOW_MS
  ) {
    return withPhase(state, 'turn2', {
      opportunityCount: STORY_THAT_WAITS_MAX_OPPORTUNITIES,
    });
  }

  if (
    state.phase === 'turn2'
    && state.elapsedMs - state.stateEnteredAtMs >= STORY_THAT_WAITS_TURN2_WINDOW_MS
  ) {
    return toPageAction(state);
  }

  return state;
}

export function getStoryThatWaitsGenerationToken(
  state: StoryThatWaitsState,
): StoryThatWaitsGenerationToken {
  return {
    sessionGeneration: state.sessionGeneration,
    storyGeneration: state.storyGeneration,
    pageGeneration: state.pageGeneration,
    stepGeneration: state.stepGeneration,
  };
}

export function reduceStoryThatWaits(
  state: StoryThatWaitsState,
  action: StoryThatWaitsAction,
): StoryThatWaitsState {
  switch (action.type) {
    case 'orientation-changed':
    case 'layout-changed':
    case 'foregrounded':
      return state;

    case 'set-readiness': {
      if (
        state.phase !== 'tutorial'
        && state.phase !== 'loading-story'
        && state.phase !== 'paused'
      ) {
        return state;
      }
      return state.readiness === action.ready
        ? state
        : { ...state, readiness: action.ready };
    }

    case 'request-story': {
      if (state.phase !== 'tutorial' && state.phase !== 'loading-story') {
        return state;
      }
      if (
        state.phase === 'loading-story'
        && (state.storyId !== action.storyId || state.locale !== action.locale)
      ) {
        return state;
      }
      if (
        state.phase === 'loading-story'
        && state.storyId === action.storyId
        && state.locale === action.locale
      ) {
        return state;
      }
      return withPhase(state, 'loading-story', {
        storyId: action.storyId,
        locale: action.locale,
        pageIndex: null,
        mandatoryNarrationPages: null,
        queuedPageAdvanceIntent: false,
        opportunityCount: 0,
        narrationCompleted: false,
        pausedResumeTarget: null,
        diagnostic: null,
        assetErrorCode: null,
        sessionStartedAtMs: null,
        sessionDeadlineMs: null,
      });
    }

    case 'story-ready': {
      if (state.phase !== 'loading-story' || !state.readiness) {
        return state;
      }
      if (state.storyId !== action.storyId || state.locale !== action.locale) {
        return state;
      }
      const missingPageIndex = firstMissingMandatoryPageIndex(action.mandatoryNarrationPages);
      if (missingPageIndex !== null) {
        return toAssetError(
          {
            ...state,
            mandatoryNarrationPages: action.mandatoryNarrationPages,
          },
          missingPageIndex,
        );
      }
      return {
        ...state,
        phase: 'narrating-page',
        pageIndex: 0,
        mandatoryNarrationPages: action.mandatoryNarrationPages,
        queuedPageAdvanceIntent: false,
        opportunityCount: 0,
        narrationCompleted: false,
        pausedResumeTarget: null,
        diagnostic: null,
        assetErrorCode: null,
        sessionStartedAtMs: state.elapsedMs,
        sessionDeadlineMs: state.elapsedMs + STORY_THAT_WAITS_SESSION_MAX_MS,
        sessionGeneration: state.sessionGeneration + 1,
        storyGeneration: state.storyGeneration + 1,
        pageGeneration: state.pageGeneration + 1,
        stepGeneration: state.stepGeneration + 1,
        stateEnteredAtMs: state.elapsedMs,
      };
    }

    case 'narration-completed': {
      if (state.phase !== 'narrating-page' || !matchesToken(state, action.token) || !action.completed) {
        return state;
      }
      return withPhase(state, 'guard', {
        narrationCompleted: true,
      });
    }

    case 'mandatory-media-failed': {
      if (state.phase === 'asset-error' || state.phase === 'rest') {
        return state;
      }
      return withPhase(state, 'asset-error', {
        queuedPageAdvanceIntent: false,
        narrationCompleted: false,
        pausedResumeTarget: null,
        diagnostic: action.diagnostic,
        assetErrorCode: STORY_THAT_WAITS_MEDIA_ERROR_CODE,
      });
    }

    case 'touch-advance': {
      if (state.phase === 'narrating-page' || state.phase === 'guard') {
        return state.queuedPageAdvanceIntent
          ? state
          : { ...state, queuedPageAdvanceIntent: true };
      }
      if (state.phase === 'turn1' || state.phase === 'turn2') {
        return toPageAction(state);
      }
      return state;
    }

    case 'coarse-effort-detected': {
      if (
        (state.phase !== 'turn1' && state.phase !== 'turn2')
        || !matchesToken(state, action.token)
      ) {
        return state;
      }
      return toPageAction(state);
    }

    case 'microphone-denied': {
      if (
        (state.phase !== 'turn1' && state.phase !== 'turn2')
        || !matchesToken(state, action.token)
      ) {
        return state;
      }
      return toPageAction(state);
    }

    case 'page-action-finished': {
      if (state.phase !== 'page-action' || !matchesToken(state, action.token)) {
        return state;
      }
      return withPhase(state, 'page-transition');
    }

    case 'page-transition-finished': {
      if (state.phase !== 'page-transition' || !matchesToken(state, action.token)) {
        return state;
      }
      if (state.pageIndex === null) {
        return state;
      }
      if (state.pageIndex === STORY_THAT_WAITS_PAGE_COUNT - 1) {
        return withPhase(state, 'ending', {
          narrationCompleted: false,
        });
      }
      const nextPageIndex = toPageIndex(state.pageIndex + 1);
      if (nextPageIndex === null) {
        return state;
      }
      return startNarratingPage(state, nextPageIndex);
    }

    case 'ending-finished': {
      if (state.phase !== 'ending' || !matchesToken(state, action.token)) {
        return state;
      }
      return withPhase(state, 'rest', {
        queuedPageAdvanceIntent: false,
        opportunityCount: state.opportunityCount,
        narrationCompleted: false,
        pausedResumeTarget: null,
      });
    }

    case 'set-elapsed': {
      if (state.phase === 'asset-error' || state.phase === 'paused' || state.phase === 'rest') {
        return state;
      }
      const nextElapsed = Number.isFinite(action.elapsedMs)
        ? Math.max(state.elapsedMs, action.elapsedMs)
        : state.elapsedMs;
      if (nextElapsed === state.elapsedMs) {
        return state;
      }
      const elapsedState = { ...state, elapsedMs: nextElapsed };
      return applyAutomaticProgress(elapsedState);
    }

    case 'pause': {
      if (state.phase === 'paused' || state.phase === 'rest' || state.phase === 'asset-error') {
        return state;
      }
      if (!isActivePhase(state.phase)) {
        return state;
      }
      return withPhase(state, 'paused', {
        queuedPageAdvanceIntent: false,
        narrationCompleted: false,
        pausedResumeTarget: state.phase,
      });
    }

    case 'resume-after-pause': {
      if (state.phase !== 'paused' || state.pausedResumeTarget === null) {
        return state;
      }
      if (isStoryPagePhase(state.pausedResumeTarget)) {
        return withPhase(state, 'guard', {
          queuedPageAdvanceIntent: false,
          opportunityCount: 0,
          narrationCompleted: true,
          pausedResumeTarget: null,
        });
      }
      return withPhase(state, state.pausedResumeTarget, {
        pausedResumeTarget: null,
      });
    }

    case 'interrupt-to-tutorial': {
      if (state.phase === 'tutorial') {
        return state;
      }
      return withPhase(state, 'tutorial', {
        queuedPageAdvanceIntent: false,
        opportunityCount: 0,
        narrationCompleted: false,
        pausedResumeTarget: null,
        diagnostic: 'Tutorial interrupted the story flow.',
      });
    }
  }

  const exhaustiveCheck: never = action;
  return exhaustiveCheck;
}
