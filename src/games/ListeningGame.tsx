import { useCallback, useEffect, useState } from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { SuccessOverlay } from '../components/SuccessOverlay';
import { learningConcepts } from '../content/concepts';
import { gameMeta } from '../content/games';
import { generateListeningRound } from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';

const WIGGLE_MS = 520;

export function ListeningGame({ domainProgress, settings, mediaReady, speechStatus, onBack, onCompleteRound }: ToddlerGameProps) {
  const [attempts, setAttempts] = useState(0);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [wiggleId, setWiggleId] = useState<string | null>(null);

  const { round, startNextRound } = useAdaptiveRound('listening', domainProgress, generateListeningRound);
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;

  const speakPrompt = useCallback(async (): Promise<void> => {
    const segments = buildPhraseSegments(round.promptHe, round.promptEn, settings.languageMode, settings.englishVoiceLocale);
    await speechService.speakSegments(segments, settings);
  }, [round.promptEn, round.promptHe, settings]);

  useEffect(() => {
    setAttempts(0);
    setCelebration(null);
    setWiggleId(null);
    if (mediaReady) {
      void speakPrompt();
    }
    return () => speechService.cancel();
  }, [mediaReady, round, speakPrompt]);

  const handleChoice = (optionId: string) => {
    if (celebration) {
      return;
    }

    const concept = learningConcepts.find((item) => item.id === optionId)!;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    soundService.playTap(settings);

    if (optionId === round.targetId) {
      const summary = onCompleteRound({ attempts: nextAttempts, requiredActions: 1, concepts: [round.targetId] });
      setCelebration({
        seed: `listening-${round.targetId}-${nextAttempts}`,
        targetSegments: buildPhraseSegments(concept.he, concept.en, settings.languageMode, settings.englishVoiceLocale),
        tier: summary.milestone ? 'milestone' : 'standard',
      });
      return;
    }

    // Gentle wiggle (no red/failure language), then label what was tapped and
    // immediately re-model the target so the child hears it again.
    setWiggleId(optionId);
    window.setTimeout(() => setWiggleId((current) => (current === optionId ? null : current)), WIGGLE_MS);
    void speechService
      .speakSegments(buildPhraseSegments(concept.he, concept.en, settings.languageMode, settings.englishVoiceLocale), settings)
      .then((completed) => {
        if (completed && mediaReady) {
          void speakPrompt();
        }
      });
  };

  return (
    <GameShell
      ariaLabel={gameMeta.listening.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.listening.accentClass}
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
      <div className="choice-grid" role="group" aria-label={prompt}>
        {round.optionIds.map((optionId) => {
          const concept = learningConcepts.find((item) => item.id === optionId)!;
          return (
            <button
              key={optionId}
              className={`choice-button ${wiggleId === optionId ? 'is-wiggling' : ''}`}
              onClick={() => handleChoice(optionId)}
              type="button"
              aria-label={englishOnly ? concept.en : concept.he}
            >
              <ConceptArt conceptId={concept.id} label={englishOnly ? concept.en : concept.he} className="choice-button__art" />
            </button>
          );
        })}
      </div>
    </GameShell>
  );
}
