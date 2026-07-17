/* eslint-disable react-refresh/only-export-components */
import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  type ButtonHTMLAttributes,
} from 'react';
import {
  PEEK_AND_DISCOVER_ACTIVITY_ID,
  PEEK_AND_DISCOVER_INSTALLED_CONTENT,
  buildPeekAndDiscoverRound,
  createPeekAndDiscoverScope,
} from '../content/peekAndDiscover';
import type { CommunicationGameScope } from '../domain/communicationGame';
import type { CommunicationProgress } from '../domain/communicationProgress';
import type { SpeechLocale, ToddlerSettings } from '../domain/types';
import { useAppLifecycle } from '../platform/useAppLifecycle';
import {
  communicationAssetReadiness,
  type CommunicationAssetReadiness,
  type CommunicationAssetReadinessService,
  type CommunicationReadinessIssue,
  type InstalledCommunicationContent,
} from '../services/communicationAssetReadiness';
import {
  InteractionMediaCoordinator,
  interactionMediaCoordinator,
  type InteractionCancellationReason,
  type InteractionMediaOutcome,
  type InteractionMediaRequest,
  type InteractionSpeechBackend,
} from '../services/interactionMediaCoordinator';
import {
  recordedSpeechPlayer,
  type RecordedSpeechBackend,
} from '../services/recordedSpeech';
import {
  createInitialPeekAndDiscoverState,
  PEEK_AND_DISCOVER_GAG_MS,
  PEEK_AND_DISCOVER_REACTION_FALLBACK_MS,
  PEEK_AND_DISCOVER_REST_MS,
  PEEK_AND_DISCOVER_REVEAL_MS,
  PEEK_AND_DISCOVER_SILENCE_DEMO_MS,
  PEEK_AND_DISCOVER_SILENCE_WAIT_MS,
  PEEK_AND_DISCOVER_TUTORIAL_DEMO_MS,
  reducePeekAndDiscover,
  resolvePeekAndDiscoverMotionDuration,
  type PeekAndDiscoverAssetErrorDiagnostic,
  type PeekAndDiscoverLayoutInfo,
  type PeekAndDiscoverPhase,
  type PeekAndDiscoverState,
  type PeekAndDiscoverStopReason,
} from './peekAndDiscoverState';
import {
  PeekAndDiscoverArt,
  type PeekAndDiscoverDemoMode,
} from '../art/peekAndDiscover';
import './PeekAndDiscoverGame.css';
import type { SpeechRequestOptions, SpeechResult, SpeechSegment } from '../services/speech';

const SESSION_STOP_DIAGNOSTICS: Record<PeekAndDiscoverStopReason, string> = {
  'max-reveals': 'Peek and Discover finished after six calm reveals.',
  'time-elapsed': 'Peek and Discover reached the four minute calm stop.',
};

const GAME_LABELS = {
  'he-IL': {
    game: 'משחק הצצה וגילוי',
    back: 'חזרה',
    cover: 'לגעת בוילון כדי לגלות מה מסתתר',
    object: 'לגעת בחפץ',
    tutorial: 'הגור מראה איך לגעת בוילון.',
    ready: 'החפץ מוכן לגילוי.',
    revealing: 'הוילון נפתח.',
    mandatory: 'שומעים את המילה השלמה.',
    reaction: 'אפשר לגעת בחפץ בשביל טריק קטן.',
    rest: 'הבמה נחה לקראת החפץ הבא.',
    paused: 'המשחק מחכה למגע נוסף.',
    assetError: 'הבמה לוקחת הפסקה שקטה.',
    sessionStop: 'המשחק הסתיים בשקט. אפשר לחזור.',
  },
  'en-US': {
    game: 'Peek and discover game',
    back: 'Back',
    cover: 'Tap the curtain to reveal the surprise',
    object: 'Tap the picture',
    tutorial: 'The puppy is showing how to tap the curtain.',
    ready: 'The surprise is ready to reveal.',
    revealing: 'The curtain is opening.',
    mandatory: 'Listening to the whole word.',
    reaction: 'Tap the picture for a little visual gag.',
    rest: 'The stage is resting before the next surprise.',
    paused: 'The game is waiting for another touch.',
    assetError: 'The stage is taking a quiet break.',
    sessionStop: 'The calm session is over. Back is ready.',
  },
  'en-GB': {
    game: 'Peek and discover game',
    back: 'Back',
    cover: 'Tap the curtain to reveal the surprise',
    object: 'Tap the picture',
    tutorial: 'The puppy is showing how to tap the curtain.',
    ready: 'The surprise is ready to reveal.',
    revealing: 'The curtain is opening.',
    mandatory: 'Listening to the whole word.',
    reaction: 'Tap the picture for a little visual gag.',
    rest: 'The stage is resting before the next surprise.',
    paused: 'The game is waiting for another touch.',
    assetError: 'The stage is taking a quiet break.',
    sessionStop: 'The calm session is over. Back is ready.',
  },
} as const;

