import { useCallback, useEffect, useRef, useState } from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { requireLearningConcept } from '../content/concepts';
import { gameMeta } from '../content/games';
import { requireWordStretchWord } from '../content/wordStretch';
import {
  generateWordStretchRound,
  getWordStretchRoundSignature,
} from '../domain/rounds';
import { soundService } from '../services/sound';
import { speechService } from '../services/speech';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';
import {
  buildWordStretchSegments,
  WORD_STRETCH_CUE_PREFIX,
} from './wordStretchSpeech';

const SPEECH_SCOPE = 'game:word-stretch';
const QUIET_STRETCH_MS = 1_050;

export function WordStretchGame({
  domainProgress,
  settings,
  speechStatus,
  onBack,
  onCompleteRound,
}: ToddlerGameProps) {
  const [busy, setBusy] = useState(false);
  const [quietStretching, setQuietStretching] = useState(false);
  const [speechStretching, setSpeechStretching] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const playbackGeneration = useRef(0);
  const busyRef = useRef(false);
  const fallbackTimer = useRef<number | null>(null);
  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'wordStretch',
    domainProgress,
    generateWordStretchRound,
    { getSignature: getWordStretchRoundSignature, limit: 8 },
  );
  const concept = requireLearningConcept(round.conceptId);
  const word = requireWordStretchWord(round.conceptId);
  const cue = `${WORD_STRETCH_CUE_PREFIX}${round.conceptId}`;
  const englishOnly = settings.languageMode === 'en';
  const stretching = quietStretching || speechStretching || speechStatus.activeCue === cue;

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimer.current !== null) {
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  useEffect(() => {
    playbackGeneration.current += 1;
    clearFallbackTimer();
    busyRef.current = false;
    setBusy(false);
    setQuietStretching(false);
    setSpeechStretching(false);
    setCelebration(null);
  }, [clearFallbackTimer, roundKey]);

  useEffect(() => () => {
    playbackGeneration.current += 1;
    busyRef.current = false;
    clearFallbackTimer();
  }, [clearFallbackTimer]);

  useEffect(() => {
    if (speechStatus.activeCue === cue) {
      setSpeechStretching(true);
    }
  }, [cue, speechStatus.activeCue]);

  const finishRound = useCallback(() => {
    const summary = onCompleteRound({
      attempts: 1,
      requiredActions: 1,
      concepts: [round.conceptId],
    });
    setCelebration({
      seed: `word-stretch-${roundKey}-${round.conceptId}`,
      targetSegments: [],
      tier: summary.milestone ? 'milestone' : 'standard',
      recommendation: summary.recommendation,
      celebrationVariant: 'trophy-spark',
    });
  }, [onCompleteRound, round.conceptId, roundKey]);

  const runQuietStretch = useCallback((): Promise<void> => {
    clearFallbackTimer();
    setQuietStretching(true);
    return new Promise((resolve) => {
      fallbackTimer.current = window.setTimeout(() => {
        fallbackTimer.current = null;
        setQuietStretching(false);
        resolve();
      }, QUIET_STRETCH_MS);
    });
  }, [clearFallbackTimer]);

  const playWord = useCallback(async (
    interrupt: boolean,
    completesRound: boolean,
  ): Promise<void> => {
    if (busyRef.current || celebration) {
      return;
    }
    busyRef.current = true;
    const generation = ++playbackGeneration.current;
    setBusy(true);
    soundService.playTap(settings);

    if (settings.quietMode || !speechStatus.supported) {
      await runQuietStretch();
      if (generation !== playbackGeneration.current) {
        return;
      }
      busyRef.current = false;
      setBusy(false);
      if (completesRound) {
        finishRound();
      }
      return;
    }

    const result = await speechService.speakSegments(
      buildWordStretchSegments(word, concept, settings),
      settings,
      {
        scope: SPEECH_SCOPE,
        key: `word:${roundKey}`,
        priority: interrupt ? 'replay' : 'label',
        interrupt,
      },
    );
    if (generation !== playbackGeneration.current) {
      return;
    }
    busyRef.current = false;
    setBusy(false);
    setSpeechStretching(false);
    if (completesRound && result.status === 'completed') {
      finishRound();
    }
  }, [
    celebration,
    concept,
    finishRound,
    roundKey,
    runQuietStretch,
    settings,
    speechStatus.supported,
    word,
  ]);

  const label = englishOnly ? concept.en : concept.he;
  const instruction = englishOnly
    ? 'Touch the picture and stretch the word'
    : 'נוגעים בתמונה ומותחים את המילה';
  const liveStatus = stretching
    ? (englishOnly ? `Stretching ${concept.en}` : `מותחים את המילה ${concept.he}`)
    : instruction;

  return (
    <GameShell
      ariaLabel={gameMeta.wordStretch.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.wordStretch.accentClass}
      reducedMotion={settings.reducedMotion}
      onHome={onBack}
      onRepeat={() => void playWord(true, false)}
      repeatDisabled={busy || settings.quietMode || !speechStatus.supported}
      repeatSpeaking={stretching}
      replayLabel={englishOnly ? 'Stretch it again' : 'למתוח שוב'}
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
      <div className="word-stretch-surface">
        <p className="word-stretch-instruction" aria-hidden="true">
          {instruction}
        </p>
        <button
          type="button"
          className={`word-stretch-button ${stretching ? 'is-stretching' : ''}`}
          onClick={() => void playWord(false, true)}
          disabled={busy}
          aria-label={englishOnly ? `Stretch ${concept.en}` : `למתוח את המילה ${concept.he}`}
          aria-pressed={stretching}
        >
          <span className="word-stretch-spring word-stretch-spring--start" aria-hidden="true" />
          <ConceptArt
            conceptId={concept.id}
            label={label}
            className="word-stretch-picture"
          />
          <span className="word-stretch-spring word-stretch-spring--end" aria-hidden="true" />
        </button>
        <div className="word-stretch-word" aria-hidden="true" lang={englishOnly ? 'en' : 'he'}>
          {stretching ? (englishOnly ? word.stretchedEn : word.stretchedHe) : label}
        </div>
      </div>
    </GameShell>
  );
}
