import {
  recordCommunicationRound,
  recordCommunicationSessionCompleted,
  type CommunicationProgress,
} from '../domain/communicationProgress';
import type { ToddlerSettings } from '../domain/types';
import type {
  CommunicationAssetReadiness,
  CommunicationReadinessIssue,
  CommunicationReadinessIssueCode,
} from '../services/communicationAssetReadiness';
import {
  PEEK_AND_DISCOVER_CONTENT_VERSION,
  buildPeekAndDiscoverRound,
  createPeekAndDiscoverScope,
  type PeekAndDiscoverRound,
} from '../content/peekAndDiscover';

export const PEEK_AND_DISCOVER_MAX_REVEALS = 6 as const;
export const PEEK_AND_DISCOVER_MAX_DURATION_MS = 240_000 as const;
export const PEEK_AND_DISCOVER_TUTORIAL_DEMO_MS = 650 as const;
export const PEEK_AND_DISCOVER_SILENCE_WAIT_MS = 7_000 as const;
export const PEEK_AND_DISCOVER_SILENCE_DEMO_MS = 650 as const;
export const PEEK_AND_DISCOVER_REVEAL_MS = 480 as const;
export const PEEK_AND_DISCOVER_REACTION_FALLBACK_MS = 1_800 as const;
export const PEEK_AND_DISCOVER_GAG_MS = 520 as const;
export const PEEK_AND_DISCOVER_REST_MS = 900 as const;
export const PEEK_AND_DISCOVER_REDUCED_MOTION_MS = 160 as const;

export const PEEK_AND_DISCOVER_PHASES = [
  'tutorial',
  'ready',
  'revealing',
  'mandatory-model',
  'reaction',
  'rest',
  'paused',
  'asset-error',
  'session-stop',
] as const;

export type PeekAndDiscoverPhase = (typeof PEEK_AND_DISCOVER_PHASES)[number];
export type PeekAndDiscoverAssetStatus = 'checking' | 'ready';
export type PeekAndDiscoverRevealSource = 'tap' | 'pull' | 'automatic';
export type PeekAndDiscoverActiveRevealSource = 'touch' | 'automatic';
export type PeekAndDiscoverReactionSource = 'touch' | 'automatic';
export type PeekAndDiscoverStopReason = 'max-reveals' | 'time-elapsed';
export type PeekAndDiscoverPauseTarget = 'ready' | 'reaction';
export type PeekAndDiscoverAssetIssueCode =
  | CommunicationReadinessIssueCode
  | 'playback-errored'
  | 'playback-unavailable';

export interface PeekAndDiscoverLayoutInfo {
  readonly orientation: 'portrait' | 'landscape';
  readonly width: number;
  readonly height: number;
}

export interface PeekAndDiscoverAssetErrorDiagnostic {
  readonly code: 'content-unavailable';
  readonly issueCode: PeekAndDiscoverAssetIssueCode;
  readonly message: string;
  readonly technical: string;
  readonly asset?: string;
}

export interface PeekAndDiscoverPauseState {
  readonly resumeTarget: PeekAndDiscoverPauseTarget | null;
  readonly assetStatus: PeekAndDiscoverAssetStatus;
  readonly fromPhase: Exclude<PeekAndDiscoverPhase, 'paused'> | null;
}

export interface PeekAndDiscoverTimerTokens {
  readonly session: number;
  readonly tutorial: number;
  readonly silence: number;
  readonly reaction: number;
  readonly rest: number;
}

export interface PeekAndDiscoverCallbackTokens {
  readonly generation: number;
  readonly audio: number;
  readonly image: number;
  readonly animation: number;
  readonly timer: PeekAndDiscoverTimerTokens;
}

