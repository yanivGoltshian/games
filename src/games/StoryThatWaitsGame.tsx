import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { PuppyMascotArt } from '../art/mascot';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import {
  STORY_THAT_WAITS_PAGE_IDS,
  STORY_THAT_WAITS_VERSION,
  createStoryThatWaitsContentRequirements,
  createStoryThatWaitsLocaleLock,
  createStoryThatWaitsScope,
  getStoryThatWaitsStory,
  type StoryThatWaitsLocale,
  type StoryThatWaitsPage,
  type StoryThatWaitsStoryId,
} from '../content/storyThatWaits';
import { hasRealisticConceptAsset } from '../art/conceptAssets';
import {
  recordCommunicationRound,
  recordCommunicationSessionCompleted,
  type CommunicationProgress,
} from '../domain/communicationProgress';
import type { ToddlerSettings } from '../domain/types';
import {
  readAppLifecycleState,
  subscribeAppLifecycle,
  type AppLifecycleState,
} from '../platform/useAppLifecycle';
import {
  communicationAssetReadiness,
  type CommunicationAssetReadiness,
  type CommunicationContentRequirements,
} from '../services/communicationAssetReadiness';
import {
  type InteractionCancellationReason,
  type InteractionMediaOutcome,
  type InteractionMediaRequest,
} from '../services/interactionMediaCoordinator';
import { storyThatWaitsMediaCoordinator } from '../services/storyThatWaitsMedia';
import {
  getStoryThatWaitsGenerationToken,
  INITIAL_STORY_THAT_WAITS_STATE,
  reduceStoryThatWaits,
  STORY_THAT_WAITS_GUARD_MS,
  STORY_THAT_WAITS_SESSION_MAX_MS,
  STORY_THAT_WAITS_TURN1_WINDOW_MS,
  STORY_THAT_WAITS_TURN2_WINDOW_MS,
  type MandatoryNarrationPages,
  type StoryThatWaitsGenerationToken,
  type StoryThatWaitsState,
} from './storyThatWaitsState';
import {
  useMicEffort,
  type MicEffortController,
} from './useMicEffort';
import './StoryThatWaitsGame.css';

const NORMAL_ACTION_MS = 520;
const NORMAL_TRANSITION_MS = 360;
const NORMAL_ENDING_MS = 1_100;
const REDUCED_STEP_MS = 180;
const ELAPSED_TICK_MS = 100;
const TUTORIAL_VISUAL_MS = 2_400;

let nextSessionNumber = 1;

export type StoryThatWaitsMetric =
  | {
    name: 'story-reached';
    storyId: StoryThatWaitsStoryId;
    elapsedMs: number;
  }
  | {
    name: 'page-reached';
    storyId: StoryThatWaitsStoryId;
    page: 1 | 2 | 3 | 4;
    elapsedMs: number;
  }
  | {
    name: 'elapsed-time';
    storyId: StoryThatWaitsStoryId;
    elapsedMs: number;
  }
  | {
    name: 'exit';
    storyId: StoryThatWaitsStoryId;
    page: 1 | 2 | 3 | 4 | null;
    elapsedMs: number;
  }
  | {
    name: 'media-error';
    storyId: StoryThatWaitsStoryId;
    page: 1 | 2 | 3 | 4 | null;
    elapsedMs: number;
    code: string;
  };

export interface StoryThatWaitsMediaCoordinator {
  unlock(): void;
  play(request: InteractionMediaRequest): Promise<InteractionMediaOutcome>;
  notifyInteraction(
    scope: InteractionMediaRequest['scope'],
    reason: InteractionCancellationReason,
  ): void;
  cancelAll(reason?: 'exit' | 'background'): void;
}

export type StoryThatWaitsReadinessCheck = (
  requirements: CommunicationContentRequirements,
) => Promise<CommunicationAssetReadiness>;

export type StoryThatWaitsMicrophonePermission = 'granted' | 'not-granted' | 'unsupported';

export interface StoryThatWaitsGameProps {
  storyId: StoryThatWaitsStoryId;
  locale: StoryThatWaitsLocale;
  settings: ToddlerSettings;
  onExit: () => void;
  onMetric?: (metric: StoryThatWaitsMetric) => void;
  initialProgress?: CommunicationProgress;
  onProgressChange?: (progress: CommunicationProgress) => void;
  readinessCheck?: StoryThatWaitsReadinessCheck;
  mediaCoordinator?: StoryThatWaitsMediaCoordinator;
  micController?: MicEffortController;
  queryMicrophonePermission?: () => Promise<StoryThatWaitsMicrophonePermission>;
  readLifecycle?: typeof readAppLifecycleState;
  subscribeLifecycle?: typeof subscribeAppLifecycle;
  sessionId?: string;
}

