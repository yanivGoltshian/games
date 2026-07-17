import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { gameMeta } from '../content/games';
import {
  generateSyllableTrainRound,
  getSyllableTrainRoundSignature,
} from '../domain/rounds';
import { soundService } from '../services/sound';
import {
  buildPhraseSegments,
  speechService,
  type SpeechResult,
} from '../services/speech';
import {
  INITIAL_SYLLABLE_TRAIN_STATE,
  reduceSyllableTrain,
  selectCoupleProgress,
} from './syllableTrainState';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';

const SPEECH_SCOPE = 'game:syllable-train';

/**
 * How many pixels the loose car must travel toward the locomotive before it
 * couples. Coupling is deliberately forgiving so a toddler wiggle succeeds; a
 * single tap or keyboard press couples immediately via {@link handleCouple}.
 */
const DRAG_BUDGET_PX = 90;

/**
 * Syllable Train ("רכבת ההברות").
 *
 * The word arrives as a train whose locomotive already carries the first
 * syllable. Sean couples the loose car (the remaining syllable) to it. On a
 * successful coupling the train drives off and the narrator speaks the *whole*
 * continuous word.
 *
 * Offline speech contract: only whole words are ever spoken, and only via the
 * unpointed `plainHe` / `fullEn` that exist in the recorded-speech manifest.
 * The pointed syllables on the cars, the prompt, and the title are visual only
 * and are never sent to the speech service, so no new audio is required.
 */