export interface PeekAndDiscoverState {
  readonly phase: PeekAndDiscoverPhase;
  readonly currentRound: PeekAndDiscoverRound;
  readonly roundLocale: PeekAndDiscoverRound['locale'];
  readonly assetStatus: PeekAndDiscoverAssetStatus;
  readonly revealCount: number;
  readonly progress: CommunicationProgress;
  readonly lastAssetErrorDiagnostic: PeekAndDiscoverAssetErrorDiagnostic | null;
  readonly reducedMotion: boolean;
  readonly layout: PeekAndDiscoverLayoutInfo;
  readonly tutorialInterrupted: boolean;
  readonly tutorialDemoActive: boolean;
  readonly silenceDemoActive: boolean;
  readonly silenceDemoShown: boolean;
  readonly autoplayBlocked: boolean;
  readonly revealSource: PeekAndDiscoverActiveRevealSource | null;
  readonly reactionTriggered: boolean;
  readonly reactionSource: PeekAndDiscoverReactionSource | null;
  readonly gagCompleted: boolean;
  readonly pause: PeekAndDiscoverPauseState;
  readonly sessionDeadlineAt: number;
  readonly stopReason: PeekAndDiscoverStopReason | null;
  readonly pendingStopReason: PeekAndDiscoverStopReason | null;
  readonly sessionCompletionRecorded: boolean;
  readonly currentRoundCounted: boolean;
  readonly tokens: PeekAndDiscoverCallbackTokens;
}

export interface CreatePeekAndDiscoverStateOptions {
  readonly sessionId: string;
  readonly progress: CommunicationProgress;
  readonly settings: Pick<
    ToddlerSettings,
    'languageMode' | 'englishVoiceLocale' | 'reducedMotion'
  >;
  readonly now?: number;
  readonly layout?: PeekAndDiscoverLayoutInfo;
}

export type PeekAndDiscoverAction =
  | {
      type: 'asset-readiness-resolved';
      generationToken: number;
      imageToken: number;
      readiness: CommunicationAssetReadiness;
    }
  | { type: 'tutorial-demo-finished'; tutorialToken: number }
  | { type: 'silence-demo-started'; silenceToken: number }
  | { type: 'silence-demo-finished'; animationToken: number }
  | { type: 'start-reveal'; source: PeekAndDiscoverRevealSource }
  | { type: 'reveal-animation-finished'; animationToken: number }
  | {
      type: 'mandatory-audio-finished';
      audioToken: number;
      outcome: 'completed' | 'cancelled' | 'replaced' | 'errored' | 'unavailable';
      now?: number;
    }
  | { type: 'trigger-reaction'; source: PeekAndDiscoverReactionSource; reactionToken?: number }
  | { type: 'reaction-animation-finished'; animationToken: number; now?: number }
  | {
      type: 'rest-finished';
      restToken: number;
      generationToken: number;
      nextRound: PeekAndDiscoverRound;
    }
  | { type: 'set-reduced-motion'; value: boolean }
  | { type: 'update-layout'; layout: PeekAndDiscoverLayoutInfo }
  | { type: 'backgrounded' }
  | { type: 'foregrounded' }
  | { type: 'session-expired'; sessionToken: number; now?: number };

const DEFAULT_LAYOUT: PeekAndDiscoverLayoutInfo = {
  orientation: 'portrait',
  width: 0,
  height: 0,
};

const QUIET_BREAK_MESSAGE = 'This reveal is taking a quiet break.';

function createInitialTokens(): PeekAndDiscoverCallbackTokens {
  return {
    generation: 1,
    audio: 0,
    image: 1,
    animation: 0,
    timer: {
      session: 1,
      tutorial: 1,
      silence: 1,
      reaction: 0,
      rest: 0,
    },
  };
}

function sameLayout(
  left: PeekAndDiscoverLayoutInfo,
  right: PeekAndDiscoverLayoutInfo,
): boolean {
  return (
    left.orientation === right.orientation
    && left.width === right.width
    && left.height === right.height
  );
}

function nextPauseState(
  resumeTarget: PeekAndDiscoverPauseTarget | null,
  assetStatus: PeekAndDiscoverAssetStatus,
  fromPhase: Exclude<PeekAndDiscoverPhase, 'paused'> | null,
): PeekAndDiscoverPauseState {
  return { resumeTarget, assetStatus, fromPhase };
}