type ReadinessView =
  | { status: 'checking'; diagnostic: null }
  | { status: 'ready'; diagnostic: null }
  | { status: 'blocked'; diagnostic: string };

function createSessionId(): string {
  const id = `story-that-waits-${Date.now()}-${nextSessionNumber}`;
  nextSessionNumber += 1;
  return id;
}

function pageNumber(state: StoryThatWaitsState): 1 | 2 | 3 | 4 | null {
  if (state.pageIndex === null) {
    return null;
  }
  return (state.pageIndex + 1) as 1 | 2 | 3 | 4;
}

function actionDuration(reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_STEP_MS : NORMAL_ACTION_MS;
}

function transitionDuration(reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_STEP_MS : NORMAL_TRANSITION_MS;
}

function endingDuration(reducedMotion: boolean): number {
  return reducedMotion ? REDUCED_STEP_MS : NORMAL_ENDING_MS;
}

function allMandatoryPagesReady(): MandatoryNarrationPages {
  return [true, true, true, true];
}

function readinessDiagnostic(result: Extract<CommunicationAssetReadiness, { status: 'not-ready' }>): string {
  return result.issues.map((issue) => issue.diagnostic).join(' ');
}

async function defaultReadinessCheck(
  requirements: CommunicationContentRequirements,
): Promise<CommunicationAssetReadiness> {
  return communicationAssetReadiness.validate(requirements, {
    contentVersion: requirements.contentVersion,
    images: requirements.images.filter(
      (image) => image.kind === 'id' && hasRealisticConceptAsset(image.value),
    ),
  });
}

async function queryPreauthorizedMicrophonePermission(): Promise<StoryThatWaitsMicrophonePermission> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unsupported';
  }
  try {
    const permission = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    return permission.state === 'granted' ? 'granted' : 'not-granted';
  } catch (error: unknown) {
    if (
      error instanceof Error
      && (
        error.name === 'TypeError'
        || error.name === 'NotSupportedError'
        || error.name === 'SecurityError'
      )
    ) {
      return 'unsupported';
    }
    throw error;
  }
}

function labels(locale: StoryThatWaitsLocale) {
  if (locale === 'he-IL') {
    return {
      game: 'סיפור שמחכה',
      back: 'חזרה לבית',
      replay: 'לשמוע שוב',
      page: 'געו בספר',
      waiting: 'הסיפור מחכה',
      blocked: 'הסיפור ינוח עכשיו',
      diagnostic: 'מידע למטפל',
      rest: 'הסיפור הסתיים',
    };
  }
  return {
    game: 'Story That Waits',
    back: 'Back home',
    replay: 'Hear it again',
    page: 'Touch the book',
    waiting: 'The story is waiting',
    blocked: 'The story is resting now',
    diagnostic: 'Caregiver information',
    rest: 'The story is finished',
  };
}

function isCurrentToken(
  state: StoryThatWaitsState,
  token: StoryThatWaitsGenerationToken,
): boolean {
  const current = getStoryThatWaitsGenerationToken(state);
  return current.sessionGeneration === token.sessionGeneration
    && current.storyGeneration === token.storyGeneration
    && current.pageGeneration === token.pageGeneration
    && current.stepGeneration === token.stepGeneration;
}

