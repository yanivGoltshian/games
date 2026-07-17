import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { PuppyMascotArt } from '../art/mascot';
import { GameShell } from '../components/GameShell';
import {
  SYLLABLE_TRAIN_WORDS,
  WORD_TRAIN_CONTENT_VERSION,
  WordTrainRoundLocaleLock,
} from '../content/syllableTrain';
import { gameMeta } from '../content/games';
import { createCommunicationLocaleLock, type CommunicationInputSource } from '../domain/communicationGame';
import {
  generateSyllableTrainRound,
  getSyllableTrainRoundSignature,
} from '../domain/rounds';
import type { CommunicationGameScope } from '../domain/communicationGame';
import { useAppLifecycle } from '../platform/useAppLifecycle';
import {
  communicationAssetReadiness,
  type CommunicationContentRequirements,
  type InstalledCommunicationContent,
} from '../services/communicationAssetReadiness';
import { DEFAULT_MICROPHONE_PLAYBACK_GUARD_MS } from '../services/microphonePlaybackGuard';
import { soundService } from '../services/sound';
import type { InteractionMediaOutcome } from '../services/interactionMediaCoordinator';
import type { ToddlerGameProps } from './types';
import {
  createInitialSyllableTrainState,
  hasWordTrainSessionEnded,
  isPointNearCoupler,
  reduceSyllableTrain,
  WORD_TRAIN_FIRST_OPPORTUNITY_MS,
  WORD_TRAIN_REST_MS,
  WORD_TRAIN_REWARD_MS,
  WORD_TRAIN_SECOND_OPPORTUNITY_MS,
  WORD_TRAIN_SESSION_LIMIT_MS,
  type WordTrainTutorialStep,
} from './syllableTrainState';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useGenerationToken } from './useGenerationToken';
import { useMicEffort } from './useMicEffort';
import { wordTrainMediaCoordinator } from './wordTrainMedia';
import {
  appendWordTrainContentId,
  INITIAL_WORD_TRAIN_METRICS,
  type WordTrainMetrics,
  type WordTrainMetricsCallback,
} from './wordTrainMetrics';

const TUTORIAL_STORAGE_KEY = `${WORD_TRAIN_CONTENT_VERSION}:tutorial-seen`;
const RECENT_CONTENT_LIMIT = 12;
const POINTER_MOVE_THRESHOLD_PX = 8;
const AUTO_CONNECT_SETTLE_MS = 180;

const WORD_TRAIN_INSTALLED_CONTENT: InstalledCommunicationContent = {
  contentVersion: WORD_TRAIN_CONTENT_VERSION,
  images: SYLLABLE_TRAIN_WORDS.map((word) => ({ kind: 'url', value: word.image })),
};

interface ActivePointer {
  pointerId: number;
  role: 'left' | 'right';
  startX: number;
  startY: number;
  moved: boolean;
}

interface MetricDetails {
  recentContentIds: string[];
  mediaErrors: number;
  latestModelPlaybackMs: number | null;
  latestConnectionMs: number | null;
}

export interface SyllableTrainGameProps extends ToddlerGameProps {
  onCommunicationMetrics?: WordTrainMetricsCallback;
}

function tutorialWasSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberTutorial(): void {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  } catch {
    // Storage is optional; the in-memory session still continues.
  }
}

function performanceNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function genericLabel(englishOnly: boolean, control: 'left' | 'right' | 'voice' | 'retry'): string {
  if (englishOnly) {
    return {
      left: 'Connect left carriage',
      right: 'Connect right carriage',
      voice: 'Use microphone',
      retry: 'Try loading again',
    }[control];
  }
  return {
    left: 'חיבור הקרון השמאלי',
    right: 'חיבור הקרון הימני',
    voice: 'שימוש במיקרופון',
    retry: 'ניסיון טעינה נוסף',
  }[control];
}

