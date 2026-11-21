import { useCallback, useEffect, useRef, useState } from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { cardPressFeedback } from '../components/cardPressFeedback';
import { learningConcepts } from '../content/concepts';
import { gameMeta } from '../content/games';
import { generateListeningRound, getListeningRoundSignature } from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useRetryFeedback } from './useRetryFeedback';

const SPEECH_SCOPE = 'game:listening';

export function ListeningGame({
  domainProgress,
  settings,
  mediaReady,
  onBack,
  onCompleteRound,
}: ToddlerGameProps) {
  const [attempts, setAttempts] = useState(0);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [wiggleId, setWiggleId] = useState<string | null>(null);

  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'listening',
    domainProgress,
    generateListeningRound,
    { getSignature: getListeningRoundSignature, limit: 8 },
  );
  const { retryVisible, beginInteraction, runRetry } = useRetryFeedback({ scope: SPEECH_SCOPE, roundKey, settings });
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;

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
    setWiggleId(null);
    if (mediaReady) {
      void speakPromptRef.current();
    }
  }, [mediaReady, roundKey]);

  const handleChoice = (optionId: string) => {
    if (celebration || (retryVisible && wiggleId === optionId)) {
      return;
    }
    beginInteraction();
    const concept = learningConcepts.find((item) => item.id === optionId)!;
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    if (optionId === round.targetId) {
      soundService.playTap(settings);
      const summary = onCompleteRound({ attempts: nextAttempts, requiredActions: 1, concepts: [round.targetId] });
      setCelebration({
        seed: `listening-${round.targetId}-${nextAttempts}`,
        targetSegments: buildPhraseSegments(concept.he, concept.en, settings.languageMode, settings.englishVoiceLocale),
        tier: summary.milestone ? 'milestone' : 'standard',
        recommendation: summary.recommendation,
      });
      return;
    }

    setWiggleId(optionId);
    runRetry({
      missCount: nextAttempts,
      seed: `${roundKey}:${nextAttempts}`,
      modelLines: [{ he: round.promptHe, en: round.promptEn, pauseAfterMs: 240 }],
    });
  };

  return (
    <GameShell
      ariaLabel={gameMeta.listening.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.listening.accentClass}
      reducedMotion={settings.reducedMotion}
      onHome={onBack}
      onRestart={() => {
        speechService.cancelScope(SPEECH_SCOPE);
        startNextRound();
      }}
      restartLabel={englishOnly ? 'New game' : 'משחק חדש'}
      homeLabel={englishOnly ? 'Back home' : 'חזרה לבית'}
      liveStatus={prompt}
      retryActive={retryVisible}
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
      <div className="choice-grid" role="group" aria-label={prompt}>
        {round.optionIds.map((optionId) => {
          const concept = learningConcepts.find((item) => item.id === optionId)!;
          return (
            <button
              key={optionId}
              {...cardPressFeedback}
              className={`choice-button ${retryVisible && wiggleId === optionId ? 'is-wiggling' : ''}`}
              disabled={!!celebration}
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
