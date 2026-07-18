import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ToyPhoneCallerArt,
  ToyPhoneDeviceArt,
  ToyPhoneObjectArt,
} from '../art/toyPhone';
import { GameShell } from '../components/GameShell';
import {
  getToyPhoneConversation,
  TOY_PHONE_SHELF_META,
  type ToyPhoneTurnId,
} from '../content/toyPhone';
import { learningConcepts } from '../content/concepts';
import {
  createCommunicationLocaleLock,
  type CommunicationGameScope,
} from '../domain/communicationGame';
import type { SpeechLocale, ToddlerSettings } from '../domain/types';
import { useAppLifecycle } from '../platform/useAppLifecycle';
import {
  readPreparedMicrophoneStatus,
  startToyPhoneDisconnectCue,
  startToyPhoneRingCue,
  toyPhoneMediaCoordinator,
  unlockToyPhoneMedia,
} from '../services/toyPhoneMedia';
import { persistToyPhoneMetric } from '../services/toyPhoneProgressStorage';
import { checkToyPhoneContentReadiness } from '../services/toyPhoneReadiness';
import {
  TOY_PHONE_AUTO_ANSWER_MS,
  TOY_PHONE_SESSION_LIMIT_MS,
  TOY_PHONE_TURN_TIMEOUT_MS,
  createInitialToyPhoneState,
  reduceToyPhone,
  toyPhoneGeneration,
  type ToyPhoneGeneration,
  type ToyPhoneState,
} from './toyPhoneState';
import {
  TOY_PHONE_ANSWERING_MS,
  TOY_PHONE_EFFORT_TARGET_MS,
  TOY_PHONE_IDLE_RING_MS,
  TOY_PHONE_REST_MS,
  TOY_PHONE_REWARD_MS,
  TOY_PHONE_TUTORIAL_ANSWER_MS,
  TOY_PHONE_TUTORIAL_RING_MS,
  selectToyPhoneLocale,
  selectToyPhoneTemplateOffset,
} from './toyPhoneRuntime';
import type { ToddlerGameProps } from './types';
import { useGenerationToken, type GenerationToken } from './useGenerationToken';
import { useMicEffort } from './useMicEffort';
import './ToyPhoneGame.css';

type ReadinessStatus = 'checking' | 'ready' | 'not-ready';

interface RuntimeSnapshot {
  state: ToyPhoneState;
  actionGeneration: ToyPhoneGeneration;
  mediaScope: CommunicationGameScope;
  token: GenerationToken;
  tokenIsCurrent: (token: GenerationToken) => boolean;
  micStart: () => ReturnType<ReturnType<typeof useMicEffort>['start']>;
  micStop: () => void;
  settings: ToddlerSettings;
}

interface TutorialInterruptPointer {
  pointerId: number;
  released: boolean;
}

function eventPointerId(event: Event): number | null {
  return 'pointerId' in event && typeof event.pointerId === 'number'
    ? event.pointerId
    : null;
}

function localizedConceptLabel(
  conceptId: string,
  locale: SpeechLocale,
): string {
  if (conceptId === 'mascot') {
    return locale === 'he-IL' ? 'כַּלְבְּלַב' : 'puppy';
  }
  const concept = learningConcepts.find((entry) => entry.id === conceptId);
  return locale === 'he-IL'
    ? (concept?.spokenHe ?? conceptId)
    : (concept?.en ?? conceptId);
}

function liveStatusFor(state: ToyPhoneState): string {
  const english = state.locale !== 'he-IL';
  switch (state.stage) {
    case 'ringing':
      return english ? 'The toy phone is ringing.' : 'טֵלֵפוֹן הַצַּעֲצוּעַ מְצַלְצֵל.';
    case 'answering':
      return english ? 'The call is connecting.' : 'הַשִּׂיחָה מִתְחַבֶּרֶת.';
    case 'greeting':
    case 'request':
    case 'goodbye':
      return english ? 'The caller is speaking.' : 'הַמִּתְקַשֵּׁר מְדַבֵּר.';
    case 'guard1':
    case 'guard2':
      return english ? 'The phone is waiting quietly.' : 'הַטֵּלֵפוֹן מְחַכֶּה בְּשֶׁקֶט.';
    case 'turn1':
    case 'turn2':
      return english ? 'Your turn.' : 'עַכְשָׁו תּוֹרְךָ.';
    case 'reward':
      return english ? 'The caller is waving goodbye.' : 'הַמִּתְקַשֵּׁר מְנַפְנֵף לְשָׁלוֹם.';
    case 'session-stop':
      return english ? 'The toy phone is sleeping.' : 'טֵלֵפוֹן הַצַּעֲצוּעַ יָשֵׁן.';
    case 'asset-error':
      return english ? 'The call content is unavailable.' : 'תֹּכֶן הַשִּׂיחָה לֹא זָמִין.';
    default:
      return english ? 'The toy phone is ready.' : 'טֵלֵפוֹן הַצַּעֲצוּעַ מוּכָן.';
  }
}