export function SyllableTrainGame({
  domainProgress,
  settings,
  mediaReady,
  onBack,
  onCommunicationMetrics,
}: SyllableTrainGameProps) {
  const sessionId = useId();
  const lifecycle = useAppLifecycle();
  const [state, dispatch] = useReducer(
    reduceSyllableTrain,
    undefined,
    () => createInitialSyllableTrainState({
      tutorialRequired: !tutorialWasSeen(),
      now: Date.now(),
    }),
  );
  const [voiceActive, setVoiceActive] = useState(false);
  const [metricDetails, setMetricDetails] = useState<MetricDetails>({
    recentContentIds: INITIAL_WORD_TRAIN_METRICS.recentContentIds,
    mediaErrors: 0,
    latestModelPlaybackMs: null,
    latestConnectionMs: null,
  });
  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'syllableTrain',
    domainProgress,
    generateSyllableTrainRound,
    { getSignature: getSyllableTrainRoundSignature, limit: 8 },
  );

  const localeControllerRef = useRef<WordTrainRoundLocaleLock | null>(null);
  localeControllerRef.current ??= new WordTrainRoundLocaleLock();
  const lockedLocale = localeControllerRef.current.forRound(String(roundKey), settings);
  const mediaScope = useMemo<CommunicationGameScope>(() => ({
    activityId: 'syllableTrain',
    sessionId,
    roundId: String(roundKey),
    stepId: state.phase,
  }), [roundKey, sessionId, state.phase]);
  const localeLock = useMemo(
    () => createCommunicationLocaleLock(mediaScope, lockedLocale, 'round'),
    [lockedLocale, mediaScope],
  );
  const generation = useGenerationToken(mediaScope);
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const stateRef = useRef(state);
  stateRef.current = state;
  const scopeRef = useRef(mediaScope);
  scopeRef.current = mediaScope;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pointerRef = useRef<ActivePointer | null>(null);
  const ignoredPointerIdsRef = useRef(new Set<number>());
  const suppressClickRef = useRef(false);
  const couplerRef = useRef<HTMLDivElement | null>(null);
  const connectIntentRef = useRef<(source: CommunicationInputSource) => void>(() => undefined);
  const tutorialPlaybackRef = useRef(false);
  const rewardRoundRef = useRef<string | null>(null);
  const observedRoundKeysRef = useRef(new Set<string>());
  const assetFailureRoundRef = useRef<string | null>(null);
  const modelCompletedAtRef = useRef<number | null>(null);

  const mic = useMicEffort((level) => {
    if (level === 1 && stateRef.current.phase === 'first-opportunity') {
      connectIntentRef.current('voice');
    }
  }, {
    generation: {
      token: generation.token,
      isCurrent: generation.isCurrent,
    },
  });
  const micRef = useRef(mic);
  micRef.current = mic;

  const recordMediaError = useCallback((): void => {
    setMetricDetails((current) => ({
      ...current,
      mediaErrors: current.mediaErrors + 1,
    }));
  }, []);

  const failAssets = useCallback((): void => {
    const key = String(roundKey);
    if (assetFailureRoundRef.current !== key) {
      assetFailureRoundRef.current = key;
      recordMediaError();
    }
    micRef.current.stop();
    dispatch({ type: 'asset-error' });
  }, [recordMediaError, roundKey]);

  const playLockedWholeWord = useCallback((
    source: CommunicationInputSource,
    intentSuffix: string,
  ): Promise<InteractionMediaOutcome> => {
    const recordingKey = round.recordings[lockedLocale];
    return wordTrainMediaCoordinator.play({
      intentId: `word-train:${sessionId}:${String(roundKey)}:${intentSuffix}`,
      source,
      scope: mediaScope,
      audioClass: 'mandatory',
      settings,
      localeLock,
      segments: [{
        text: recordingKey,
        recordedText: recordingKey,
        locale: lockedLocale,
      }],
    });
  }, [localeLock, lockedLocale, mediaScope, round.recordings, roundKey, sessionId, settings]);

  const requestConnection = useCallback((source: CommunicationInputSource): void => {
    const current = stateRef.current;
    if (
      current.connected
      || current.phase === 'reward'
      || current.phase === 'rest'
      || current.phase === 'session-stop'
      || (current.phase === 'auto-connect' && source !== 'automatic')
    ) {
      return;
    }
    if (
      current.phase !== 'mandatory-model'
      && current.phase !== 'available'
      && current.phase !== 'first-opportunity'
      && current.phase !== 'second-opportunity'
      && current.phase !== 'auto-connect'
    ) {
      return;
    }
    micRef.current.stop();
    setVoiceActive(false);
    wordTrainMediaCoordinator.notifyInteraction(scopeRef.current, source);
    dispatch({ type: 'request-connect' });
  }, []);
  connectIntentRef.current = requestConnection;

  const metrics = useMemo<WordTrainMetrics>(() => ({
    sessions: state.phase === 'session-stop' ? 1 : 0,
    trainsSeen: state.trainsSeen,
    trainsConnected: state.trainsConnected,
    recentContentIds: metricDetails.recentContentIds,
    dragCancellations: state.dragCancellations,
    mediaErrors: metricDetails.mediaErrors,
    performanceTimings: {
      sessionElapsedMs: Math.max(0, Date.now() - state.sessionStartedAt),
      latestModelPlaybackMs: metricDetails.latestModelPlaybackMs,
      latestConnectionMs: metricDetails.latestConnectionMs,
    },
  }), [
    metricDetails,
    state.dragCancellations,
    state.phase,
    state.sessionStartedAt,
    state.trainsConnected,
    state.trainsSeen,
  ]);

  useEffect(() => {
    onCommunicationMetrics?.(metrics);
  }, [metrics, onCommunicationMetrics]);

  useEffect(() => {
    if (state.phase !== 'preparation') {
      return;
    }
    const key = String(roundKey);
    if (observedRoundKeysRef.current.has(key)) {
      return;
    }
    observedRoundKeysRef.current.add(key);
    assetFailureRoundRef.current = null;
    setMetricDetails((current) => ({
      ...current,
      recentContentIds: appendWordTrainContentId(
        current.recentContentIds,
        round.conceptId,
        RECENT_CONTENT_LIMIT,
      ),
    }));
  }, [round.conceptId, roundKey, state.phase]);

  useEffect(() => {
    const preparingTutorial = state.phase === 'tutorial' && state.tutorialStep === 'waiting';
    if ((!preparingTutorial && state.phase !== 'preparation') || !mediaReady) {
      return undefined;
    }
    const token = generation.token;
    let cancelled = false;
    const requirements: CommunicationContentRequirements = {
      contentVersion: round.contentVersion,
      scope: mediaScope,
      locale: lockedLocale,
      localeLock,
      recordingKeys: [round.recordings[lockedLocale]],
      images: [{ kind: 'url', value: round.image }],
    };
    void communicationAssetReadiness
      .validate(requirements, WORD_TRAIN_INSTALLED_CONTENT)
      .then((readiness) => {
        if (
          cancelled
          || !generationRef.current.isCurrent(token)
        ) {
          return;
        }
        if (readiness.status !== 'ready') {
          failAssets();
          return;
        }
        dispatch({ type: preparingTutorial ? 'tutorial-assets-ready' : 'assets-ready' });
      });
    return () => {
      cancelled = true;
    };
  }, [
    failAssets,
    generation.token,
    lockedLocale,
    localeLock,
    mediaReady,
    mediaScope,
    round.contentVersion,
    round.image,
    round.recordings,
    state.phase,
    state.tutorialStep,
  ]);

  useEffect(() => {
    if (state.phase !== 'tutorial') {
      tutorialPlaybackRef.current = false;
      return undefined;
    }
    const nextStep: Partial<Record<WordTrainTutorialStep, {
      delay: number;
      step: 'tap-left' | 'tap-right' | 'connected' | 'lit' | 'modeling';
    }>> = {
      ready: { delay: 320, step: 'tap-left' },
      'tap-left': { delay: 420, step: 'tap-right' },
      'tap-right': { delay: 420, step: 'connected' },
      connected: { delay: 360, step: 'lit' },
      lit: { delay: 360, step: 'modeling' },
    };
    const next = nextStep[state.tutorialStep];
    if (next) {
      const timer = window.setTimeout(() => {
        dispatch({ type: 'tutorial-step', step: next.step });
      }, next.delay);
      return () => window.clearTimeout(timer);
    }
    if (state.tutorialStep !== 'modeling' || tutorialPlaybackRef.current) {
      return undefined;
    }

    tutorialPlaybackRef.current = true;
    const token = generation.token;
    void playLockedWholeWord('automatic', 'tutorial').then((outcome) => {
      if (!generationRef.current.isCurrent(token)) {
        return;
      }
      if (outcome.status === 'completed') {
        rememberTutorial();
        dispatch({ type: 'tutorial-complete', now: Date.now() });
      } else if (outcome.status === 'errored' || outcome.status === 'unavailable') {
        failAssets();
      }
    });
    return undefined;
  }, [
    failAssets,
    generation.token,
    playLockedWholeWord,
    state.phase,
    state.tutorialStep,
  ]);

  useEffect(() => {
    if (state.phase !== 'mandatory-model') {
      return undefined;
    }
    micRef.current.stop();
    setVoiceActive(false);
    const token = generation.token;
    const startedAt = performanceNow();
    void playLockedWholeWord('automatic', 'mandatory').then((outcome) => {
      if (!generationRef.current.isCurrent(token)) {
        return;
      }
      if (outcome.status === 'completed') {
        const completedAt = performanceNow();
        modelCompletedAtRef.current = completedAt;
        setMetricDetails((current) => ({
          ...current,
          latestModelPlaybackMs: Math.max(0, completedAt - startedAt),
        }));
        dispatch({ type: 'model-complete', now: Date.now() });
      } else if (outcome.status === 'errored' || outcome.status === 'unavailable') {
        failAssets();
      }
    });
    return undefined;
  }, [failAssets, generation.token, playLockedWholeWord, state.phase]);

  useEffect(() => {
    if (state.phase !== 'available') {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      dispatch({ type: 'begin-first-opportunity' });
    }, DEFAULT_MICROPHONE_PLAYBACK_GUARD_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'first-opportunity') {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      micRef.current.stop();
      setVoiceActive(false);
      dispatch({ type: 'opportunity-expired' });
    }, WORD_TRAIN_FIRST_OPPORTUNITY_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'second-opportunity') {
      return undefined;
    }
    micRef.current.stop();
    setVoiceActive(false);
    const timer = window.setTimeout(() => {
      dispatch({ type: 'opportunity-expired' });
    }, WORD_TRAIN_SECOND_OPPORTUNITY_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'auto-connect') {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      requestConnection('automatic');
    }, AUTO_CONNECT_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [requestConnection, state.phase]);

  useEffect(() => {
    if (state.phase !== 'reward' || rewardRoundRef.current === String(roundKey)) {
      return undefined;
    }
    rewardRoundRef.current = String(roundKey);
    micRef.current.stop();
    setVoiceActive(false);
    soundService.playTap(settingsRef.current);
    const connectedAt = performanceNow();
    const modelCompletedAt = modelCompletedAtRef.current;
    setMetricDetails((current) => ({
      ...current,
      latestConnectionMs: modelCompletedAt === null
        ? null
        : Math.max(0, connectedAt - modelCompletedAt),
    }));
    const timer = window.setTimeout(
      () => dispatch({ type: 'reward-finished' }),
      settingsRef.current.reducedMotion ? 180 : WORD_TRAIN_REWARD_MS,
    );
    return () => window.clearTimeout(timer);
  }, [roundKey, state.phase]);

  useEffect(() => {
    if (state.phase !== 'rest') {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const now = Date.now();
      if (!hasWordTrainSessionEnded(stateRef.current, now)) {
        startNextRound();
      }
      dispatch({ type: 'rest-finished', now });
    }, settingsRef.current.reducedMotion ? 120 : WORD_TRAIN_REST_MS);
    return () => window.clearTimeout(timer);
  }, [startNextRound, state.phase]);

  useEffect(() => {
    const elapsed = Date.now() - state.sessionStartedAt;
    const remaining = Math.max(0, WORD_TRAIN_SESSION_LIMIT_MS - elapsed);
    const timer = window.setTimeout(() => {
      generationRef.current.invalidate();
      micRef.current.stop();
      wordTrainMediaCoordinator.notifyInteraction(scopeRef.current, 'exit');
      dispatch({ type: 'session-timeout' });
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [state.sessionStartedAt]);

  useEffect(() => {
    if (lifecycle === 'background') {
      generationRef.current.invalidate();
      micRef.current.stop();
      setVoiceActive(false);
      pointerRef.current = null;
      wordTrainMediaCoordinator.notifyInteraction(scopeRef.current, 'background');
      dispatch({ type: 'background' });
    } else if (stateRef.current.phase === 'paused') {
      const current = stateRef.current;
      const now = Date.now();
      if (
        current.advanceRoundOnForeground
        && !hasWordTrainSessionEnded(current, now)
      ) {
        startNextRound();
      }
      dispatch({ type: 'foreground', now });
    }
  }, [lifecycle, startNextRound]);

  useEffect(() => {
    const handleOrientation = (): void => {
      pointerRef.current = null;
      ignoredPointerIdsRef.current.clear();
      suppressClickRef.current = false;
      dispatch({ type: 'orientation-change' });
    };
    window.addEventListener('orientationchange', handleOrientation);
    return () => window.removeEventListener('orientationchange', handleOrientation);
  }, []);

  useEffect(() => () => {
    generationRef.current.invalidate();
    micRef.current.stop();
    wordTrainMediaCoordinator.notifyInteraction(scopeRef.current, 'exit');
  }, []);

  const interruptTutorial = useCallback((): void => {
    if (stateRef.current.phase !== 'tutorial') {
      return;
    }
    soundService.unlock();
    generationRef.current.invalidate();
    micRef.current.stop();
    wordTrainMediaCoordinator.notifyInteraction(scopeRef.current, 'round-replacement');
    rememberTutorial();
    dispatch({ type: 'tutorial-interrupt', now: Date.now() });
  }, []);

  const handlePointerDown = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    role: ActivePointer['role'],
  ): void => {
    suppressClickRef.current = false;
    const current = stateRef.current;
    if (current.phase === 'mandatory-model') {
      dispatch({ type: 'request-connect' });
      return;
    }
    if (
      current.phase !== 'available'
      && current.phase !== 'first-opportunity'
      && current.phase !== 'second-opportunity'
    ) {
      return;
    }
    if (pointerRef.current !== null) {
      ignoredPointerIdsRef.current.add(event.pointerId);
      event.preventDefault();
      return;
    }
    ignoredPointerIdsRef.current.delete(event.pointerId);
    soundService.unlock();
    pointerRef.current = {
      pointerId: event.pointerId,
      role,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dispatch({ type: 'pointer-begin', pointerId: event.pointerId });
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    const active = pointerRef.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }
    const x = event.clientX - active.startX;
    const y = event.clientY - active.startY;
    if (Math.hypot(x, y) >= POINTER_MOVE_THRESHOLD_PX) {
      active.moved = true;
    }
    dispatch({ type: 'pointer-move', pointerId: event.pointerId, x, y });
  }, []);

  const finishPointer = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    forcedCancel = false,
  ): void => {
    if (ignoredPointerIdsRef.current.has(event.pointerId)) {
      event.preventDefault();
      if (forcedCancel) {
        ignoredPointerIdsRef.current.delete(event.pointerId);
      }
      return;
    }
    const active = pointerRef.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }
    pointerRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!active.moved) {
      dispatch({ type: 'pointer-end', pointerId: event.pointerId, cancelled: false });
      return;
    }
    suppressClickRef.current = !forcedCancel;
    const targetRect = couplerRef.current?.getBoundingClientRect();
    const nearTarget = !forcedCancel && targetRect
      ? isPointNearCoupler(
        { x: event.clientX, y: event.clientY },
        targetRect,
      )
      : false;
    dispatch({
      type: 'pointer-end',
      pointerId: event.pointerId,
      cancelled: !nearTarget,
    });
    if (nearTarget) {
      requestConnection('touch');
    }
  }, [requestConnection]);

  const handleCarClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>): void => {
    const nativePointerId = 'pointerId' in event.nativeEvent
      ? Number(event.nativeEvent.pointerId)
      : null;
    if (nativePointerId !== null && ignoredPointerIdsRef.current.delete(nativePointerId)) {
      return;
    }
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    requestConnection('touch');
  }, [requestConnection]);

  const handleVoice = useCallback((): void => {
    if (stateRef.current.phase !== 'first-opportunity') {
      return;
    }
    if (voiceActive) {
      micRef.current.stop();
      setVoiceActive(false);
      return;
    }
    soundService.unlock();
    const token = generationRef.current.token;
    void micRef.current.start().then((outcome) => {
      if (
        !generationRef.current.isCurrent(token)
        || stateRef.current.phase !== 'first-opportunity'
      ) {
        micRef.current.stop();
        return;
      }
      setVoiceActive(outcome.status === 'started');
    });
  }, [voiceActive]);

  const handleBack = useCallback((): void => {
    generationRef.current.invalidate();
    micRef.current.stop();
    wordTrainMediaCoordinator.notifyInteraction(scopeRef.current, 'exit');
    onBack();
  }, [onBack]);

  const retryAssets = useCallback((): void => {
    assetFailureRoundRef.current = null;
    dispatch({ type: 'retry-assets' });
  }, []);

  const englishOnly = lockedLocale !== 'he-IL';
  const trainAriaLabel = englishOnly ? 'Word Train' : 'רכבת המילים';
  const actionAvailable = (
    state.phase === 'mandatory-model'
    || state.phase === 'available'
    || state.phase === 'first-opportunity'
    || state.phase === 'second-opportunity'
  );
  const leftOwnsPointer = state.pointerOwner !== null && pointerRef.current?.role === 'left';
  const rightOwnsPointer = state.pointerOwner !== null && pointerRef.current?.role === 'right';
  const pointerStyle = {
    '--train-drag-x': `${state.pointerOffset.x}px`,
    '--train-drag-y': `${state.pointerOffset.y}px`,
  } as CSSProperties;
  const liveStatus = englishOnly ? 'Train play area' : 'משחק רכבת';

  return (
    <GameShell
      ariaLabel={trainAriaLabel}
      languageMode={settings.languageMode}
      accentClass={gameMeta.syllableTrain.accentClass}
      reducedMotion={settings.reducedMotion}
      onHome={handleBack}
      replayLabel={englishOnly ? 'Replay' : 'השמעה חוזרת'}
      homeLabel={englishOnly ? 'Back home' : 'חזרה לבית'}
      liveStatus={liveStatus}
    >
      <div
        className="syllable-train-surface"
        data-phase={state.phase}
        data-tutorial-step={state.tutorialStep}
        data-connected={state.connected ? 'true' : 'false'}
        data-pending={state.pendingConnect ? 'true' : 'false'}
        data-lit={state.conceptLit ? 'true' : 'false'}
        data-reduced-motion={settings.reducedMotion ? 'true' : 'false'}
        onPointerDownCapture={interruptTutorial}
      >
        <div className="syllable-train-station" aria-hidden="true">
          <span className="syllable-train-station__roof" />
          <span className="syllable-train-station__clock" />
        </div>

        <div className="syllable-train-concept" aria-hidden="true">
          <img
            src={round.image}
            alt=""
            className="syllable-train-concept__image"
            draggable={false}
            onError={failAssets}
          />
          <span className="syllable-train-concept__glow" />
        </div>

        <PuppyMascotArt
          mood={state.conceptLit ? 'happy' : 'idle'}
          className="syllable-train-mascot"
        />

        <div
          className="syllable-train-track"
          data-riding={state.phase === 'reward' ? 'true' : 'false'}
        >
          <button
            type="button"
            className={`syllable-train-car syllable-train-car--left ${leftOwnsPointer ? 'is-dragging' : ''}`}
            aria-label={genericLabel(englishOnly, 'left')}
            aria-disabled={!actionAvailable}
            tabIndex={actionAvailable ? 0 : -1}
            style={leftOwnsPointer ? pointerStyle : undefined}
            onClick={handleCarClick}
            onPointerDown={(event) => handlePointerDown(event, 'left')}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointer}
            onPointerCancel={(event) => finishPointer(event, true)}
          >
            <span className="syllable-train-car__image-clip" aria-hidden="true">
              <img src={round.image} alt="" draggable={false} onError={failAssets} />
            </span>
            <span className="syllable-train-car__wheels" aria-hidden="true" />
          </button>

          <div className="syllable-train-coupler-target" ref={couplerRef} aria-hidden="true">
            <span />
          </div>

          <button
            type="button"
            className={`syllable-train-car syllable-train-car--right ${rightOwnsPointer ? 'is-dragging' : ''}`}
            aria-label={genericLabel(englishOnly, 'right')}
            aria-disabled={!actionAvailable}
            tabIndex={actionAvailable ? 0 : -1}
            style={rightOwnsPointer ? pointerStyle : undefined}
            onClick={handleCarClick}
            onPointerDown={(event) => handlePointerDown(event, 'right')}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointer}
            onPointerCancel={(event) => finishPointer(event, true)}
          >
            <span className="syllable-train-car__image-clip" aria-hidden="true">
              <img src={round.image} alt="" draggable={false} onError={failAssets} />
            </span>
            <span className="syllable-train-car__wheels" aria-hidden="true" />
          </button>
        </div>

        {state.phase === 'first-opportunity' && mic.supported ? (
          <button
            type="button"
            className={`syllable-train-voice ${voiceActive ? 'is-active' : ''}`}
            aria-label={genericLabel(englishOnly, 'voice')}
            aria-pressed={voiceActive}
            onClick={handleVoice}
          >
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <rect x="23" y="8" width="18" height="31" rx="9" />
              <path d="M16 29c0 10 6 17 16 17s16-7 16-17M32 46v10M23 56h18" />
            </svg>
          </button>
        ) : null}

        {state.phase === 'asset-error' ? (
          <button
            type="button"
            className="syllable-train-retry"
            aria-label={genericLabel(englishOnly, 'retry')}
            onClick={retryAssets}
          >
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path d="M49 23a20 20 0 1 0 1 17M49 10v13H36" />
            </svg>
          </button>
        ) : null}

        {state.phase === 'session-stop' ? (
          <div className="syllable-train-session-stop" aria-hidden="true">
            <span className="syllable-train-session-stop__bumper" />
            <span className="syllable-train-session-stop__lamp" />
          </div>
        ) : null}
      </div>
    </GameShell>
  );
}