export interface PeekAndDiscoverAssetErrorEvent {
  readonly diagnostic: PeekAndDiscoverAssetErrorDiagnostic;
  readonly caregiverDiagnostic: string;
  readonly sessionId: string;
  readonly roundId: string;
  readonly contentId: string;
  readonly locale: SpeechLocale;
}

export interface PeekAndDiscoverSessionStopEvent {
  readonly reason: PeekAndDiscoverStopReason;
  readonly caregiverDiagnostic: string;
  readonly progress: CommunicationProgress;
  readonly sessionId: string;
  readonly roundId: string;
  readonly contentId: string;
  readonly locale: SpeechLocale;
  readonly revealCount: number;
}

export interface PeekAndDiscoverGameCoordinator {
  play(request: InteractionMediaRequest): Promise<InteractionMediaOutcome>;
  cancelAll(reason?: 'exit' | 'background'): void;
}

export interface PeekAndDiscoverAmbientCoordinator {
  notifyInteraction(scope: CommunicationGameScope, reason: InteractionCancellationReason): void;
}

export interface PeekAndDiscoverGameDependencies {
  readonly assetReadiness?: Pick<CommunicationAssetReadinessService, 'validate'>;
  readonly preloadImage?: (url: string) => Promise<void>;
  readonly installedContent?: InstalledCommunicationContent;
  readonly gameCoordinator?: PeekAndDiscoverGameCoordinator;
  readonly ambientCoordinator?: PeekAndDiscoverAmbientCoordinator;
}

export interface PeekAndDiscoverGameProps {
  readonly settings: ToddlerSettings;
  readonly communicationProgress: CommunicationProgress;
  readonly onProgressChange: (progress: CommunicationProgress) => void;
  readonly onAssetError: (event: PeekAndDiscoverAssetErrorEvent) => void;
  readonly onSessionStop: (event: PeekAndDiscoverSessionStopEvent) => void;
  readonly onBack: () => void;
  readonly sessionId?: string;
  readonly dependencies?: PeekAndDiscoverGameDependencies;
}

export class PeekAndDiscoverRecordedSpeechBackend implements InteractionSpeechBackend {
  private nextRequestId = 1;
  private activeScope: string | null = null;
  private forcedStatus: SpeechResult['status'] | null = null;

  constructor(private readonly player: RecordedSpeechBackend = recordedSpeechPlayer) {}

  async speakSegments(
    segments: SpeechSegment[],
    settings: ToddlerSettings,
    options: SpeechRequestOptions,
  ): Promise<SpeechResult> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const scope = options.scope ?? `peek-and-discover:${requestId}`;
    const segment = segments[0];
    if (segments.length !== 1 || !segment || !segment.text.trim()) {
      return { requestId, status: 'unsupported' };
    }

    this.activeScope = scope;
    this.forcedStatus = null;
    try {
      await this.player.unlock();
    } catch {
      // unlock is opportunistic; actual playback decides whether audio is ready
    }

    try {
      await this.player.play({
        text: segment.recordedText ?? segment.text,
        locale: segment.locale,
        volume: settings.soundLevel,
        onStart: () => {
          options.onStart?.();
        },
      });
      const status = this.activeScope === scope && this.forcedStatus !== null
        ? this.forcedStatus
        : 'completed';
      if (this.activeScope === scope) {
        this.activeScope = null;
        this.forcedStatus = null;
      }
      return { requestId, status };
    } catch (error: unknown) {
      if (this.activeScope === scope && this.forcedStatus !== null) {
        const status = this.forcedStatus;
        this.activeScope = null;
        this.forcedStatus = null;
        return { requestId, status };
      }
      this.activeScope = null;
      this.forcedStatus = null;
      const message = error instanceof Error ? error.message : String(error);
      return {
        requestId,
        status: /AudioContext is unavailable/i.test(message) ? 'unsupported' : 'error',
      };
    }
  }

  cancelScope(scope: string, reason: 'navigation' | 'replay' | 'visibility' = 'replay'): void {
    if (this.activeScope !== scope) {
      return;
    }
    this.forcedStatus = reason === 'replay' ? 'superseded' : 'cancelled';
    this.player.cancel();
  }
}

