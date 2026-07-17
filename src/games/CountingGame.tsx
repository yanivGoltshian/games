import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { getCountingQuantityPhrase, type CountingConceptId } from '../content/countingQuantity';
import { gameMeta } from '../content/games';
import { buildCountingMissModel, getCountingLayout } from '../domain/countingFeedback';
import {
  NUMBER_WORDS_EN,
  NUMBER_WORDS_HE,
  generateCountingRound,
  getCountingRoundSignature,
} from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useMicEffort } from './useMicEffort';
import { useRetryFeedback } from './useRetryFeedback';

const WIGGLE_MS = 520;
const SPEECH_SCOPE = 'game:counting';

function numberWords(value: number): { he: string; en: string } {
  return { he: NUMBER_WORDS_HE[value] ?? String(value), en: NUMBER_WORDS_EN[value] ?? String(value) };
}

export function CountingGame({
  domainProgress,
  settings,
  mediaReady,
  speechStatus,
  onBack,
  onCompleteRound,
}: ToddlerGameProps) {
  const [attempts, setAttempts] = useState(0);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [wiggleValue, setWiggleValue] = useState<number | null>(null);
  const [hintedValue, setHintedValue] = useState<number | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);

  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'counting',
    domainProgress,
    generateCountingRound,
    { getSignature: getCountingRoundSignature, limit: 8 },
  );
  const { retryBusy, runRetry } = useRetryFeedback({ scope: SPEECH_SCOPE, roundKey, settings });
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;
  const countingConceptId = round.countingConceptId as CountingConceptId;
  const layout = useMemo(() => getCountingLayout(round.targetCount), [round.targetCount]);
  const visualOnlyFeedback = settings.quietMode || !speechStatus.supported;

  const mic = useMicEffort((level) => setVoiceLevel(level));
  const { start: startMic, stop: stopMic, supported: micSupported } = mic;
  const toggleVoice = useCallback(() => {
    if (voiceOn) {
      stopMic();
      setVoiceOn(false);
      setVoiceLevel(0);
      return;
    }
    void startMic().then((granted) => {
      setVoiceOn(granted);
      if (!granted) {
        setVoiceLevel(0);
      }
    });
  }, [startMic, stopMic, voiceOn]);

  const speakPrompt = useCallback(async (interrupt = false): Promise<void> => {
    const segments = buildPhraseSegments(round.promptHe, round.promptEn, settings.languageMode, settings.englishVoiceLocale);
    await speechService.speakSegments(segments, settings, {
      scope: SPEECH_SCOPE,
      key: `prompt:${roundKey}`,
      priority: interrupt ? 'replay' : 'prompt',
      interrupt,
    });
  }, [round.promptEn, round.promptHe, roundKey, settings]);
  const speakPromptRef = useRef(speakPrompt);
  speakPromptRef.current = speakPrompt;

  useEffect(() => {
    setAttempts(0);
    setCelebration(null);
    setWiggleValue(null);
    setHintedValue(null);
    stopMic();
    setVoiceOn(false);
    setVoiceLevel(0);
    if (mediaReady) {
      void speakPromptRef.current();
    }
  }, [mediaReady, roundKey, stopMic]);

  const handlePick = (value: number) => {
    if (celebration || retryBusy) {
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (value === round.targetCount) {
      soundService.playTap(settings);
      const quantityHe = getCountingQuantityPhrase('he', countingConceptId, round.targetCount);
      const quantityEn = getCountingQuantityPhrase('en', countingConceptId, round.targetCount);
      const summary = onCompleteRound({ attempts: nextAttempts, requiredActions: 1, concepts: [`count-${round.targetCount}`] });
      setCelebration({
        seed: `counting-${round.targetCount}-${nextAttempts}`,
        targetSegments: buildPhraseSegments(quantityHe, quantityEn, settings.languageMode, settings.englishVoiceLocale),
        tier: summary.milestone ? 'milestone' : 'standard',
        recommendation: summary.recommendation,
      });
      return;
    }

    setWiggleValue(value);
    window.setTimeout(() => setWiggleValue((current) => (current === value ? null : current)), WIGGLE_MS);
    const model = buildCountingMissModel(countingConceptId, round.targetCount, nextAttempts);
    if (model.variant === 'subsequent-miss' && visualOnlyFeedback) {
      setHintedValue(round.targetCount);
    }
    void runRetry({
      missCount: nextAttempts,
      seed: `${roundKey}:${nextAttempts}`,
      modelLines: model.lines,
    }).finally(() => setHintedValue(null));
  };

  return (
    <GameShell
      ariaLabel={gameMeta.counting.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.counting.accentClass}
      reducedMotion={settings.reducedMotion}
      onHome={onBack}
      onRepeat={() => void speakPrompt(true)}
      repeatDisabled={settings.quietMode || !speechStatus.supported}
      repeatSpeaking={speechStatus.speaking}
      replayLabel={englishOnly ? 'Hear it again' : 'לשמוע שוב'}
      homeLabel={englishOnly ? 'Back home' : 'חזרה לבית'}
      liveStatus={prompt}
      retryActive={retryBusy}
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
        className={`counting-cloud counting-cloud--${layout.density}`}
        data-count={round.targetCount}
        data-voice={voiceOn ? 'on' : 'off'}
        style={{ '--count-columns': layout.columns, '--voice': voiceLevel } as CSSProperties}
        aria-label={
          englishOnly
            ? getCountingQuantityPhrase('en', countingConceptId, round.targetCount)
            : getCountingQuantityPhrase('he', countingConceptId, round.targetCount)
        }
      >
        {Array.from({ length: round.targetCount }, (_, index) => (
          <span
            key={index}
            className={`counting-cloud__item ${speechStatus.activeCue === `count-item:${index}` ? 'is-counting' : ''} ${visualOnlyFeedback && retryBusy ? 'is-counting-fallback' : ''}`}
            style={{ '--count-index': index } as CSSProperties}
          >
            <ConceptArt conceptId={round.countingConceptId} className="counting-cloud__art" />
          </span>
        ))}
      </div>

      <div
        className="choice-grid choice-grid--numbers"
        style={{ '--answer-count': round.options.length } as CSSProperties}
        role="group"
        aria-label={prompt}
      >
        {round.options.map((value) => {
          const words = numberWords(value);
          return (
            <button
              key={value}
              className={`choice-button choice-button--number ${wiggleValue === value ? 'is-wiggling' : ''} ${hintedValue === value || speechStatus.activeCue === `count-answer:${value}` ? 'is-teaching-hint' : ''}`}
              disabled={retryBusy}
              onClick={() => handlePick(value)}
              type="button"
              aria-label={englishOnly ? words.en : words.he}
            >
              <span
                className="number-dots"
                style={{ '--dot-columns': value <= 3 ? value : value === 4 ? 2 : value <= 6 ? 3 : 5 } as CSSProperties}
                aria-hidden="true"
              >
                {Array.from({ length: value }, (_, dotIndex) => (
                  <span key={dotIndex} className="number-dots__dot" />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {micSupported ? (
        <div className="counting-voice" data-live={voiceOn ? 'on' : 'off'}>
          <button
            type="button"
            className={`counting-voice__toggle ${voiceOn ? 'is-live' : ''}`}
            onClick={toggleVoice}
            aria-pressed={voiceOn}
            style={{ '--voice': voiceLevel } as CSSProperties}
            aria-label={
              englishOnly
                ? voiceOn
                  ? 'Stop counting out loud'
                  : 'Count out loud'
                : voiceOn
                  ? 'להפסיק לספור בקול'
                  : 'לספור בקול'
            }
          >
            <CountingMicIcon />
            <span className="counting-voice__label">
              {englishOnly ? (voiceOn ? 'Listening…' : 'Count out loud') : voiceOn ? 'אני מקשיב…' : 'לספור בקול'}
            </span>
          </button>
        </div>
      ) : null}
    </GameShell>
  );
}

function CountingMicIcon() {
  return (
    <svg className="counting-voice__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="2.5" width="6" height="12" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" fill="none" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17.5" x2="12" y2="21" strokeWidth="2" strokeLinecap="round" />
      <line x1="8.5" y1="21" x2="15.5" y2="21" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