export function StoryThatWaitsGame({
  storyId,
  locale,
  settings,
  onExit,
  onMetric,
  initialProgress,
  onProgressChange,
  readinessCheck = defaultReadinessCheck,
  mediaCoordinator = storyThatWaitsMediaCoordinator,
  micController,
  queryMicrophonePermission = queryPreauthorizedMicrophonePermission,
  readLifecycle = readAppLifecycleState,
  subscribeLifecycle: subscribeToLifecycle = subscribeAppLifecycle,
  sessionId: suppliedSessionId,
}: StoryThatWaitsGameProps) {
  const lockedStoryIdRef = useRef(storyId);
  const lockedLocaleRef = useRef(locale);
  const sessionIdRef = useRef(suppliedSessionId ?? createSessionId());
  const initialLifecycleRef = useRef<AppLifecycleState | null>(null);
  if (initialLifecycleRef.current === null) {
    initialLifecycleRef.current = readLifecycle();
  }
  const lifecycleRef = useRef<AppLifecycleState>(initialLifecycleRef.current);
  const automaticStartBlockedRef = useRef(initialLifecycleRef.current === 'background');
  const startGestureClaimedRef = useRef(false);
  const readinessGenerationRef = useRef(0);
  const [state, dispatch] = useReducer(reduceStoryThatWaits, INITIAL_STORY_THAT_WAITS_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [readiness, setReadiness] = useState<ReadinessView>({
    status: 'checking',
    diagnostic: null,
  });
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [caregiverDiagnostic, setCaregiverDiagnostic] = useState<string | null>(null);
  const [touchPulse, setTouchPulse] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(true);
  const [resumeReplayActive, setResumeReplayActive] = useState(false);
  const story = getStoryThatWaitsStory(lockedStoryIdRef.current);
  const lockedLocale = lockedLocaleRef.current;
  const copy = labels(lockedLocale);
  const progressRef = useRef(initialProgress);
  const emittedPagesRef = useRef(new Set<number>());
  const storyReachedRef = useRef(false);
  const completionHandledRef = useRef(false);
  const narrationKeysRef = useRef(new Set<string>());
  const aliveRef = useRef(true);
  const replayActiveRef = useRef(false);
  const mediaCancellationEpochRef = useRef(0);
  const tutorialStartedAtRef = useRef<number | null>(null);
  const micTokenRef = useRef<StoryThatWaitsGenerationToken | null>(null);
  const elapsedLastTickRef = useRef(Date.now());
  const touchPulseTimerRef = useRef<number | null>(null);

  const selectedPage = (
    state.pageIndex === null ? story.pages[0] : story.pages[state.pageIndex]
  ) ?? story.pages[0]!;
  const currentScope = createStoryThatWaitsScope(
    lockedStoryIdRef.current,
    sessionIdRef.current,
    selectedPage.id,
  );

  const emitMetric = useCallback((metric: StoryThatWaitsMetric): void => {
    onMetric?.(metric);
  }, [onMetric]);

  const reportMediaError = useCallback((code: string, diagnostic: string): void => {
    if (!aliveRef.current) {
      return;
    }
    setRuntimeError(diagnostic);
    dispatch({ type: 'mandatory-media-failed', diagnostic });
    emitMetric({
      name: 'media-error',
      storyId: lockedStoryIdRef.current,
      page: pageNumber(stateRef.current),
      elapsedMs: stateRef.current.elapsedMs,
      code,
    });
  }, [emitMetric]);

  const reportNonblockingError = useCallback((code: string, diagnostic: string): void => {
    if (!aliveRef.current) {
      return;
    }
    setCaregiverDiagnostic(diagnostic);
    emitMetric({
      name: 'media-error',
      storyId: lockedStoryIdRef.current,
      page: pageNumber(stateRef.current),
      elapsedMs: stateRef.current.elapsedMs,
      code,
    });
  }, [emitMetric]);

  const onMicSample = useCallback((level: 0 | 1): void => {
    const token = micTokenRef.current;
    if (level !== 1 || token === null) {
      return;
    }
    micTokenRef.current = null;
    dispatch({ type: 'coarse-effort-detected', token });
  }, []);
  const internalMic = useMicEffort(onMicSample);
  const microphone = micController ?? internalMic;
  const microphoneRef = useRef(microphone);
  microphoneRef.current = microphone;

  const playPage = useCallback(async (
    page: StoryThatWaitsPage,
    token: StoryThatWaitsGenerationToken,
    source: 'automatic' | 'touch',
    intentKind: 'narration' | 'replay',
  ): Promise<InteractionMediaOutcome> => {
    const utterance = page.utterances[lockedLocaleRef.current];
    const scope = createStoryThatWaitsScope(
      lockedStoryIdRef.current,
      sessionIdRef.current,
      page.id,
    );
    return mediaCoordinator.play({
      intentId: [
        'story-that-waits',
        sessionIdRef.current,
        page.id,
        token.pageGeneration,
        token.stepGeneration,
        intentKind,
      ].join(':'),
      source,
      scope,
      audioClass: 'mandatory',
      settings: { ...settings, quietMode: false },
      localeLock: createStoryThatWaitsLocaleLock(
        lockedStoryIdRef.current,
        sessionIdRef.current,
        lockedLocaleRef.current,
        page.id,
      ),
      segments: [{
        text: utterance.sentence,
        recordedText: utterance.recordedLookupText,
        locale: utterance.locale,
      }],
    });
  }, [mediaCoordinator, settings]);

  useEffect(() => {
    aliveRef.current = true;
    const readinessGeneration = readinessGenerationRef.current + 1;
    readinessGenerationRef.current = readinessGeneration;
    const requirements = createStoryThatWaitsContentRequirements(
      lockedStoryIdRef.current,
      sessionIdRef.current,
      lockedLocaleRef.current,
    );
    let active = true;
    const isCurrentReadiness = (): boolean => (
      active
      && aliveRef.current
      && readinessGenerationRef.current === readinessGeneration
    );
    void readinessCheck(requirements).then(
      (result) => {
        if (!isCurrentReadiness()) {
          return;
        }
        if (result.status === 'ready') {
          setReadiness({ status: 'ready', diagnostic: null });
          dispatch({ type: 'set-readiness', ready: true });
          const lifecycle = readLifecycle();
          lifecycleRef.current = lifecycle;
          if (lifecycle === 'background') {
            automaticStartBlockedRef.current = true;
          }
          if (automaticStartBlockedRef.current) {
            dispatch({ type: 'pause' });
            return;
          }
          if (stateRef.current.phase === 'tutorial') {
            automaticStartBlockedRef.current = false;
            const lockedStoryId = lockedStoryIdRef.current;
            const lockedLocale = lockedLocaleRef.current;
            dispatch({ type: 'request-story', storyId: lockedStoryId, locale: lockedLocale });
            dispatch({
              type: 'story-ready',
              storyId: lockedStoryId,
              locale: lockedLocale,
              mandatoryNarrationPages: allMandatoryPagesReady(),
            });
          }
          return;
        }
        const diagnostic = readinessDiagnostic(result);
        setReadiness({ status: 'blocked', diagnostic });
        dispatch({ type: 'set-readiness', ready: false });
        emitMetric({
          name: 'media-error',
          storyId: lockedStoryIdRef.current,
          page: null,
          elapsedMs: stateRef.current.elapsedMs,
          code: result.issues[0]?.code ?? 'content-unavailable',
        });
      },
      (error: unknown) => {
        if (!isCurrentReadiness()) {
          return;
        }
        const diagnostic = error instanceof Error
          ? error.message
          : 'The content readiness check failed.';
        setReadiness({ status: 'blocked', diagnostic });
        dispatch({ type: 'set-readiness', ready: false });
        emitMetric({
          name: 'media-error',
          storyId: lockedStoryIdRef.current,
          page: null,
          elapsedMs: stateRef.current.elapsedMs,
          code: 'readiness-check-failed',
        });
      },
    );
    return () => {
      active = false;
      aliveRef.current = false;
    };
  }, [emitMetric, readLifecycle, readinessCheck]);

  useEffect(() => {
    if (
      !tutorialActive
      || state.pageIndex !== 0
      || state.sessionStartedAtMs === null
    ) {
      return undefined;
    }
    if (tutorialStartedAtRef.current === null) {
      tutorialStartedAtRef.current = Date.now();
    }
    const elapsed = Date.now() - tutorialStartedAtRef.current;
    const timer = window.setTimeout(
      () => setTutorialActive(false),
      Math.max(0, TUTORIAL_VISUAL_MS - elapsed),
    );
    return () => window.clearTimeout(timer);
  }, [state.pageIndex, state.sessionStartedAtMs, tutorialActive]);

  useEffect(() => {
    if (lifecycleRef.current === 'background') {
      automaticStartBlockedRef.current = true;
      dispatch({ type: 'pause' });
    }
    return subscribeToLifecycle((lifecycle: AppLifecycleState) => {
      lifecycleRef.current = lifecycle;
      if (lifecycle === 'background') {
        if (stateRef.current.sessionStartedAtMs === null) {
          automaticStartBlockedRef.current = true;
        }
        microphoneRef.current.stop();
        mediaCancellationEpochRef.current += 1;
        mediaCoordinator.cancelAll('background');
        replayActiveRef.current = false;
        setResumeReplayActive(false);
        dispatch({ type: 'pause' });
        return;
      }
      dispatch({ type: 'foregrounded' });
    });
  }, [mediaCoordinator, subscribeToLifecycle]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, now - elapsedLastTickRef.current);
      elapsedLastTickRef.current = now;
      const snapshot = stateRef.current;
      if (
        snapshot.sessionStartedAtMs !== null
        && snapshot.phase !== 'paused'
        && snapshot.phase !== 'rest'
        && snapshot.phase !== 'asset-error'
        && snapshot.phase !== 'ending'
        && !replayActiveRef.current
        && delta > 0
      ) {
        dispatch({ type: 'set-elapsed', elapsedMs: snapshot.elapsedMs + delta });
      }
    }, ELAPSED_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state.phase !== 'narrating-page' || state.pageIndex === null || runtimeError) {
      return;
    }
    const token = getStoryThatWaitsGenerationToken(stateRef.current);
    const key = [
      token.sessionGeneration,
      token.storyGeneration,
      token.pageGeneration,
      token.stepGeneration,
    ].join(':');
    if (narrationKeysRef.current.has(key)) {
      return;
    }
    narrationKeysRef.current.add(key);
    const cancellationEpoch = mediaCancellationEpochRef.current;
    const page = story.pages[state.pageIndex]!;
    void playPage(page, token, 'automatic', 'narration').then(
      (outcome) => {
        if (
          !aliveRef.current
          || cancellationEpoch !== mediaCancellationEpochRef.current
          || !isCurrentToken(stateRef.current, token)
        ) {
          return;
        }
        if (outcome.status === 'completed') {
          dispatch({ type: 'narration-completed', token, completed: true });
          return;
        }
        reportMediaError(
          `mandatory-narration-${outcome.status}`,
          `Mandatory narration did not complete for ${page.id}.`,
        );
      },
      (error: unknown) => {
        if (
          !aliveRef.current
          || cancellationEpoch !== mediaCancellationEpochRef.current
          || !isCurrentToken(stateRef.current, token)
        ) {
          return;
        }
        const diagnostic = error instanceof Error ? error.message : 'Mandatory narration failed.';
        reportMediaError('mandatory-narration-failed', diagnostic);
      },
    );
  }, [playPage, reportMediaError, runtimeError, state, story.pages]);

  useEffect(() => {
    if (state.phase !== 'guard') {
      return undefined;
    }
    if (resumeReplayActive) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const snapshot = stateRef.current;
      dispatch({
        type: 'set-elapsed',
        elapsedMs: Math.max(snapshot.elapsedMs, state.stateEnteredAtMs + STORY_THAT_WAITS_GUARD_MS),
      });
    }, STORY_THAT_WAITS_GUARD_MS);
    return () => window.clearTimeout(timer);
  }, [resumeReplayActive, state.phase, state.stateEnteredAtMs]);

  useEffect(() => {
    if (state.phase !== 'turn1' && state.phase !== 'turn2') {
      micTokenRef.current = null;
      microphoneRef.current.stop();
      return undefined;
    }
    const duration = state.phase === 'turn1'
      ? STORY_THAT_WAITS_TURN1_WINDOW_MS
      : STORY_THAT_WAITS_TURN2_WINDOW_MS;
    const timer = window.setTimeout(() => {
      const snapshot = stateRef.current;
      dispatch({
        type: 'set-elapsed',
        elapsedMs: Math.max(snapshot.elapsedMs, state.stateEnteredAtMs + duration),
      });
    }, duration);
    return () => {
      window.clearTimeout(timer);
      micTokenRef.current = null;
      microphoneRef.current.stop();
    };
  }, [state.phase, state.stateEnteredAtMs]);

  useEffect(() => {
    if (state.phase !== 'turn1') {
      return;
    }
    const token: StoryThatWaitsGenerationToken = {
      sessionGeneration: state.sessionGeneration,
      storyGeneration: state.storyGeneration,
      pageGeneration: state.pageGeneration,
      stepGeneration: state.stepGeneration,
    };
    const cancellationEpoch = mediaCancellationEpochRef.current;
    let active = true;
    const isCurrentPermissionQuery = (): boolean => (
      active
      && aliveRef.current
      && cancellationEpoch === mediaCancellationEpochRef.current
      && isCurrentToken(stateRef.current, token)
      && stateRef.current.phase === 'turn1'
    );
    void queryMicrophonePermission().then(
      (permission) => {
        if (
          permission !== 'granted'
          || !isCurrentPermissionQuery()
        ) {
          return;
        }
        micTokenRef.current = token;
        void microphoneRef.current.start().then((outcome) => {
          if (!isCurrentPermissionQuery()) {
            if (micTokenRef.current === token) {
              micTokenRef.current = null;
            }
            return;
          }
          if (outcome.status === 'permission-denied' || outcome.status === 'error') {
            micTokenRef.current = null;
            dispatch({ type: 'microphone-denied', token });
          }
        });
      },
      (error: unknown) => {
        if (!isCurrentPermissionQuery()) {
          return;
        }
        const diagnostic = error instanceof Error
          ? error.message
          : 'Microphone permission status could not be read.';
        reportNonblockingError('microphone-permission-query-failed', diagnostic);
      },
    );
    return () => {
      active = false;
    };
  }, [
    queryMicrophonePermission,
    reportNonblockingError,
    state.pageGeneration,
    state.phase,
    state.sessionGeneration,
    state.stepGeneration,
    state.storyGeneration,
  ]);

  useEffect(() => {
    if (state.phase !== 'page-action') {
      return undefined;
    }
    const token = getStoryThatWaitsGenerationToken(stateRef.current);
    const timer = window.setTimeout(() => {
      dispatch({ type: 'page-action-finished', token });
    }, actionDuration(settings.reducedMotion));
    return () => window.clearTimeout(timer);
  }, [settings.reducedMotion, state.phase, state.stepGeneration]);

  useEffect(() => {
    if (state.phase !== 'page-transition') {
      return undefined;
    }
    const token = getStoryThatWaitsGenerationToken(stateRef.current);
    const timer = window.setTimeout(() => {
      dispatch({ type: 'page-transition-finished', token });
    }, transitionDuration(settings.reducedMotion));
    return () => window.clearTimeout(timer);
  }, [settings.reducedMotion, state.phase, state.stepGeneration]);

  useEffect(() => {
    if (state.phase !== 'ending') {
      return undefined;
    }
    microphoneRef.current.stop();
    mediaCancellationEpochRef.current += 1;
    mediaCoordinator.cancelAll('exit');
    const token = getStoryThatWaitsGenerationToken(stateRef.current);
    const timer = window.setTimeout(() => {
      dispatch({ type: 'ending-finished', token });
    }, state.diagnostic === 'Session reached its maximum duration.'
      ? 0
      : endingDuration(settings.reducedMotion));
    return () => window.clearTimeout(timer);
  }, [
    mediaCoordinator,
    settings.reducedMotion,
    state.diagnostic,
    state.phase,
    state.stepGeneration,
  ]);

  useEffect(() => {
    if (
      state.sessionDeadlineMs === null
      || state.phase === 'paused'
      || state.phase === 'rest'
      || state.phase === 'asset-error'
      || state.phase === 'ending'
    ) {
      return undefined;
    }
    const remaining = Math.max(0, state.sessionDeadlineMs - state.elapsedMs);
    const timer = window.setTimeout(() => {
      dispatch({ type: 'set-elapsed', elapsedMs: state.sessionDeadlineMs! });
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [state.elapsedMs, state.phase, state.sessionDeadlineMs]);

  useEffect(() => {
    if (state.sessionStartedAtMs === null || state.pageIndex === null) {
      return;
    }
    if (!storyReachedRef.current) {
      storyReachedRef.current = true;
      emitMetric({
        name: 'story-reached',
        storyId: lockedStoryIdRef.current,
        elapsedMs: state.elapsedMs,
      });
    }
    if (emittedPagesRef.current.has(state.pageIndex)) {
      return;
    }
    emittedPagesRef.current.add(state.pageIndex);
    emitMetric({
      name: 'page-reached',
      storyId: lockedStoryIdRef.current,
      page: (state.pageIndex + 1) as 1 | 2 | 3 | 4,
      elapsedMs: state.elapsedMs,
    });
    if (progressRef.current && onProgressChange) {
      const next = recordCommunicationRound(
        progressRef.current,
        STORY_THAT_WAITS_VERSION,
        `${lockedStoryIdRef.current}:${STORY_THAT_WAITS_PAGE_IDS[state.pageIndex]}`,
      );
      progressRef.current = next;
      onProgressChange(next);
    }
  }, [
    emitMetric,
    onProgressChange,
    state.elapsedMs,
    state.pageIndex,
    state.sessionStartedAtMs,
  ]);

  useEffect(() => {
    if (state.phase !== 'rest' || completionHandledRef.current) {
      return;
    }
    completionHandledRef.current = true;
    emitMetric({
      name: 'elapsed-time',
      storyId: lockedStoryIdRef.current,
      elapsedMs: Math.min(state.elapsedMs, STORY_THAT_WAITS_SESSION_MAX_MS),
    });
    const completedAllPages = (
      state.pageIndex === STORY_THAT_WAITS_PAGE_IDS.length - 1
      && state.diagnostic !== 'Session reached its maximum duration.'
    );
    if (completedAllPages && progressRef.current && onProgressChange) {
      const next = recordCommunicationSessionCompleted(
        progressRef.current,
        STORY_THAT_WAITS_VERSION,
      );
      progressRef.current = next;
      onProgressChange(next);
    }
  }, [
    emitMetric,
    onProgressChange,
    state.diagnostic,
    state.elapsedMs,
    state.pageIndex,
    state.phase,
  ]);

  useEffect(() => () => {
    if (touchPulseTimerRef.current !== null) {
      window.clearTimeout(touchPulseTimerRef.current);
    }
    microphoneRef.current.stop();
    mediaCancellationEpochRef.current += 1;
    mediaCoordinator.cancelAll('exit');
  }, [mediaCoordinator]);

  const pulseTouch = useCallback((): void => {
    setTouchPulse(true);
    if (touchPulseTimerRef.current !== null) {
      window.clearTimeout(touchPulseTimerRef.current);
    }
    touchPulseTimerRef.current = window.setTimeout(() => {
      touchPulseTimerRef.current = null;
      if (aliveRef.current) {
        setTouchPulse(false);
      }
    }, 180);
  }, []);

  const handleBookInteraction = useCallback((): void => {
    const snapshot = stateRef.current;
    const claimsBlockedStart = (
      snapshot.phase === 'paused'
      && (snapshot.pausedResumeTarget === 'tutorial' || snapshot.pausedResumeTarget === 'loading-story')
      && readiness.status === 'ready'
    );
    if (claimsBlockedStart && startGestureClaimedRef.current) {
      return;
    }
    if (claimsBlockedStart) {
      startGestureClaimedRef.current = true;
    }
    setTutorialActive(false);
    pulseTouch();
    mediaCoordinator.unlock();
    if (snapshot.phase === 'tutorial') {
      return;
    }
    if (snapshot.phase === 'paused') {
      dispatch({ type: 'resume-after-pause' });
      if (
        (snapshot.pausedResumeTarget === 'tutorial' || snapshot.pausedResumeTarget === 'loading-story')
        && readiness.status === 'ready'
      ) {
        automaticStartBlockedRef.current = false;
        const lockedStoryId = lockedStoryIdRef.current;
        const lockedLocale = lockedLocaleRef.current;
        dispatch({ type: 'request-story', storyId: lockedStoryId, locale: lockedLocale });
        dispatch({
          type: 'story-ready',
          storyId: lockedStoryId,
          locale: lockedLocale,
          mandatoryNarrationPages: allMandatoryPagesReady(),
        });
        return;
      }
      dispatch({ type: 'touch-advance' });
      return;
    }
    if (
      snapshot.phase === 'narrating-page'
    ) {
      dispatch({ type: 'touch-advance' });
      return;
    }
    if (
      snapshot.phase === 'guard'
      || snapshot.phase === 'turn1'
      || snapshot.phase === 'turn2'
    ) {
      mediaCoordinator.notifyInteraction(currentScope, 'touch');
      dispatch({ type: 'touch-advance' });
    }
  }, [currentScope, mediaCoordinator, pulseTouch, readiness.status]);

  const handleReplay = useCallback((): void => {
    const snapshot = stateRef.current;
    if (
      snapshot.pageIndex === null
      || runtimeError
      || replayActiveRef.current
      || snapshot.pausedResumeTarget === 'ending'
      || snapshot.pausedResumeTarget === 'narrating-page'
      || (
        snapshot.phase !== 'paused'
        && snapshot.phase !== 'guard'
      )
    ) {
      return;
    }
    if (snapshot.phase === 'paused') {
      dispatch({ type: 'resume-after-pause' });
    }
    mediaCoordinator.unlock();
    microphoneRef.current.stop();
    mediaCoordinator.notifyInteraction(currentScope, 'round-replacement');
    replayActiveRef.current = true;
    setResumeReplayActive(true);
    const cancellationEpoch = mediaCancellationEpochRef.current;
    const snapshotToken = getStoryThatWaitsGenerationToken(snapshot);
    const token = snapshot.phase === 'paused'
      ? { ...snapshotToken, stepGeneration: snapshotToken.stepGeneration + 1 }
      : snapshotToken;
    const page = story.pages[snapshot.pageIndex]!;
    void playPage(page, token, 'touch', 'replay').then(
      (outcome) => {
        if (
          cancellationEpoch !== mediaCancellationEpochRef.current
          || !isCurrentToken(stateRef.current, token)
        ) {
          return;
        }
        replayActiveRef.current = false;
        if (aliveRef.current) {
          setResumeReplayActive(false);
        }
        if (outcome.status !== 'completed') {
          reportMediaError(
            `mandatory-replay-${outcome.status}`,
            `Mandatory replay did not complete for ${page.id}.`,
          );
        }
      },
      (error: unknown) => {
        if (
          cancellationEpoch !== mediaCancellationEpochRef.current
          || !isCurrentToken(stateRef.current, token)
        ) {
          return;
        }
        replayActiveRef.current = false;
        if (aliveRef.current) {
          setResumeReplayActive(false);
        }
        const diagnostic = error instanceof Error ? error.message : 'Mandatory replay failed.';
        reportMediaError('mandatory-replay-failed', diagnostic);
      },
    );
  }, [
    currentScope,
    mediaCoordinator,
    playPage,
    reportMediaError,
    runtimeError,
    story.pages,
  ]);

  const handleExit = useCallback((): void => {
    microphoneRef.current.stop();
    mediaCancellationEpochRef.current += 1;
    mediaCoordinator.cancelAll('exit');
    const snapshot = stateRef.current;
    emitMetric({
      name: 'exit',
      storyId: lockedStoryIdRef.current,
      page: pageNumber(snapshot),
      elapsedMs: snapshot.elapsedMs,
    });
    onExit();
  }, [emitMetric, mediaCoordinator, onExit]);

  const isTutorial = tutorialActive && (
    state.phase === 'tutorial'
    || state.phase === 'loading-story'
    || state.pageIndex === 0
  );
  const isEnding = state.phase === 'ending' || state.phase === 'rest';
  const isAction = state.phase === 'page-action' || state.phase === 'page-transition' || isEnding;
  const isWaiting = state.phase === 'guard' || state.phase === 'turn1' || state.phase === 'turn2';
  const blockedDiagnostic = runtimeError ?? (readiness.status === 'blocked' ? readiness.diagnostic : null);
  const accessibilityLabel = state.pageIndex === null
    ? copy.waiting
    : selectedPage.utterances[lockedLocale].accessibilityLabel;
  const liveStatus = blockedDiagnostic
    ? copy.blocked
    : state.phase === 'rest'
      ? copy.rest
      : accessibilityLabel;

  return (
    <GameShell
      ariaLabel={copy.game}
      languageMode={lockedLocale === 'he-IL' ? 'he' : 'en'}
      accentClass="story-that-waits-shell"
      reducedMotion={settings.reducedMotion}
      onHome={handleExit}
      {...(state.pageIndex === null ? {} : { onRepeat: handleReplay })}
      repeatDisabled={
        Boolean(blockedDiagnostic)
        || state.phase === 'narrating-page'
        || state.phase === 'turn1'
        || state.phase === 'turn2'
        || state.phase === 'page-action'
        || state.phase === 'page-transition'
        || state.phase === 'ending'
        || state.phase === 'rest'
        || state.pausedResumeTarget === 'ending'
        || state.pausedResumeTarget === 'narrating-page'
        || resumeReplayActive
      }
      repeatSpeaking={state.phase === 'narrating-page' || resumeReplayActive}
      replayLabel={copy.replay}
      homeLabel={copy.back}
      liveStatus={liveStatus}
    >
      <div
        className={`story-that-waits ${touchPulse ? 'is-touching' : ''}`}
        data-phase={state.phase}
        data-page={pageNumber(state) ?? 0}
        data-action={selectedPage.action.kind}
        data-locale={lockedLocale}
        data-reduced-motion={settings.reducedMotion ? 'true' : 'false'}
      >
        {blockedDiagnostic ? (
          <section className="story-unavailable" aria-label={copy.blocked}>
            <PuppyMascotArt mood="idle" className="story-unavailable__mascot" />
            <div className="story-unavailable__book" aria-hidden="true">
              <span />
              <span />
            </div>
            <details className="story-diagnostic">
              <summary>{copy.diagnostic}</summary>
              <code>{blockedDiagnostic}</code>
            </details>
          </section>
        ) : (
          <>
            <PuppyMascotArt
              mood={isEnding ? 'happy' : 'idle'}
              className={`story-guide ${isTutorial ? 'is-tutorial' : ''} ${isEnding ? 'is-waving' : ''}`}
            />
            <button
              className={`story-book ${isTutorial ? 'is-tutorial' : ''} ${isAction ? 'is-performing' : ''} ${isWaiting ? 'is-waiting' : ''} ${state.phase === 'rest' ? 'is-closed' : ''}`}
              type="button"
              onClick={handleBookInteraction}
              disabled={readiness.status === 'checking' || state.phase === 'rest' || state.phase === 'ending'}
              aria-label={accessibilityLabel}
            >
              <span className="story-book__cover" aria-hidden="true" />
              <span className="story-book__spread">
                <span className="story-book__page story-book__page--left" aria-hidden="true" />
                <span className="story-book__page story-book__page--right">
                  <span className="story-scene" aria-hidden="true">
                    {selectedPage.artIds.map((artId) => (
                      <ConceptArt
                        key={artId}
                        conceptId={artId}
                        className={`story-scene__art story-scene__art--${artId} ${artId === selectedPage.action.subjectArtId ? 'is-action-subject' : ''}`}
                      />
                    ))}
                  </span>
                  <span className="story-action-hotspot" aria-hidden="true" />
                </span>
              </span>
            </button>
            <div className="story-sound-visual" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            {caregiverDiagnostic ? (
              <details className="story-diagnostic">
                <summary>{copy.diagnostic}</summary>
                <code>{caregiverDiagnostic}</code>
              </details>
            ) : null}
          </>
        )}
      </div>
    </GameShell>
  );
}
