import { useCallback, useEffect, useRef, useState } from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { SuccessOverlay } from '../components/SuccessOverlay';
import { learningConcepts } from '../content/concepts';
import { gameMeta } from '../content/games';
import { generateMemoryRound } from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';

export function MemoryGame({ domainProgress, settings, mediaReady, speechStatus, onBack, onCompleteRound }: ToddlerGameProps) {
  const [attempts, setAttempts] = useState(0);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [wiggleIds, setWiggleIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const { round, startNextRound } = useAdaptiveRound('memory', domainProgress, generateMemoryRound);
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;

  const speakPrompt = useCallback(async (): Promise<void> => {
    const segments = buildPhraseSegments(round.promptHe, round.promptEn, settings.languageMode, settings.englishVoiceLocale);
    await speechService.speakSegments(segments, settings);
  }, [round.promptEn, round.promptHe, settings]);

  useEffect(() => {
    setAttempts(0);
    setCelebration(null);
    setFlippedIds([]);
    setMatchedPairIds([]);
    setWiggleIds([]);
    setBusy(false);
    if (mediaReady) {
      void speakPrompt();
    }
    return () => {
      speechService.cancel();
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [mediaReady, round, speakPrompt]);

  const handleCardClick = (cardId: string) => {
    if (busy || celebration || flippedIds.includes(cardId)) {
      return;
    }

    const card = round.cards.find((item) => item.id === cardId);
    if (!card || matchedPairIds.includes(card.pairId)) {
      return;
    }

    soundService.playTap(settings);
    // Labeling tap: name the object as soon as the card is revealed.
    const concept = learningConcepts.find((item) => item.id === card.conceptId);
    if (concept && mediaReady) {
      void speechService.speakSegments(buildPhraseSegments(concept.he, concept.en, settings.languageMode, settings.englishVoiceLocale), settings);
    }

    const nextFlipped = [...flippedIds, cardId];
    setFlippedIds(nextFlipped);

    if (nextFlipped.length < 2) {
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    const [firstId] = nextFlipped;
    const firstCard = round.cards.find((item) => item.id === firstId)!;

    if (firstCard.pairId === card.pairId) {
      const nextMatched = [...matchedPairIds, card.pairId];
      setMatchedPairIds(nextMatched);
      setFlippedIds([]);
      soundService.playSuccess(settings);
      if (nextMatched.length === round.pairConceptIds.length) {
        const summary = onCompleteRound({
          attempts: nextAttempts,
          requiredActions: round.pairConceptIds.length,
          concepts: round.pairConceptIds,
        });
        setCelebration({
          seed: `memory-${round.pairConceptIds.join('-')}-${nextAttempts}`,
          targetSegments: concept ? buildPhraseSegments(concept.he, concept.en, settings.languageMode, settings.englishVoiceLocale) : [],
          tier: summary.milestone ? 'milestone' : 'standard',
        });
      }
      return;
    }

    setBusy(true);
    setWiggleIds(nextFlipped);
    timeoutRef.current = window.setTimeout(
      () => {
        setFlippedIds([]);
        setWiggleIds([]);
        setBusy(false);
      },
      settings.reducedMotion ? 350 : 700,
    );
  };

  return (
    <GameShell
      ariaLabel={gameMeta.memory.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.memory.accentClass}
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
      <div className="memory-grid" role="group" aria-label={prompt}>
        {round.cards.map((card) => {
          const concept = learningConcepts.find((item) => item.id === card.conceptId)!;
          const flipped = flippedIds.includes(card.id) || matchedPairIds.includes(card.pairId);
          const wiggling = wiggleIds.includes(card.id);
          return (
            <button
              key={card.id}
              className={`memory-card ${flipped ? 'memory-card--flipped' : ''} ${wiggling ? 'is-wiggling' : ''}`}
              onClick={() => handleCardClick(card.id)}
              type="button"
              aria-label={flipped ? (englishOnly ? concept.en : concept.he) : (englishOnly ? 'Hidden card' : 'קלף סגור')}
              aria-pressed={flipped}
            >
              <span className="memory-card__inner">
                <span className="memory-face memory-face--front">
                  <ConceptArt conceptId={concept.id} label={englishOnly ? concept.en : concept.he} className="memory-face__art" />
                </span>
                <span className="memory-face memory-face--back" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </GameShell>
  );
}