function createAssetErrorDiagnostic(
  issue:
    | CommunicationReadinessIssue
    | {
        code: 'playback-errored' | 'playback-unavailable';
        diagnostic: string;
        asset?: string;
      },
): PeekAndDiscoverAssetErrorDiagnostic {
  return {
    code: 'content-unavailable',
    issueCode: issue.code,
    message: QUIET_BREAK_MESSAGE,
    technical: issue.diagnostic,
    ...(issue.asset === undefined ? {} : { asset: issue.asset }),
  };
}

function invalidateAsync(
  tokens: PeekAndDiscoverCallbackTokens,
): PeekAndDiscoverCallbackTokens {
  return {
    generation: tokens.generation + 1,
    audio: tokens.audio + 1,
    image: tokens.image + 1,
    animation: tokens.animation + 1,
    timer: {
      session: tokens.timer.session + 1,
      tutorial: tokens.timer.tutorial + 1,
      silence: tokens.timer.silence + 1,
      reaction: tokens.timer.reaction + 1,
      rest: tokens.timer.rest + 1,
    },
  };
}

function toReadyState(state: PeekAndDiscoverState): PeekAndDiscoverState {
  return {
    ...state,
    phase: 'ready',
    tutorialDemoActive: false,
    silenceDemoActive: false,
    silenceDemoShown: true,
    autoplayBlocked: true,
    revealSource: null,
    assetStatus: 'ready',
    reactionTriggered: false,
    reactionSource: null,
    gagCompleted: false,
    pendingStopReason: null,
    pause: nextPauseState(null, state.assetStatus, null),
  };
}

function beginReveal(
  state: PeekAndDiscoverState,
  source: PeekAndDiscoverRevealSource,
): PeekAndDiscoverState {
  return {
    ...state,
    phase: 'revealing',
    tutorialInterrupted: source !== 'automatic' || state.tutorialInterrupted,
    tutorialDemoActive: false,
    silenceDemoActive: false,
    silenceDemoShown: true,
    autoplayBlocked: false,
    revealSource: source === 'automatic' ? 'automatic' : 'touch',
    reactionTriggered: false,
    reactionSource: null,
    gagCompleted: false,
    pause: nextPauseState(null, state.assetStatus, null),
    tokens: {
      ...state.tokens,
      animation: state.tokens.animation + 1,
      timer: {
        ...state.tokens.timer,
        tutorial: state.tokens.timer.tutorial + 1,
        silence: state.tokens.timer.silence + 1,
      },
    },
  };
}

function enterAssetError(
  state: PeekAndDiscoverState,
  diagnostic: PeekAndDiscoverAssetErrorDiagnostic,
): PeekAndDiscoverState {
  if (
    state.phase === 'asset-error'
    && state.lastAssetErrorDiagnostic?.technical === diagnostic.technical
    && state.lastAssetErrorDiagnostic.issueCode === diagnostic.issueCode
    && state.lastAssetErrorDiagnostic.asset === diagnostic.asset
  ) {
    return state;
  }

  return {
    ...state,
    phase: 'asset-error',
    lastAssetErrorDiagnostic: diagnostic,
    pause: nextPauseState(null, state.assetStatus, null),
    pendingStopReason: null,
    tutorialDemoActive: false,
    silenceDemoActive: false,
    autoplayBlocked: true,
    revealSource: null,
  };
}

function enterSessionStop(
  state: PeekAndDiscoverState,
  reason: PeekAndDiscoverStopReason,
  now: number,
): PeekAndDiscoverState {
  const nextProgress = state.sessionCompletionRecorded
    ? state.progress
    : recordCommunicationSessionCompleted(
        state.progress,
        PEEK_AND_DISCOVER_CONTENT_VERSION,
        now,
      );

  if (
    state.phase === 'session-stop'
    && state.stopReason === reason
    && state.sessionCompletionRecorded
    && nextProgress === state.progress
  ) {
    return state;
  }

  return {
    ...state,
    phase: 'session-stop',
    progress: nextProgress,
    stopReason: reason,
    pendingStopReason: null,
    sessionCompletionRecorded: true,
    pause: nextPauseState(null, state.assetStatus, null),
    tutorialDemoActive: false,
    silenceDemoActive: false,
    autoplayBlocked: true,
    revealSource: null,
  };
}