export const peekAndDiscoverInteractionMediaCoordinator = new InteractionMediaCoordinator(
  new PeekAndDiscoverRecordedSpeechBackend(),
);

function readLayout(): PeekAndDiscoverLayoutInfo {
  if (typeof window === 'undefined') {
    return {
      orientation: 'portrait',
      width: 0,
      height: 0,
    };
  }
  const width = Math.max(0, Math.round(window.innerWidth));
  const height = Math.max(0, Math.round(window.innerHeight));
  return {
    orientation: width > height ? 'landscape' : 'portrait',
    width,
    height,
  };
}

function localeLabels(locale: SpeechLocale) {
  return GAME_LABELS[locale];
}

function phaseStatusText(locale: SpeechLocale, phase: PeekAndDiscoverPhase): string {
  const labels = localeLabels(locale);
  switch (phase) {
    case 'tutorial':
      return labels.tutorial;
    case 'ready':
      return labels.ready;
    case 'revealing':
      return labels.revealing;
    case 'mandatory-model':
      return labels.mandatory;
    case 'reaction':
      return labels.reaction;
    case 'rest':
      return labels.rest;
    case 'paused':
      return labels.paused;
    case 'asset-error':
      return labels.assetError;
    case 'session-stop':
      return labels.sessionStop;
  }
}

function buildMissingImageReadiness(
  state: PeekAndDiscoverState,
  message: string,
): CommunicationAssetReadiness {
  const issue: CommunicationReadinessIssue = {
    code: 'missing-image',
    childSafeCode: 'content-unavailable',
    diagnostic: message,
    asset: state.currentRound.content.imageUrl,
  };
  return {
    status: 'not-ready',
    contentVersion: state.currentRound.readiness.contentVersion,
    locale: state.currentRound.locale,
    issues: [issue],
  };
}