function activeTurn(state: ToyPhoneState): ToyPhoneTurnId | null {
  if (state.stage === 'greeting' || state.stage === 'request' || state.stage === 'goodbye') {
    return state.stage;
  }
  if (state.stage === 'tutorial') {
    if (
      state.tutorialStep === 'greeting'
      || state.tutorialStep === 'request'
      || state.tutorialStep === 'goodbye'
    ) {
      return state.tutorialStep;
    }
  }
  return null;
}

function mandatorySpeaking(state: ToyPhoneState): boolean {
  return activeTurn(state) !== null;
}

function showingCaller(state: ToyPhoneState): boolean {
  if (state.stage === 'tutorial') {
    return state.tutorialStep !== 'ringing';
  }
  return !['idle', 'ringing', 'session-stop', 'asset-error', 'paused'].includes(state.stage);
}

function showingObject(state: ToyPhoneState): boolean {
  if (state.stage === 'tutorial') {
    return state.tutorialStep === 'request' || state.tutorialStep === 'goodbye';
  }
  return ['request', 'guard2', 'turn2', 'goodbye', 'reward'].includes(state.stage);
}

export function ToyPhoneGame({
  settings,
  mediaReady,
  onBack,
}: ToddlerGameProps) {
  const [state, dispatch] = useReducer(reduceToyPhone, undefined, createInitialToyPhoneState);
  const [readiness, setReadiness] = useState<ReadinessStatus>('checking');
  const [reaction, setReaction] = useState(0);
  const reactSessionId = useId();
  const lifecycle = useAppLifecycle();
  const currentLocale = selectToyPhoneLocale(settings);
  const mediaScope: CommunicationGameScope = {
    activityId: 'toy-phone',
    sessionId: `${reactSessionId}:${state.sessionGeneration}`,
    roundId: `call:${state.callGeneration}`,
    stepId: `${state.stage}:${state.stepGeneration}`,
  };
  const generation = useGenerationToken(mediaScope);
  const runtimeRef = useRef<RuntimeSnapshot | null>(null);
  const effortMsRef = useRef(0);
  const tutorialInterruptPointerRef = useRef<TutorialInterruptPointer | null>(null);

  const mic = useMicEffort((level, deltaMs) => {
    const snapshot = runtimeRef.current;
    if (
      !snapshot
      || (snapshot.state.stage !== 'turn1' && snapshot.state.stage !== 'turn2')
      || !snapshot.tokenIsCurrent(snapshot.token)
      || level !== 1
    ) {
      return;
    }
    effortMsRef.current += Math.min(100, Math.max(0, deltaMs));
    if (effortMsRef.current < TOY_PHONE_EFFORT_TARGET_MS) {
      return;
    }
    effortMsRef.current = 0;
    snapshot.micStop();
    dispatch({
      type: 'COMPLETE_OPPORTUNITY',
      signal: 'effort',
      generation: snapshot.actionGeneration,
    });
  }, {
    generation: {
      token: generation.token,
      isCurrent: generation.isCurrent,
    },
  });

  runtimeRef.current = {
    state,
    actionGeneration: toyPhoneGeneration(state),
    mediaScope,
    token: generation.token,
    tokenIsCurrent: generation.isCurrent,
    micStart: mic.start,
    micStop: mic.stop,
    settings,
  };

  const readinessPromiseRef = useRef<ReturnType<typeof checkToyPhoneContentReadiness> | null>(null);
  const recordedMetricsRef = useRef({
    session: false,
    readiness: null as null | 'ready' | 'not-ready',
    calls: 0,
    answerGeneration: 0,
    exits: new Set<string>(),
  });

  const persistReadiness = useCallback((status: 'ready' | 'not-ready'): void => {
    if (recordedMetricsRef.current.readiness === status) {
      return;
    }
    recordedMetricsRef.current.readiness = status;
    persistToyPhoneMetric({ type: 'media-readiness', status });
  }, []);

  const persistExit = useCallback((reason: 'back' | 'background' | 'asset-error' | 'three-calls' | 'four-minutes'): void => {
    const sessionGeneration = runtimeRef.current?.state.sessionGeneration ?? 0;
    const key = `${reason}:${sessionGeneration}`;
    if (recordedMetricsRef.current.exits.has(key)) {
      return;
    }
    recordedMetricsRef.current.exits.add(key);
    persistToyPhoneMetric({ type: 'exit', reason });
  }, []);

  useEffect(() => {
    const readinessScope: CommunicationGameScope = {
      activityId: 'toy-phone',
      sessionId: reactSessionId,
      roundId: 'readiness',
      stepId: 'all-54-recordings',
    };
    readinessPromiseRef.current ??= checkToyPhoneContentReadiness(readinessScope);
    let cancelled = false;
    void readinessPromiseRef.current.then((result) => {
      if (cancelled) {
        return;
      }
      if (result.status !== 'ready') {
        persistReadiness('not-ready');
        persistExit('asset-error');
        setReadiness('not-ready');
        dispatch({ type: 'ASSET_ERROR' });
        return;
      }
      persistReadiness('ready');
      if (!recordedMetricsRef.current.session) {
        recordedMetricsRef.current.session = true;
        persistToyPhoneMetric({ type: 'session' });
      }
      setReadiness('ready');
      if (mediaReady) {
        unlockToyPhoneMedia(settings);
      }
      dispatch({
        type: 'START_SESSION',
        now: Date.now(),
        locale: currentLocale,
        templateOffset: selectToyPhoneTemplateOffset(),
      });
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        dispatch({ type: 'PAUSE' });
      }
    }).catch((error: unknown) => {
      if (cancelled) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Toy Phone readiness failed: ${message}`);
      persistReadiness('not-ready');
      persistExit('asset-error');
      setReadiness('not-ready');
      dispatch({ type: 'ASSET_ERROR' });
    });
    return () => {
      cancelled = true;
    };
  }, [currentLocale, mediaReady, persistExit, persistReadiness, reactSessionId, settings]);

  useEffect(() => {
    if (readiness === 'ready' && mediaReady && lifecycle === 'foreground') {
      unlockToyPhoneMedia(settings);
    }
  }, [lifecycle, mediaReady, readiness, settings]);

  useEffect(() => {
    while (recordedMetricsRef.current.calls < state.callsCompleted) {
      recordedMetricsRef.current.calls += 1;
      persistToyPhoneMetric({ type: 'call' });
    }
  }, [state.callsCompleted]);

  useEffect(() => {
    if (
      state.answerMetricGeneration <= recordedMetricsRef.current.answerGeneration
      || state.lastAnswerLatencyMs === null
    ) {
      return;
    }
    recordedMetricsRef.current.answerGeneration = state.answerMetricGeneration;
    persistToyPhoneMetric({
      type: 'time-to-answer',
      milliseconds: state.lastAnswerLatencyMs,
    });
  }, [state.answerMetricGeneration, state.lastAnswerLatencyMs]);

  useEffect(() => {
    if (state.stage === 'session-stop' && state.stopReason) {
      persistExit(state.stopReason);
    }
  }, [persistExit, state.stage, state.stopReason]);

  useEffect(() => {
    if (lifecycle !== 'background') {
      return;
    }
    const snapshot = runtimeRef.current;
    if (snapshot) {
      snapshot.micStop();
      toyPhoneMediaCoordinator.notifyInteraction(snapshot.mediaScope, 'background');
    }
    persistExit('background');
    dispatch({ type: 'PAUSE' });
  }, [lifecycle, persistExit]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const pauseForOrientation = (): void => {
      const snapshot = runtimeRef.current;
      if (snapshot) {
        snapshot.micStop();
        toyPhoneMediaCoordinator.notifyInteraction(snapshot.mediaScope, 'round-replacement');
      }
      dispatch({ type: 'PAUSE' });
    };
    window.addEventListener('orientationchange', pauseForOrientation);
    window.screen.orientation?.addEventListener('change', pauseForOrientation);
    return () => {
      window.removeEventListener('orientationchange', pauseForOrientation);
      window.screen.orientation?.removeEventListener('change', pauseForOrientation);
    };
  }, []);

  useEffect(() => () => {
    const snapshot = runtimeRef.current;
    if (snapshot) {
      snapshot.micStop();
      toyPhoneMediaCoordinator.notifyInteraction(snapshot.mediaScope, 'exit');
    }
  }, []);

  useEffect(() => {
    if (state.stage !== 'asset-error' && state.stage !== 'session-stop') {
      return;
    }
    const snapshot = runtimeRef.current;
    if (snapshot) {
      snapshot.micStop();
      toyPhoneMediaCoordinator.notifyInteraction(snapshot.mediaScope, 'exit');
    }
  }, [state.stage, state.stepGeneration]);

  useEffect(() => {
    if (state.sessionStartedAt === null) {
      return undefined;
    }
    const delay = Math.max(
      0,
      state.sessionStartedAt + TOY_PHONE_SESSION_LIMIT_MS - Date.now(),
    );
    const sessionGeneration = state.sessionGeneration;
    const timer = window.setTimeout(() => {
      dispatch({
        type: 'SESSION_TIMEOUT',
        now: Date.now(),
        sessionGeneration,
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state.sessionGeneration, state.sessionStartedAt]);

  useEffect(() => {
    if (readiness !== 'ready' || state.sessionStartedAt === null) {
      return undefined;
    }
    const actionGeneration = toyPhoneGeneration(state);
    let delay: number | null = null;
    let action: (() => void) | null = null;
    if (state.stage === 'tutorial' && state.tutorialStep === 'ringing') {
      delay = TOY_PHONE_TUTORIAL_RING_MS;
      action = () => dispatch({ type: 'TUTORIAL_ADVANCE', generation: actionGeneration });
    } else if (state.stage === 'tutorial' && state.tutorialStep === 'mascot-answer') {
      delay = TOY_PHONE_TUTORIAL_ANSWER_MS;
      action = () => dispatch({ type: 'TUTORIAL_ADVANCE', generation: actionGeneration });
    } else if (state.stage === 'idle' && state.autoRingAllowed) {
      delay = TOY_PHONE_IDLE_RING_MS;
      action = () => dispatch({
        type: 'START_RING',
        now: Date.now(),
        locale: selectToyPhoneLocale(runtimeRef.current?.settings ?? settings),
        automatic: true,
        generation: actionGeneration,
      });
    } else if (state.stage === 'ringing') {
      delay = TOY_PHONE_AUTO_ANSWER_MS;
      action = () => dispatch({
        type: 'ANSWER',
        now: Date.now(),
        generation: actionGeneration,
      });
    } else if (state.stage === 'answering') {
      delay = TOY_PHONE_ANSWERING_MS;
      action = () => dispatch({ type: 'ANSWERING_DONE', generation: actionGeneration });
    } else if ((state.stage === 'guard1' || state.stage === 'guard2') && state.guardUntil !== null) {
      delay = Math.max(0, state.guardUntil - Date.now());
      action = () => dispatch({
        type: 'GUARD_READY',
        now: Date.now(),
        generation: actionGeneration,
      });
    } else if (state.stage === 'turn1' || state.stage === 'turn2') {
      delay = TOY_PHONE_TURN_TIMEOUT_MS;
      action = () => dispatch({
        type: 'COMPLETE_OPPORTUNITY',
        signal: 'timeout',
        generation: actionGeneration,
      });
    } else if (state.stage === 'reward') {
      delay = TOY_PHONE_REWARD_MS;
      action = () => dispatch({ type: 'REWARD_DONE', generation: actionGeneration });
    } else if (state.stage === 'rest') {
      delay = TOY_PHONE_REST_MS;
      action = () => dispatch({
        type: 'REST_DONE',
        now: Date.now(),
        locale: selectToyPhoneLocale(runtimeRef.current?.settings ?? settings),
        generation: actionGeneration,
      });
    } else if (state.stage === 'paused') {
      delay = 0;
      action = () => dispatch({ type: 'PAUSE_SETTLED', generation: actionGeneration });
    }
    if (delay === null || action === null) {
      return undefined;
    }
    const timer = window.setTimeout(action, delay);
    return () => window.clearTimeout(timer);
  }, [
    readiness,
    settings,
    state.autoRingAllowed,
    state.guardUntil,
    state.sessionStartedAt,
    state.stage,
    state,
    state.stepGeneration,
    state.tutorialStep,
  ]);

  useEffect(() => {
    const snapshot = runtimeRef.current;
    if (!snapshot) {
      return;
    }
    const current = snapshot.state;
    const turn = activeTurn(current);
    if (readiness !== 'ready' || turn === null) {
      return;
    }
    const tutorial = current.stage === 'tutorial';
    const conversation = getToyPhoneConversation(
      current.locale,
      tutorial ? 0 : current.currentTemplateIndex,
    );
    const utterance = conversation[turn];
    const actionGeneration = snapshot.actionGeneration;
    const token = snapshot.token;
    void toyPhoneMediaCoordinator.play({
      intentId: `toy-phone:${snapshot.mediaScope.sessionId}:${snapshot.mediaScope.roundId}:${turn}:${current.stepGeneration}`,
      source: 'automatic',
      scope: snapshot.mediaScope,
      audioClass: 'mandatory',
      settings: snapshot.settings,
      localeLock: createCommunicationLocaleLock(snapshot.mediaScope, current.locale, 'round'),
      segments: [{
        text: utterance.text,
        locale: current.locale,
        cue: `toy-phone:${turn}`,
      }],
    }).then((outcome) => {
      if (!snapshot.tokenIsCurrent(token)) {
        return;
      }
      if (outcome.status === 'completed') {
        if (tutorial) {
          dispatch({ type: 'TUTORIAL_ADVANCE', generation: actionGeneration });
        } else {
          dispatch({
            type: 'MANDATORY_COMPLETED',
            now: Date.now(),
            generation: actionGeneration,
          });
        }
        return;
      }
      if (outcome.status === 'errored' || outcome.status === 'unavailable') {
        persistReadiness('not-ready');
        persistExit('asset-error');
        setReadiness('not-ready');
        dispatch({ type: 'ASSET_ERROR' });
      }
    });
  }, [
    persistExit,
    persistReadiness,
    readiness,
    state.stage,
    state.stepGeneration,
    state.tutorialStep,
  ]);

  useEffect(() => {
    const ringing = state.stage === 'ringing'
      || (state.stage === 'tutorial' && state.tutorialStep === 'ringing');
    if (!ringing || readiness !== 'ready') {
      return undefined;
    }
    return startToyPhoneRingCue();
  }, [readiness, state.stage, state.tutorialStep]);

  useEffect(() => {
    if (state.stage !== 'reward') {
      return undefined;
    }
    return startToyPhoneDisconnectCue();
  }, [state.stage, state.stepGeneration]);

  useEffect(() => {
    const snapshot = runtimeRef.current;
    if (
      !snapshot
      || readiness !== 'ready'
      || lifecycle !== 'foreground'
      || (snapshot.state.stage !== 'turn1' && snapshot.state.stage !== 'turn2')
    ) {
      return undefined;
    }
    let cancelled = false;
    const token = snapshot.token;
    effortMsRef.current = 0;
    void readPreparedMicrophoneStatus().then(async (status) => {
      if (cancelled || !snapshot.tokenIsCurrent(token) || status !== 'granted') {
        return;
      }
      const outcome = await snapshot.micStart();
      if (cancelled || !snapshot.tokenIsCurrent(token)) {
        snapshot.micStop();
        return;
      }
      if (outcome.status !== 'started') {
        snapshot.micStop();
      }
    });
    return () => {
      cancelled = true;
      effortMsRef.current = 0;
      snapshot.micStop();
    };
  }, [
    lifecycle,
    readiness,
    state.stage,
    state.stepGeneration,
  ]);

  const interruptTutorial = useCallback((): void => {
    const snapshot = runtimeRef.current;
    if (!snapshot || snapshot.state.stage !== 'tutorial') {
      return;
    }
    snapshot.micStop();
    toyPhoneMediaCoordinator.notifyInteraction(snapshot.mediaScope, 'round-replacement');
    dispatch({
      type: 'INTERRUPT_TUTORIAL',
      now: Date.now(),
      locale: selectToyPhoneLocale(snapshot.settings),
    });
  }, []);

  const reactToChild = useCallback((): void => {
    setReaction((value) => value + 1);
  }, []);

  const clearTutorialInterruptPointer = useCallback((pointerId?: number): void => {
    const owner = tutorialInterruptPointerRef.current;
    if (owner === null || (pointerId !== undefined && pointerId !== owner.pointerId)) {
      return;
    }
    tutorialInterruptPointerRef.current = null;
  }, []);

  const handleSurfacePointer = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const snapshot = runtimeRef.current;
    if (!snapshot) {
      return;
    }
    if (snapshot.state.stage !== 'tutorial') {
      const owner = tutorialInterruptPointerRef.current;
      if (owner?.released && owner.pointerId === event.pointerId) {
        clearTutorialInterruptPointer(owner.pointerId);
      }
      return;
    }
    if (
      tutorialInterruptPointerRef.current === null
      && (event.target as Element).closest('.toy-phone-handset-target')
    ) {
      tutorialInterruptPointerRef.current = {
        pointerId: event.pointerId,
        released: false,
      };
    }
    reactToChild();
    unlockToyPhoneMedia(snapshot.settings);
    interruptTutorial();
  }, [clearTutorialInterruptPointer, interruptTutorial, reactToChild]);

  const handleSurfacePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const owner = tutorialInterruptPointerRef.current;
    if (owner?.pointerId === event.pointerId) {
      owner.released = true;
    }
  }, []);

  const handleSurfacePointerCancel = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ): void => {
    clearTutorialInterruptPointer(event.pointerId);
  }, [clearTutorialInterruptPointer]);

  const handleHandset = useCallback((event: ReactMouseEvent<HTMLButtonElement>): void => {
    const interruptedPointer = tutorialInterruptPointerRef.current;
    const clickPointer = eventPointerId(event.nativeEvent);
    if (interruptedPointer !== null) {
      const generatedByInterruptedPointer = clickPointer === interruptedPointer.pointerId
        || (clickPointer === null && event.detail > 0);
      clearTutorialInterruptPointer(interruptedPointer.pointerId);
      if (generatedByInterruptedPointer) {
        return;
      }
    }
    const snapshot = runtimeRef.current;
    if (!snapshot) {
      return;
    }
    reactToChild();
    unlockToyPhoneMedia(snapshot.settings);
    if (snapshot.state.stage === 'tutorial') {
      interruptTutorial();
      return;
    }
    if (snapshot.state.stage === 'idle') {
      dispatch({
        type: 'START_RING',
        now: Date.now(),
        locale: selectToyPhoneLocale(snapshot.settings),
        automatic: false,
        generation: snapshot.actionGeneration,
      });
      return;
    }
    if (snapshot.state.stage === 'ringing') {
      dispatch({
        type: 'ANSWER',
        now: Date.now(),
        generation: snapshot.actionGeneration,
      });
      return;
    }
    if (mandatorySpeaking(snapshot.state)) {
      dispatch({
        type: 'CHILD_INTENT',
        generation: snapshot.actionGeneration,
      });
    }
  }, [clearTutorialInterruptPointer, interruptTutorial, reactToChild]);

  const handleCallerOrObject = useCallback((): void => {
    const snapshot = runtimeRef.current;
    if (!snapshot) {
      return;
    }
    reactToChild();
    unlockToyPhoneMedia(snapshot.settings);
    if (snapshot.state.stage === 'tutorial') {
      interruptTutorial();
      return;
    }
    if (mandatorySpeaking(snapshot.state)) {
      dispatch({
        type: 'CHILD_INTENT',
        generation: snapshot.actionGeneration,
      });
      return;
    }
    if (snapshot.state.stage === 'turn1' || snapshot.state.stage === 'turn2') {
      snapshot.micStop();
      dispatch({
        type: 'COMPLETE_OPPORTUNITY',
        signal: 'touch',
        generation: snapshot.actionGeneration,
      });
    }
  }, [interruptTutorial, reactToChild]);

  const handleBack = useCallback((): void => {
    const snapshot = runtimeRef.current;
    persistExit('back');
    if (snapshot) {
      snapshot.micStop();
      toyPhoneMediaCoordinator.notifyInteraction(snapshot.mediaScope, 'exit');
    }
    onBack();
  }, [onBack, persistExit]);

  const tutorial = state.stage === 'tutorial';
  const conversation = getToyPhoneConversation(
    state.locale,
    tutorial ? 0 : state.currentTemplateIndex,
  );
  const callerLabel = localizedConceptLabel(conversation.callerId, state.locale);
  const objectLabel = localizedConceptLabel(conversation.objectId, state.locale);
  const english = state.locale !== 'he-IL';
  const isRinging = state.stage === 'ringing'
    || (state.stage === 'tutorial' && state.tutorialStep === 'ringing');
  const isAnswered = state.stage !== 'idle' && !isRinging;
  const callerVisible = showingCaller(state);
  const objectVisible = showingObject(state);
  const waving = state.stage === 'goodbye'
    || state.stage === 'reward'
    || (tutorial && state.tutorialStep === 'goodbye');

  return (
    <GameShell
      ariaLabel={english ? TOY_PHONE_SHELF_META.titleEn : TOY_PHONE_SHELF_META.titleHe}
      accentClass="accent-toy-phone"
      reducedMotion={settings.reducedMotion}
      onHome={handleBack}
      replayLabel={english ? 'Repeat' : 'שׁוּב'}
      homeLabel={english ? 'Home' : 'בַּיִת'}
      liveStatus={liveStatusFor(state)}
      languageMode={state.locale === 'he-IL' ? 'he' : 'en'}
    >
      <div
        className={[
          'toy-phone-surface',
          `toy-phone-surface--${state.stage}`,
          `toy-phone-readiness--${readiness}`,
          reaction % 2 === 0 ? 'reaction-even' : 'reaction-odd',
        ].join(' ')}
        data-stage={state.stage}
        data-tutorial-step={state.tutorialStep ?? ''}
        data-locale={state.locale}
        data-calls-completed={state.callsCompleted}
        onPointerDown={handleSurfacePointer}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerCancel}
      >
        <div className="toy-phone-stage" role="group" aria-label={liveStatusFor(state)}>
          <button
            type="button"
            className="toy-phone-handset-target"
            onClick={handleHandset}
            aria-label={english ? 'Answer the toy phone' : 'לַעֲנוֹת לְטֵלֵפוֹן הַצַּעֲצוּעַ'}
          >
            <ToyPhoneDeviceArt
              ringing={isRinging}
              answered={isAnswered}
              mascotAnswering={tutorial && state.tutorialStep === 'mascot-answer'}
            />
          </button>

          {tutorial && state.tutorialStep === 'mascot-answer' ? (
            <PuppyTutorialTap />
          ) : null}

          <div className="toy-phone-call-content">
            {callerVisible ? (
              <button
                type="button"
                className={`toy-phone-caller-target ${waving ? 'is-waving' : ''}`}
                onClick={handleCallerOrObject}
                aria-label={callerLabel}
              >
                <ToyPhoneCallerArt
                  callerId={conversation.callerId}
                  className="toy-phone-caller-art"
                />
                <span className="toy-phone-speech-dot" aria-hidden="true" />
              </button>
            ) : null}

            {objectVisible ? (
              <button
                type="button"
                className="toy-phone-object-target"
                onClick={handleCallerOrObject}
                aria-label={objectLabel}
              >
                <ToyPhoneObjectArt
                  objectId={conversation.objectId}
                  className="toy-phone-object-art"
                />
              </button>
            ) : null}
          </div>

          {state.stage === 'session-stop' ? (
            <div className="toy-phone-sleep-cue" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : null}

          {state.stage === 'asset-error' ? (
            <div className="toy-phone-asset-error" role="img" aria-label={liveStatusFor(state)}>
              <span aria-hidden="true">!</span>
            </div>
          ) : null}
        </div>
      </div>
    </GameShell>
  );
}

function PuppyTutorialTap() {
  return (
    <div className="toy-phone-tutorial-mascot" aria-hidden="true">
      <ToyPhoneCallerArt callerId="mascot" className="toy-phone-tutorial-mascot__art" />
      <span className="toy-phone-tutorial-mascot__paw" />
    </div>
  );
}