function backgroundResumeTarget(
  phase: PeekAndDiscoverPhase,
): PeekAndDiscoverPauseTarget | null {
  switch (phase) {
    case 'tutorial':
    case 'ready':
    case 'revealing':
    case 'mandatory-model':
      return 'ready';
    case 'reaction':
    case 'rest':
      return 'reaction';
    default:
      return null;
  }
}

export function resolvePeekAndDiscoverMotionDuration(
  durationMs: number,
  reducedMotion: boolean,
): number {
  return reducedMotion
    ? Math.min(durationMs, PEEK_AND_DISCOVER_REDUCED_MOTION_MS)
    : durationMs;
}

export function createInitialPeekAndDiscoverState(
  options: CreatePeekAndDiscoverStateOptions,
): PeekAndDiscoverState {
  const now = options.now ?? Date.now();
  const currentRound = buildPeekAndDiscoverRound({
    scope: createPeekAndDiscoverScope(options.sessionId, 0),
    progress: options.progress,
    settings: options.settings,
    roundIndex: 0,
    previousCategory: null,
  });

  return {
    phase: 'tutorial',
    currentRound,
    roundLocale: currentRound.locale,
    assetStatus: 'checking',
    revealCount: 0,
    progress: options.progress,
    lastAssetErrorDiagnostic: null,
    reducedMotion: options.settings.reducedMotion,
    layout: options.layout ?? DEFAULT_LAYOUT,
    tutorialInterrupted: false,
    tutorialDemoActive: false,
    silenceDemoActive: false,
    silenceDemoShown: false,
    autoplayBlocked: false,
    revealSource: null,
    reactionTriggered: false,
    reactionSource: null,
    gagCompleted: false,
    pause: nextPauseState(null, 'checking', null),
    sessionDeadlineAt: now + PEEK_AND_DISCOVER_MAX_DURATION_MS,
    stopReason: null,
    pendingStopReason: null,
    sessionCompletionRecorded: false,
    currentRoundCounted: false,
    tokens: createInitialTokens(),
  };
}