function preloadImageWithBrowser(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Image preload is unavailable outside the browser.'));
      return;
    }
    const image = new window.Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Image failed to preload: ${url}`));
    image.src = url;
  });
}

function mergePreloadResult(
  readiness: CommunicationAssetReadiness,
  state: PeekAndDiscoverState,
  preloadError: unknown,
): CommunicationAssetReadiness {
  if (!preloadError) {
    return readiness;
  }
  const diagnostic = preloadError instanceof Error
    ? preloadError.message
    : `Image failed to preload: ${state.currentRound.content.imageUrl}`;
  const missingImage: CommunicationReadinessIssue = {
    code: 'missing-image',
    childSafeCode: 'content-unavailable',
    diagnostic,
    asset: state.currentRound.content.imageUrl,
  };
  if (readiness.status === 'ready') {
    return {
      status: 'not-ready',
      contentVersion: readiness.contentVersion,
      locale: readiness.locale,
      issues: [missingImage],
    };
  }
  return readiness.issues.some((issue) => issue.code === 'missing-image')
    ? readiness
    : {
        ...readiness,
        issues: [...readiness.issues, missingImage],
      };
}

function buildAssetErrorEvent(
  state: PeekAndDiscoverState,
  sessionId: string,
): PeekAndDiscoverAssetErrorEvent | null {
  const diagnostic = state.lastAssetErrorDiagnostic;
  if (!diagnostic) {
    return null;
  }
  return {
    diagnostic,
    caregiverDiagnostic: diagnostic.technical,
    sessionId,
    roundId: state.currentRound.scope.roundId,
    contentId: state.currentRound.content.id,
    locale: state.roundLocale,
  };
}

function buildSessionStopEvent(
  state: PeekAndDiscoverState,
  sessionId: string,
): PeekAndDiscoverSessionStopEvent | null {
  if (state.stopReason === null) {
    return null;
  }
  return {
    reason: state.stopReason,
    caregiverDiagnostic: SESSION_STOP_DIAGNOSTICS[state.stopReason],
    progress: state.progress,
    sessionId,
    roundId: state.currentRound.scope.roundId,
    contentId: state.currentRound.content.id,
    locale: state.roundLocale,
    revealCount: state.revealCount,
  };
}

function resolveDemoMode(state: PeekAndDiscoverState): PeekAndDiscoverDemoMode {
  if (state.tutorialDemoActive) {
    return 'tutorial';
  }
  if (state.silenceDemoActive) {
    return 'silence';
  }
  return 'none';
}

function isRevealed(state: PeekAndDiscoverState): boolean {
  if (
    state.phase === 'revealing'
    || state.phase === 'mandatory-model'
    || state.phase === 'reaction'
    || state.phase === 'rest'
    || state.phase === 'session-stop'
  ) {
    return true;
  }
  return state.phase === 'paused' && state.pause.resumeTarget === 'reaction';
}

function isTouchPointer(event: Pick<PointerEvent, 'pointerType'>): boolean {
  return event.pointerType === 'touch' || event.pointerType === 'pen';
}

function currentRoundAudioRequest(
  currentRound: PeekAndDiscoverState['currentRound'],
  audioToken: number,
  revealSource: PeekAndDiscoverState['revealSource'],
  settings: ToddlerSettings,
  sessionId: string,
): InteractionMediaRequest {
  const [segment] = currentRound.mandatorySegments;
  return {
    intentId: [
      PEEK_AND_DISCOVER_ACTIVITY_ID,
      sessionId,
      currentRound.scope.roundId,
      String(audioToken),
    ].join(':'),
    source: revealSource === 'touch' ? 'touch' : 'automatic',
    scope: currentRound.scope,
    audioClass: 'mandatory',
    settings,
    localeLock: currentRound.localeLock,
    segments: segment ? [segment] : [],
  };
}

export function PeekAndDiscoverGame({
  settings,
  communicationProgress,
  onProgressChange,
  onAssetError,
  onSessionStop,
  onBack,
  sessionId,
  dependencies,
}: PeekAndDiscoverGameProps) {
  const fallbackSessionId = useId();
  const resolvedSessionId = sessionId ?? fallbackSessionId;
  const lifecycle = useAppLifecycle();
  const gameCoordinator = dependencies?.gameCoordinator ?? peekAndDiscoverInteractionMediaCoordinator;
  const ambientCoordinator = dependencies?.ambientCoordinator ?? interactionMediaCoordinator;
  const assetReadiness = dependencies?.assetReadiness ?? communicationAssetReadiness;
  const preloadImage = dependencies?.preloadImage ?? preloadImageWithBrowser;
  const installedContent = dependencies?.installedContent ?? PEEK_AND_DISCOVER_INSTALLED_CONTENT;

  const [state, dispatch] = useReducer(
    reducePeekAndDiscover,
    {
      sessionId: resolvedSessionId,
      progress: communicationProgress,
      settings,
      now: Date.now(),
      layout: readLayout(),
    },
    createInitialPeekAndDiscoverState,
  );

  const latestSettingsRef = useRef(settings);
  latestSettingsRef.current = settings;
  const latestCallbacksRef = useRef({ onProgressChange, onAssetError, onSessionStop, onBack });
  latestCallbacksRef.current = { onProgressChange, onAssetError, onSessionStop, onBack };

  const lastProgressRef = useRef(state.progress);
  const lastAssetErrorKeyRef = useRef<string | null>(null);
  const lastSessionStopKeyRef = useRef<string | null>(null);
  const lifecycleRef = useRef(lifecycle);
  const activePointerIdRef = useRef<number | null>(null);
  const teardownRef = useRef(false);
  const cleanupRef = useRef({
    gameCoordinator,
    ambientCoordinator,
    scope: state.currentRound.scope,
  });
  cleanupRef.current = {
    gameCoordinator,
    ambientCoordinator,
    scope: state.currentRound.scope,
  };

  const readinessEffectKeyRef = useRef<string | null>(null);
  const tutorialEffectKeyRef = useRef<string | null>(null);
  const revealEffectKeyRef = useRef<string | null>(null);
  const audioEffectKeyRef = useRef<string | null>(null);
  const reactionFallbackKeyRef = useRef<string | null>(null);
  const reactionEffectKeyRef = useRef<string | null>(null);
  const silenceWaitKeyRef = useRef<string | null>(null);
  const silenceDemoKeyRef = useRef<string | null>(null);
  const restKeyRef = useRef<string | null>(null);
  const expiryKeyRef = useRef<string | null>(null);

  const labels = localeLabels(state.roundLocale);
  const lang = state.roundLocale === 'he-IL' ? 'he' : 'en';
  const dir = state.roundLocale === 'he-IL' ? 'rtl' : 'ltr';
  const demoMode = resolveDemoMode(state);
  const revealed = isRevealed(state);
  const gagActive = state.phase === 'reaction' && state.reactionTriggered && !state.gagCompleted;
  const artState = state.phase === 'asset-error'
    ? 'asset-error'
    : state.phase === 'session-stop'
      ? 'session-stop'
      : 'playing';

  useEffect(() => {
    if (lastProgressRef.current !== state.progress) {
      lastProgressRef.current = state.progress;
      latestCallbacksRef.current.onProgressChange(state.progress);
    }
  }, [state.progress]);

  useEffect(() => {
    if (state.phase !== 'asset-error') {
      return;
    }
    const event = buildAssetErrorEvent(state, resolvedSessionId);
    if (!event) {
      return;
    }
    const key = [
      state.tokens.generation,
      event.diagnostic.issueCode,
      event.diagnostic.asset ?? '',
      event.caregiverDiagnostic,
    ].join('|');
    if (lastAssetErrorKeyRef.current === key) {
      return;
    }
    lastAssetErrorKeyRef.current = key;
    latestCallbacksRef.current.onAssetError(event);
  }, [resolvedSessionId, state]);

  useEffect(() => {
    if (state.phase !== 'session-stop') {
      return;
    }
    const event = buildSessionStopEvent(state, resolvedSessionId);
    if (!event) {
      return;
    }
    const key = [event.reason, state.tokens.generation, event.revealCount].join('|');
    if (lastSessionStopKeyRef.current === key) {
      return;
    }
    lastSessionStopKeyRef.current = key;
    latestCallbacksRef.current.onSessionStop(event);
  }, [resolvedSessionId, state]);

  useEffect(() => {
    const syncLayout = (): void => {
      dispatch({ type: 'update-layout', layout: readLayout() });
    };
    syncLayout();
    window.addEventListener('resize', syncLayout);
    window.addEventListener('orientationchange', syncLayout);
    return () => {
      window.removeEventListener('resize', syncLayout);
      window.removeEventListener('orientationchange', syncLayout);
    };
  }, []);

  useEffect(() => {
    dispatch({ type: 'set-reduced-motion', value: settings.reducedMotion });
  }, [settings.reducedMotion]);

  useEffect(() => {
    if (lifecycleRef.current === lifecycle) {
      return;
    }
    lifecycleRef.current = lifecycle;
    if (lifecycle === 'background') {
      gameCoordinator.cancelAll('background');
      dispatch({ type: 'backgrounded' });
      return;
    }
    dispatch({ type: 'foregrounded' });
  }, [gameCoordinator, lifecycle]);

  useEffect(() => {
    teardownRef.current = false;
    return () => {
      teardownRef.current = true;
      cleanupRef.current.gameCoordinator.cancelAll('exit');
      cleanupRef.current.ambientCoordinator.notifyInteraction(cleanupRef.current.scope, 'exit');
    };
  }, []);

  useEffect(() => {
    if (state.assetStatus !== 'checking') {
      return;
    }
    const effectKey = [state.tokens.generation, state.tokens.image, state.currentRound.scope.roundId].join('|');
    if (readinessEffectKeyRef.current === effectKey) {
      return;
    }
    readinessEffectKeyRef.current = effectKey;
    let active = true;
    void (async () => {
      const [readiness, preloadResult] = await Promise.all([
        assetReadiness.validate(state.currentRound.readiness, installedContent),
        preloadImage(state.currentRound.content.imageUrl)
          .then(() => null)
          .catch((error: unknown) => error),
      ]);
      if (!active || teardownRef.current) {
        return;
      }
      dispatch({
        type: 'asset-readiness-resolved',
        generationToken: state.tokens.generation,
        imageToken: state.tokens.image,
        readiness: mergePreloadResult(readiness, state, preloadResult),
      });
    })();
    return () => {
      active = false;
      if (readinessEffectKeyRef.current === effectKey) {
        readinessEffectKeyRef.current = null;
      }
    };
  }, [
    assetReadiness,
    installedContent,
    preloadImage,
    state,
  ]);

  useEffect(() => {
    if (state.phase !== 'tutorial' || !state.tutorialDemoActive) {
      return;
    }
    const effectKey = [state.tokens.timer.tutorial, state.currentRound.scope.roundId].join('|');
    if (tutorialEffectKeyRef.current === effectKey) {
      return;
    }
    tutorialEffectKeyRef.current = effectKey;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'tutorial-demo-finished', tutorialToken: state.tokens.timer.tutorial });
    }, PEEK_AND_DISCOVER_TUTORIAL_DEMO_MS);
    return () => {
      window.clearTimeout(timer);
      if (tutorialEffectKeyRef.current === effectKey) {
        tutorialEffectKeyRef.current = null;
      }
    };
  }, [state.phase, state.currentRound.scope.roundId, state.tokens.timer.tutorial, state.tutorialDemoActive]);

  useEffect(() => {
    if (state.phase !== 'revealing') {
      return;
    }
    const effectKey = [state.tokens.animation, state.currentRound.scope.roundId].join('|');
    if (revealEffectKeyRef.current === effectKey) {
      return;
    }
    revealEffectKeyRef.current = effectKey;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'reveal-animation-finished', animationToken: state.tokens.animation });
    }, resolvePeekAndDiscoverMotionDuration(PEEK_AND_DISCOVER_REVEAL_MS, state.reducedMotion));
    return () => {
      window.clearTimeout(timer);
      if (revealEffectKeyRef.current === effectKey) {
        revealEffectKeyRef.current = null;
      }
    };
  }, [state.currentRound.scope.roundId, state.phase, state.reducedMotion, state.tokens.animation]);

  const audioPhase = state.phase;
  const audioRound = state.currentRound;
  const audioToken = state.tokens.audio;
  const audioRevealSource = state.revealSource;

  useEffect(() => {
    if (audioPhase !== 'mandatory-model') {
      return;
    }
    const effectKey = [audioToken, audioRound.scope.roundId].join('|');
    if (audioEffectKeyRef.current === effectKey) {
      return;
    }
    audioEffectKeyRef.current = effectKey;
    let active = true;
    ambientCoordinator.notifyInteraction(audioRound.scope, 'activity-replacement');
    void gameCoordinator.play(currentRoundAudioRequest(
      audioRound,
      audioToken,
      audioRevealSource,
      latestSettingsRef.current,
      resolvedSessionId,
    )).then((outcome) => {
      if (!active || teardownRef.current) {
        return;
      }
      dispatch({
        type: 'mandatory-audio-finished',
        audioToken,
        outcome: outcome.status,
        now: Date.now(),
      });
    });
    return () => {
      active = false;
    };
  }, [
    ambientCoordinator,
    audioPhase,
    audioRevealSource,
    audioRound,
    audioToken,
    gameCoordinator,
    resolvedSessionId,
  ]);

  useEffect(() => {
    if (
      state.phase !== 'reaction'
      || state.reactionTriggered
      || state.autoplayBlocked
    ) {
      return;
    }
    const effectKey = [state.tokens.timer.reaction, state.currentRound.scope.roundId].join('|');
    if (reactionFallbackKeyRef.current === effectKey) {
      return;
    }
    reactionFallbackKeyRef.current = effectKey;
    const timer = window.setTimeout(() => {
      dispatch({
        type: 'trigger-reaction',
        source: 'automatic',
        reactionToken: state.tokens.timer.reaction,
      });
    }, PEEK_AND_DISCOVER_REACTION_FALLBACK_MS);
    return () => {
      window.clearTimeout(timer);
      if (reactionFallbackKeyRef.current === effectKey) {
        reactionFallbackKeyRef.current = null;
      }
    };
  }, [
    state.autoplayBlocked,
    state.currentRound.scope.roundId,
    state.phase,
    state.reactionTriggered,
    state.tokens.timer.reaction,
  ]);

  useEffect(() => {
    if (
      state.phase !== 'reaction'
      || !state.reactionTriggered
      || state.gagCompleted
      || state.autoplayBlocked
    ) {
      return;
    }
    const effectKey = [state.tokens.animation, state.currentRound.scope.roundId].join('|');
    if (reactionEffectKeyRef.current === effectKey) {
      return;
    }
    reactionEffectKeyRef.current = effectKey;
    const timer = window.setTimeout(() => {
      dispatch({
        type: 'reaction-animation-finished',
        animationToken: state.tokens.animation,
        now: Date.now(),
      });
    }, resolvePeekAndDiscoverMotionDuration(PEEK_AND_DISCOVER_GAG_MS, state.reducedMotion));
    return () => {
      window.clearTimeout(timer);
      if (reactionEffectKeyRef.current === effectKey) {
        reactionEffectKeyRef.current = null;
      }
    };
  }, [
    state.autoplayBlocked,
    state.currentRound.scope.roundId,
    state.gagCompleted,
    state.phase,
    state.reactionTriggered,
    state.reducedMotion,
    state.tokens.animation,
  ]);

  useEffect(() => {
    if (
      state.phase !== 'ready'
      || state.assetStatus !== 'ready'
      || state.autoplayBlocked
      || state.silenceDemoShown
    ) {
      return;
    }
    const effectKey = [state.tokens.timer.silence, state.currentRound.scope.roundId].join('|');
    if (silenceWaitKeyRef.current === effectKey) {
      return;
    }
    silenceWaitKeyRef.current = effectKey;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'silence-demo-started', silenceToken: state.tokens.timer.silence });
    }, PEEK_AND_DISCOVER_SILENCE_WAIT_MS);
    return () => {
      window.clearTimeout(timer);
      if (silenceWaitKeyRef.current === effectKey) {
        silenceWaitKeyRef.current = null;
      }
    };
  }, [
    state.assetStatus,
    state.autoplayBlocked,
    state.currentRound.scope.roundId,
    state.phase,
    state.silenceDemoShown,
    state.tokens.timer.silence,
  ]);

  useEffect(() => {
    if (state.phase !== 'ready' || !state.silenceDemoActive) {
      return;
    }
    const effectKey = [state.tokens.animation, state.currentRound.scope.roundId].join('|');
    if (silenceDemoKeyRef.current === effectKey) {
      return;
    }
    silenceDemoKeyRef.current = effectKey;
    const timer = window.setTimeout(() => {
      dispatch({
        type: 'silence-demo-finished',
        animationToken: state.tokens.animation,
      });
    }, PEEK_AND_DISCOVER_SILENCE_DEMO_MS);
    return () => {
      window.clearTimeout(timer);
      if (silenceDemoKeyRef.current === effectKey) {
        silenceDemoKeyRef.current = null;
      }
    };
  }, [state.currentRound.scope.roundId, state.phase, state.silenceDemoActive, state.tokens.animation]);

  useEffect(() => {
    if (state.phase !== 'rest') {
      return;
    }
    const effectKey = [state.tokens.timer.rest, state.tokens.generation, state.revealCount].join('|');
    if (restKeyRef.current === effectKey) {
      return;
    }
    restKeyRef.current = effectKey;
    const timer = window.setTimeout(() => {
      const nextRound = buildPeekAndDiscoverRound({
        scope: createPeekAndDiscoverScope(resolvedSessionId, state.revealCount),
        progress: state.progress,
        settings: {
          languageMode: latestSettingsRef.current.languageMode,
          englishVoiceLocale: latestSettingsRef.current.englishVoiceLocale,
        },
        roundIndex: state.revealCount,
        previousCategory: state.currentRound.content.category,
      });
      dispatch({
        type: 'rest-finished',
        restToken: state.tokens.timer.rest,
        generationToken: state.tokens.generation,
        nextRound,
      });
    }, PEEK_AND_DISCOVER_REST_MS);
    return () => {
      window.clearTimeout(timer);
      if (restKeyRef.current === effectKey) {
        restKeyRef.current = null;
      }
    };
  }, [resolvedSessionId, state]);

  useEffect(() => {
    if (state.phase === 'paused' || state.phase === 'asset-error' || state.phase === 'session-stop') {
      return;
    }
    const effectKey = [state.tokens.timer.session, state.sessionDeadlineAt].join('|');
    if (expiryKeyRef.current === effectKey) {
      return;
    }
    expiryKeyRef.current = effectKey;
    const timer = window.setTimeout(() => {
      dispatch({
        type: 'session-expired',
        sessionToken: state.tokens.timer.session,
        now: Date.now(),
      });
    }, Math.max(0, state.sessionDeadlineAt - Date.now()));
    return () => {
      window.clearTimeout(timer);
      if (expiryKeyRef.current === effectKey) {
        expiryKeyRef.current = null;
      }
    };
  }, [state.phase, state.sessionDeadlineAt, state.tokens.timer.session]);

  const cancelToAssetError = (): void => {
    dispatch({
      type: 'asset-readiness-resolved',
      generationToken: state.tokens.generation,
      imageToken: state.tokens.image,
      readiness: buildMissingImageReadiness(
        state,
        `Image failed to render: ${state.currentRound.content.imageUrl}`,
      ),
    });
  };

  const beginReveal = (): void => {
    dispatch({ type: 'start-reveal', source: 'tap' });
  };

  const coverProps: ButtonHTMLAttributes<HTMLButtonElement> = useMemo(() => ({
    'aria-label': labels.cover,
    disabled: !(state.phase === 'tutorial' || state.phase === 'ready'),
    onPointerDown: (event) => {
      if (state.phase === 'session-stop' || state.phase === 'asset-error') {
        return;
      }
      if (isTouchPointer(event.nativeEvent)) {
        activePointerIdRef.current = event.nativeEvent.pointerId;
      }
      beginReveal();
    },
    onPointerMove: (event) => {
      if (
        activePointerIdRef.current === null
        || activePointerIdRef.current !== event.nativeEvent.pointerId
        || !isTouchPointer(event.nativeEvent)
      ) {
        return;
      }
      dispatch({ type: 'start-reveal', source: 'pull' });
    },
    onPointerUp: (event) => {
      if (activePointerIdRef.current === event.nativeEvent.pointerId) {
        activePointerIdRef.current = null;
      }
    },
    onPointerCancel: (event) => {
      if (activePointerIdRef.current === event.nativeEvent.pointerId) {
        activePointerIdRef.current = null;
      }
    },
    onClick: (event) => {
      if (event.detail === 0) {
        beginReveal();
      }
    },
  }), [labels.cover, state.phase]);

  const objectProps: ButtonHTMLAttributes<HTMLButtonElement> = useMemo(() => ({
    'aria-label': labels.object,
    disabled: state.phase !== 'reaction',
    onClick: () => {
      if (state.phase !== 'reaction') {
        return;
      }
      dispatch({ type: 'trigger-reaction', source: 'touch' });
    },
  }), [labels.object, state.phase]);

  const handleBack = (): void => {
    teardownRef.current = true;
    gameCoordinator.cancelAll('exit');
    ambientCoordinator.notifyInteraction(state.currentRound.scope, 'exit');
    latestCallbacksRef.current.onBack();
  };

  return (
    <main
      className="peek-and-discover-game"
      data-phase={state.phase}
      data-locale={state.roundLocale}
      data-content-id={state.currentRound.content.id}
      data-orientation={state.layout.orientation}
      data-reduced-motion={state.reducedMotion ? 'true' : 'false'}
      lang={lang}
      dir={dir}
      aria-label={labels.game}
    >
      <header className="peek-and-discover-topbar">
        <button
          type="button"
          className="peek-and-discover-back"
          aria-label={labels.back}
          onClick={handleBack}
        />
      </header>
      <p className="peek-and-discover-status" role="status" aria-live="polite">
        {phaseStatusText(state.roundLocale, state.phase)}
      </p>
      <div className="peek-and-discover-surface">
        <PeekAndDiscoverArt
          phase={state.phase}
          demoMode={demoMode}
          gagId={state.currentRound.content.gagId}
          gagActive={gagActive}
          revealed={revealed}
          reducedMotion={state.reducedMotion}
          locale={state.roundLocale}
          imageUrl={state.currentRound.content.imageUrl}
          contentId={state.currentRound.content.id}
          assetState={artState}
          coverButtonProps={coverProps}
          objectButtonProps={objectProps}
          imageProps={{ onError: cancelToAssetError }}
        />
      </div>
    </main>
  );
}
