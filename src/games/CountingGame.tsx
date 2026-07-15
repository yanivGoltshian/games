import { useCallback, useEffect, useState } from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { SuccessOverlay } from '../components/SuccessOverlay';
import { gameMeta } from '../content/games';
import { NUMBER_WORDS_EN, NUMBER_WORDS_HE, generateCountingRound } from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';

const WIGGLE_MS = 520;

function numberWords(value: number): { he: string; en: string } {
  return { he: NUMBER_WORDS_HE[value] ?? String(value), en: NUMBER_WORDS_EN[value] ?? String(value) };
}

export function CountingGame({ domainProgress, settings, mediaReady, speechStatus, onBack, onCompleteRound }: ToddlerGameProps) {
  const [attempts, setAttempts] = useState(0);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [wiggleValue, setWiggleValue] = useState<number | null>(null);

  const { round, startNextRound } = useAdaptiveRound('counting', domainProgress, generateCountingRound);
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;

  const speakPrompt = useCallback(async (): Promise<void> => {
    const segments = buildPhraseSegments(round.promptHe, round.promptEn, settings.languageMode, settings.englishVoiceLocale);
    await speechService.speakSegments(segments, settings);
  }, [round.promptEn, round.promptHe, settings]);

  useEffect(() => {
    setAttempts(0);
    setCelebration(null);
    setWiggleValue(null);
    if (mediaReady) {
      void speakPrompt();
    }
    return () => speechService.cancel();
  }, [mediaReady, round, speakPrompt]);

  const handlePick = (value: number) => {
    if (celebration) {
      return;
    }

    const words = numberWords(value);
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    soundService.playTap(settings);

    if (value === round.targetCount) {
      const summary = onCompleteRound({ attempts: nextAttempts, requiredActions: 1, concepts: [`count-${round.targetCount}`] });
      setCelebration({
        seed: `counting-${round.targetCount}-${nextAttempts}`,
        targetSegments: buildPhraseSegments(words.he, words.en, settings.languageMode, settings.englishVoiceLocale),
        tier: summary.milestone ? 'milestone' : 'standard',
      });
      return;
    }

    setWiggleValue(value);
    window.setTimeout(() => setWiggleValue((current) => (current === value ? null : current)), WIGGLE_MS);
    void speechService
      .speakSegments(buildPhraseSegments(words.he, words.en, settings.languageMode, settings.englishVoiceLocale), settings)
      .then((completed) => {
        if (completed && mediaReady) {
          void speakPrompt();
        }
      });
  };

  return (
    <GameShell
      ariaLabel={gameMeta.counting.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.counting.accentClass}
      reducedMotion={settings.reducedMotion}
      onHome={onBack}
      onRepeat={speakPrompt}
      repeatDisabled={settings.quietMode || !speechStatus.supported}
      replayLabel={englishOnly ? 'Hear it again' : 'לשמוע שוב'}
      homeLabel={englishOnly ? 'Back home' : 'חזרה לבית'}
      liveStatus={prompt}
      successOverlay={
        celebration ? (
          <SuccessOverlay
            settings={settings}
            seed={celebration.seed}
            targetSegments={celebration.targetSegments}
            tier={celebration.tier}
            onAdvance={() => {
              setCelebration(null);
              startNextRound();
            }}
          />
        ) : undefined
      }
    >
      <div className="counting-cloud" aria-label={englishOnly ? `There are ${round.targetCount}` : `יש כאן ${round.targetCount}`}>
        {Array.from({ length: round.targetCount }, (_, index) => (
          <span key={index} className="counting-cloud__item">
            <ConceptArt conceptId={round.countingConceptId} className="counting-cloud__art" />
          </span>
        ))}
      </div>

      <div className="choice-grid choice-grid--numbers" role="group" aria-label={prompt}>
        {round.options.map((value) => {
          const words = numberWords(value);
          return (
            <button
              key={value}
              className={`choice-button choice-button--number ${wiggleValue === value ? 'is-wiggling' : ''}`}
              onClick={() => handlePick(value)}
              type="button"
              aria-label={englishOnly ? words.en : words.he}
            >
              <span className="number-dots" aria-hidden="true">
                {Array.from({ length: value }, (_, dotIndex) => (
                  <span key={dotIndex} className="number-dots__dot" />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </GameShell>
  );
}