export function reducePeekAndDiscover(
  state: PeekAndDiscoverState,
  action: PeekAndDiscoverAction,
): PeekAndDiscoverState {
  switch (action.type) {
    case 'asset-readiness-resolved': {
      if (
        action.generationToken !== state.tokens.generation
        ||
        action.imageToken !== state.tokens.image
        || (state.phase !== 'tutorial' && state.phase !== 'ready')
      ) {
        return state;
      }

      if (action.readiness.status === 'ready') {
        if (state.assetStatus === 'ready' && state.lastAssetErrorDiagnostic === null) {
          return state;
        }
        const tutorialDemoActive = state.phase === 'tutorial' && !state.tutorialInterrupted;
        return {
          ...state,
          phase: state.phase === 'tutorial' && state.tutorialInterrupted ? 'ready' : state.phase,
          assetStatus: 'ready',
          lastAssetErrorDiagnostic: null,
          tutorialDemoActive,
          silenceDemoActive: false,
          silenceDemoShown: false,
          autoplayBlocked: (
            state.autoplayBlocked
            || (state.phase === 'tutorial' && state.tutorialInterrupted)
          ),
          tokens: {
            ...state.tokens,
            timer: {
              ...state.tokens.timer,
              tutorial: tutorialDemoActive
                ? state.tokens.timer.tutorial + 1
                : state.tokens.timer.tutorial,
              silence: state.phase === 'ready' || state.tutorialInterrupted
                ? state.tokens.timer.silence + 1
                : state.tokens.timer.silence,
            },
          },
        };
      }

      const issue = action.readiness.issues[0];
      return enterAssetError(
        state,
        createAssetErrorDiagnostic(issue ?? {
          code: 'catalog-unavailable',
          childSafeCode: 'content-unavailable',
          diagnostic: 'Unknown content readiness issue.',
        }),
      );
    }

    case 'tutorial-demo-finished': {
      if (
        state.phase !== 'tutorial'
        || !state.tutorialDemoActive
        || action.tutorialToken !== state.tokens.timer.tutorial
        || state.assetStatus !== 'ready'
      ) {
        return state;
      }

      return beginReveal(state, 'automatic');
    }

    case 'silence-demo-started': {
      if (
        state.phase !== 'ready'
        || state.assetStatus !== 'ready'
        || state.autoplayBlocked
        || state.silenceDemoShown
        || action.silenceToken !== state.tokens.timer.silence
      ) {
        return state;
      }
      return {
        ...state,
        silenceDemoActive: true,
        silenceDemoShown: true,
        tokens: {
          ...state.tokens,
          animation: state.tokens.animation + 1,
          timer: {
            ...state.tokens.timer,
            silence: state.tokens.timer.silence + 1,
          },
        },
      };
    }

    case 'silence-demo-finished': {
      if (
        state.phase !== 'ready'
        || !state.silenceDemoActive
        || state.autoplayBlocked
        || action.animationToken !== state.tokens.animation
      ) {
        return state;
      }
      return beginReveal(state, 'automatic');
    }

    case 'start-reveal': {
      if (state.phase !== 'tutorial' && state.phase !== 'ready') {
        return state;
      }

      if (state.phase === 'tutorial') {
        if (state.assetStatus !== 'ready') {
          if (!state.tutorialInterrupted || state.tutorialDemoActive) {
            return {
              ...state,
              tutorialInterrupted: action.source !== 'automatic' || state.tutorialInterrupted,
              tutorialDemoActive: false,
              tokens: {
                ...state.tokens,
                timer: {
                  ...state.tokens.timer,
                  tutorial: state.tokens.timer.tutorial + 1,
                  silence: state.tokens.timer.silence + 1,
                },
              },
            };
          }
          return state;
        }
      }

      if (state.assetStatus !== 'ready') {
        return state;
      }

      return beginReveal(state, action.source);
    }

    case 'reveal-animation-finished': {
      if (
        state.phase !== 'revealing'
        || action.animationToken !== state.tokens.animation
      ) {
        return state;
      }

      return {
        ...state,
        phase: 'mandatory-model',
        tokens: {
          ...state.tokens,
          audio: state.tokens.audio + 1,
        },
      };
    }

    case 'mandatory-audio-finished': {
      if (
        state.phase !== 'mandatory-model'
        || action.audioToken !== state.tokens.audio
      ) {
        return state;
      }

      if (action.outcome === 'cancelled' || action.outcome === 'replaced') {
        return toReadyState(state);
      }

      if (action.outcome === 'errored' || action.outcome === 'unavailable') {
        return enterAssetError(
          state,
          createAssetErrorDiagnostic({
            code: action.outcome === 'errored' ? 'playback-errored' : 'playback-unavailable',
            diagnostic: `Exact word playback ${action.outcome} for ${state.currentRound.exactWord}.`,
            asset: state.currentRound.exactWord,
          }),
        );
      }

      const now = action.now ?? Date.now();
      const revealCount = state.revealCount + 1;
      const nextProgress = state.currentRoundCounted
        ? state.progress
        : recordCommunicationRound(
            state.progress,
            PEEK_AND_DISCOVER_CONTENT_VERSION,
            state.currentRound.content.id,
            now,
          );

      return {
        ...state,
        phase: 'reaction',
        revealCount,
        progress: nextProgress,
        reactionTriggered: false,
        reactionSource: null,
        gagCompleted: false,
        autoplayBlocked: false,
        revealSource: null,
        pendingStopReason: revealCount >= PEEK_AND_DISCOVER_MAX_REVEALS
          ? 'max-reveals'
          : null,
        currentRoundCounted: true,
        tokens: {
          ...state.tokens,
          timer: {
            ...state.tokens.timer,
            reaction: state.tokens.timer.reaction + 1,
          },
        },
      };
    }

    case 'trigger-reaction': {
      if (state.phase !== 'reaction') {
        return state;
      }
      if (state.reactionTriggered) {
        if (action.source !== 'touch' || !state.autoplayBlocked || !state.gagCompleted) {
          return state;
        }
        return {
          ...state,
          phase: 'rest',
          autoplayBlocked: false,
          tokens: {
            ...state.tokens,
            generation: state.tokens.generation + 1,
            timer: {
              ...state.tokens.timer,
              rest: state.tokens.timer.rest + 1,
            },
          },
        };
      }
      if (
        action.source === 'automatic'
        && (
          state.autoplayBlocked
          || action.reactionToken !== state.tokens.timer.reaction
        )
      ) {
        return state;
      }

      return {
        ...state,
        reactionTriggered: true,
        reactionSource: action.source,
        autoplayBlocked: false,
        tokens: {
          ...state.tokens,
          animation: state.tokens.animation + 1,
          timer: {
            ...state.tokens.timer,
            reaction: state.tokens.timer.reaction + 1,
          },
        },
      };
    }

    case 'reaction-animation-finished': {
      if (
        state.phase !== 'reaction'
        || !state.reactionTriggered
        || action.animationToken !== state.tokens.animation
      ) {
        return state;
      }

      if (state.pendingStopReason !== null) {
        return enterSessionStop(
          {
            ...state,
            gagCompleted: true,
          },
          state.pendingStopReason,
          action.now ?? Date.now(),
        );
      }

      return {
        ...state,
        phase: 'rest',
        gagCompleted: true,
        autoplayBlocked: false,
        tokens: {
          ...state.tokens,
          generation: state.tokens.generation + 1,
          timer: {
            ...state.tokens.timer,
            rest: state.tokens.timer.rest + 1,
          },
        },
      };
    }

    case 'rest-finished': {
      if (
        state.phase !== 'rest'
        || action.restToken !== state.tokens.timer.rest
        || action.generationToken !== state.tokens.generation
      ) {
        return state;
      }

      return {
        ...state,
        phase: 'ready',
        currentRound: action.nextRound,
        roundLocale: action.nextRound.locale,
        assetStatus: 'checking',
        lastAssetErrorDiagnostic: null,
        reactionTriggered: false,
        reactionSource: null,
        gagCompleted: false,
        silenceDemoActive: false,
        silenceDemoShown: false,
        autoplayBlocked: false,
        revealSource: null,
        pause: nextPauseState(null, 'checking', null),
        currentRoundCounted: false,
        tokens: {
          ...state.tokens,
          image: state.tokens.image + 1,
        },
      };
    }

    case 'set-reduced-motion': {
      if (state.reducedMotion === action.value) {
        return state;
      }
      return {
        ...state,
        reducedMotion: action.value,
      };
    }

    case 'update-layout': {
      if (sameLayout(state.layout, action.layout)) {
        return state;
      }
      return {
        ...state,
        layout: action.layout,
      };
    }

    case 'backgrounded': {
      if (state.phase === 'paused' || state.phase === 'asset-error' || state.phase === 'session-stop') {
        return state;
      }
      const resumeTarget = backgroundResumeTarget(state.phase);
      if (resumeTarget === null) {
        return state;
      }
      return {
        ...state,
        phase: 'paused',
        tutorialDemoActive: false,
        silenceDemoActive: false,
        autoplayBlocked: true,
        revealSource: null,
        reactionTriggered: resumeTarget === 'reaction' && state.gagCompleted,
        reactionSource: resumeTarget === 'reaction' && state.gagCompleted
          ? state.reactionSource
          : null,
        pause: nextPauseState(resumeTarget, state.assetStatus, state.phase),
        tokens: invalidateAsync(state.tokens),
      };
    }

    case 'foregrounded': {
      if (state.phase !== 'paused' || state.pause.resumeTarget === null) {
        return state;
      }

      return {
        ...state,
        phase: state.pause.resumeTarget,
        tutorialDemoActive: false,
        silenceDemoActive: false,
        autoplayBlocked: true,
        revealSource: null,
        pause: nextPauseState(null, state.pause.assetStatus, null),
        assetStatus: state.pause.assetStatus,
      };
    }

    case 'session-expired': {
      if (
        action.sessionToken !== state.tokens.timer.session
        || state.phase === 'asset-error'
        || state.phase === 'session-stop'
      ) {
        return state;
      }
      return enterSessionStop(state, 'time-elapsed', action.now ?? Date.now());
    }

    default:
      return state;
  }
}