export function SyllableTrainGame({
  domainProgress,
  settings,
  mediaReady,
  speechStatus,
  onBack,
  onCompleteRound,
}: ToddlerGameProps) {
  const [state, dispatch] = useReducer(reduceSyllableTrain, INITIAL_SYLLABLE_TRAIN_STATE);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [driving, setDriving] = useState(false);
  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'syllableTrain',
    domainProgress,
    generateSyllableTrainRound,
    { getSignature: getSyllableTrainRoundSignature, limit: 8 },
  );

  const englishOnly = settings.languageMode === 'en';
  const dragStartRef = useRef<number | null>(null);

  const speakWord = useCallback(async (interrupt = false): Promise<void> => {
    await speechService.speakSegments(
      buildPhraseSegments(
        round.plainHe,
        round.fullEn,
        settings.languageMode,
        settings.englishVoiceLocale,
      ),
      settings,
      {
        scope: SPEECH_SCOPE,
        key: `word:${roundKey}`,
        priority: interrupt ? 'replay' : 'label',
        interrupt,
      },
    );
  }, [round.plainHe, round.fullEn, roundKey, settings]);

  // The engine's first-syllable cue is an emphatic sound + visual pulse rather
  // than spoken audio, because isolated syllables are not in the manifest.
  const playIntroCue = useCallback(() => {
    soundService.playTap(settings);
  }, [settings]);
  const playIntroCueRef = useRef(playIntroCue);
  playIntroCueRef.current = playIntroCue;

  // Latest-values snapshot so the success effect can depend solely on `phase`
  // and still read fresh round/settings/callbacks without re-firing.
  const successDataRef = useRef({
    round,
    roundKey,
    settings,
    attempts: state.attempts,
    onCompleteRound,
  });
  successDataRef.current = {
    round,
    roundKey,
    settings,
    attempts: state.attempts,
    onCompleteRound,
  };
  const successHandledRef = useRef(false);

  useEffect(() => {
    successHandledRef.current = false;
    setCelebration(null);
    setDriving(false);
    dragStartRef.current = null;
    dispatch({ type: 'reset' });
    if (mediaReady) {
      playIntroCueRef.current();
    }
  }, [mediaReady, roundKey]);

  useEffect(() => {
    if (state.phase !== 'success' || successHandledRef.current) {
      return undefined;
    }
    successHandledRef.current = true;
    const snapshot = successDataRef.current;
    soundService.playSuccess(snapshot.settings);
    setDriving(true);

    const revealSpeech: Promise<SpeechResult> = speechService.speakSegments(
      buildPhraseSegments(
        snapshot.round.plainHe,
        snapshot.round.fullEn,
        snapshot.settings.languageMode,
        snapshot.settings.englishVoiceLocale,
      ),
      snapshot.settings,
      {
        scope: SPEECH_SCOPE,
        key: `reveal:${snapshot.roundKey}`,
        priority: 'label',
        staleAfterSuccess: true,
      },
    );

    const summary = snapshot.onCompleteRound({
      attempts: Math.max(1, snapshot.attempts),
      requiredActions: 1,
      concepts: [snapshot.round.conceptId],
    });

    const revealMs = snapshot.settings.reducedMotion ? 650 : 1500;
    const timer = window.setTimeout(() => {
      setDriving(false);
      setCelebration({
        seed: `syllable-train-${snapshot.roundKey}-${snapshot.round.signature}-${snapshot.attempts}`,
        targetSegments: [],
        beforeSpeech: revealSpeech,
        tier: summary.milestone ? 'milestone' : 'standard',
        recommendation: summary.recommendation,
        celebrationVariant: 'trophy-spark',
      });
    }, revealMs);

    return () => window.clearTimeout(timer);
  }, [state.phase]);

  const handleCouple = useCallback((): void => {
    if (state.phase === 'success' || driving) {
      return;
    }
    soundService.playTap(settings);
    dispatch({ type: 'couple' });
  }, [driving, settings, state.phase]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (state.phase === 'success' || driving) {
      return;
    }
    dragStartRef.current = event.clientX;
    const target = event.currentTarget;
    if (typeof target.setPointerCapture === 'function') {
      target.setPointerCapture(event.pointerId);
    }
    dispatch({ type: 'grab' });
  }, [driving, state.phase]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (state.phase !== 'connecting' || dragStartRef.current === null) {
      return;
    }
    const delta = Math.abs(event.clientX - dragStartRef.current);
    dispatch({ type: 'drag', progress: delta / DRAG_BUDGET_PX });
  }, [state.phase]);

  const handlePointerUp = useCallback((): void => {
    if (dragStartRef.current === null) {
      return;
    }
    dragStartRef.current = null;
    if (state.phase !== 'success') {
      dispatch({ type: 'release' });
    }
  }, [state.phase]);

  const isSuccess = state.phase === 'success';
  const progress = selectCoupleProgress(state);
  const couplingAriaLabel = englishOnly ? 'Couple the train car' : 'חברו את הקרון';

  const liveStatus = isSuccess
    ? (englishOnly ? `Yes! ${round.fullEn}` : `כן! ${round.plainHe}`)
    : (englishOnly ? round.promptEn : round.promptHe);

  const surfaceStyle = {
    '--progress': progress,
  } as CSSProperties;

  return (
    <GameShell
      ariaLabel={gameMeta.syllableTrain.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.syllableTrain.accentClass}
      reducedMotion={settings.reducedMotion}
      onHome={onBack}
      onRepeat={() => void speakWord(true)}
      repeatDisabled={settings.quietMode || !speechStatus.supported}
      repeatSpeaking={speechStatus.speaking}
      replayLabel={englishOnly ? 'Hear it again' : 'לשמוע שוב'}
      homeLabel={englishOnly ? 'Back home' : 'חזרה לבית'}
      liveStatus={liveStatus}
      successOverlay={
        celebration ? (
          <RoundSuccessOverlay
            celebration={celebration}
            settings={settings}
            scope={SPEECH_SCOPE}
            onDismiss={() => setCelebration(null)}
            startNextRound={startNextRound}
          />
        ) : undefined
      }
    >
      <div
        className="syllable-train-surface"
        data-phase={state.phase}
        data-driving={driving ? 'true' : 'false'}
        style={surfaceStyle}
      >
        <div className="syllable-train-scene">
          <ConceptArt
            conceptId={round.conceptId}
            label={englishOnly ? round.fullEn : round.plainHe}
            className="syllable-train-scene__art"
          />
        </div>

        <p className="syllable-train-prompt" lang={englishOnly ? 'en' : 'he'} aria-hidden="true">
          {englishOnly ? round.promptEn : round.promptHe}
        </p>

        <div className="syllable-train-track">
          <div
            className="syllable-train-car syllable-train-car--engine"
            data-phase={state.phase}
            aria-hidden="true"
          >
            <span className="syllable-train-car__label" lang={englishOnly ? 'en' : 'he'}>
              {englishOnly ? round.firstEn : round.firstHe}
            </span>
            <span className="syllable-train-car__wheels" />
          </div>

          {isSuccess ? (
            <div className="syllable-train-car syllable-train-car--joined" aria-hidden="true">
              <span className="syllable-train-car__label" lang={englishOnly ? 'en' : 'he'}>
                {englishOnly ? round.restEn : round.restHe}
              </span>
              <span className="syllable-train-car__wheels" />
            </div>
          ) : (
            <button
              type="button"
              className="syllable-train-car syllable-train-car--loose"
              onClick={handleCouple}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              aria-label={couplingAriaLabel}
            >
              <span className="syllable-train-car__label" lang={englishOnly ? 'en' : 'he'}>
                {englishOnly ? round.restEn : round.restHe}
              </span>
              <span className="syllable-train-car__wheels" aria-hidden="true" />
            </button>
          )}
        </div>

        <p
          className={`syllable-train-whole ${isSuccess ? 'is-visible' : ''}`}
          lang={englishOnly ? 'en' : 'he'}
          aria-hidden="true"
        >
          {englishOnly ? round.fullEn : round.fullHe}
        </p>
      </div>
    </GameShell>
  );
}
