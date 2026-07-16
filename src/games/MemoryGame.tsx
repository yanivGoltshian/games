import { useCallback, useEffect, useReducer, useRef, useState, type TransitionEvent } from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { learningConcepts } from '../content/concepts';
import { gameMeta } from '../content/games';
import { generateMemoryRound } from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService, type SpeechResult } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import {
  INITIAL_MEMORY_CELEBRATION_STATE,
  memoryMismatchHoldMs,
  memoryRevealFallbackMs,
  reduceMemoryCelebration,
  scheduleMemoryMismatchClose,
  scheduleMemoryRevealFallback,
} from './memoryCelebration';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useRetryFeedback } from './useRetryFeedback';

const SPEECH_SCOPE = 'game:memory';

export function MemoryGame({
  domainProgress,
  settings,
  mediaReady,
  speechStatus,
  onBack,
  onCompleteRound,
}: ToddlerGameProps) {
  const [attempts, setAttempts] = useState(0);
  const [misses, setMisses] = useState(0);
  const [celebrationState, dispatchCelebration] = useReducer(
    reduceMemoryCelebration,
    INITIAL_MEMORY_CELEBRATION_STATE,
  );
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [mismatch, setMismatch] = useState<{ token: number } | null>(null);
  const mismatchTokenRef = useRef(0);
  const firstLabelPromiseRef = useRef<Promise<SpeechResult> | null>(null);
  const roundGenerationRef = useRef(0);

  const { round, roundKey, startNextRound } = useAdaptiveRound('memory', domainProgress, generateMemoryRound);
  const { retryBusy, runRetry } = useRetryFeedback({ scope: SPEECH_SCOPE, roundKey, settings });
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;
  const celebration = celebrationState.visible;
  const pendingCelebration = celebrationState.pending;
  const systemReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealFallbackMs = memoryRevealFallbackMs(settings.reducedMotion, systemReducedMotion);
  const mismatchHoldMs = memoryMismatchHoldMs(settings.reducedMotion, systemReducedMotion);

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
    setMisses(0);
    dispatchCelebration({ type: 'reset' });
    setFlippedIds([]);
    setMatchedPairIds([]);
    setMismatch(null);
    firstLabelPromiseRef.current = null;
    roundGenerationRef.current += 1;
    if (mediaReady) {
      void speakPromptRef.current();
    }
  }, [mediaReady, roundKey]);

  useEffect(() => {
    if (!pendingCelebration || revealFallbackMs === null) {
      return;
    }

    return scheduleMemoryRevealFallback(
      revealFallbackMs,
      () => {
        dispatchCelebration({
          type: 'reveal-complete',
          cardId: pendingCelebration.finalCardId,
        });
      },
      window,
    );
  }, [pendingCelebration, revealFallbackMs]);

  // Non-matching pairs stay visible for a deliberate toddler hold, then always flip
  // back. The close is timeout-driven so it fires even on WebKit/iPad where speech
  // and transition callbacks are unreliable; cleanup cancels any late close.
  useEffect(() => {
    if (!mismatch) {
      return;
    }

    const generation = roundGenerationRef.current;
    const handle = scheduleMemoryMismatchClose(
      mismatchHoldMs,
      () => {
        if (generation === roundGenerationRef.current) {
          setFlippedIds([]);
        }
        setMismatch(null);
      },
      window,
    );

    return handle.cancel;
  }, [mismatch, mismatchHoldMs]);

  const handleCardClick = (cardId: string) => {
    if (celebration || pendingCelebration || mismatch || flippedIds.includes(cardId)) {
      return;
    }

    const card = round.cards.find((item) => item.id === cardId);
    if (!card || matchedPairIds.includes(card.pairId)) {
      return;
    }

    soundService.playTap(settings);
    const concept = learningConcepts.find((item) => item.id === card.conceptId);
    const nextFlipped = [...flippedIds, cardId];
    setFlippedIds(nextFlipped);

    if (nextFlipped.length < 2) {
      if (concept) {
        firstLabelPromiseRef.current = speechService.speakSegments(
          buildPhraseSegments(concept.he, concept.en, settings.languageMode, settings.englishVoiceLocale),
          settings,
          { scope: SPEECH_SCOPE, key: 'card-label', priority: 'label' },
        );
      }
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    const [firstId] = nextFlipped;
    const firstCard = round.cards.find((item) => item.id === firstId)!;
    const firstConcept = learningConcepts.find((item) => item.id === firstCard.conceptId);

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
        const info: CelebrationInfo = {
          seed: `memory-${round.pairConceptIds.join('-')}-${nextAttempts}`,
          targetSegments: concept
            ? buildPhraseSegments(concept.he, concept.en, settings.languageMode, settings.englishVoiceLocale)
            : [],
          tier: summary.milestone ? 'milestone' : 'standard',
          recommendation: summary.recommendation,
        };
        dispatchCelebration({
          type: 'queue',
          finalCardId: cardId,
          info,
        });
      } else if (concept) {
        void speechService.speakSegments(
          buildPhraseSegments(concept.he, concept.en, settings.languageMode, settings.englishVoiceLocale),
          settings,
          { scope: SPEECH_SCOPE, key: 'card-label', priority: 'label' },
        );
      }
      firstLabelPromiseRef.current = null;
      return;
    }

    const nextMisses = misses + 1;
    setMisses(nextMisses);
    setMismatch({ token: (mismatchTokenRef.current += 1) });
    const firstLabel = firstLabelPromiseRef.current;
    firstLabelPromiseRef.current = null;
    const modelLines = [
      ...(firstLabel || !firstConcept ? [] : [{ he: firstConcept.he, en: firstConcept.en, pauseAfterMs: 180 }]),
      ...(concept ? [{ he: concept.he, en: concept.en, pauseAfterMs: 220 }] : []),
    ];
    // Fire-and-forget audio only. Card close + interaction lock are owned by the
    // mismatch timeout above, never by this speech promise (which can hang on iPad).
    void runRetry({
      missCount: nextMisses,
      seed: `${roundKey}:${nextMisses}:${firstCard.conceptId}:${card.conceptId}`,
      modelLines,
      phraseScope: 'memory-search',
      beforeSpeech: firstLabel,
      lockUntilComplete: false,
    });
  };

  const handleFlipTransitionEnd = (
    cardId: string,
    event: TransitionEvent<HTMLSpanElement>,
  ): void => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
      return;
    }
    dispatchCelebration({ type: 'reveal-complete', cardId });
  };

  return (
    <GameShell
      ariaLabel={gameMeta.memory.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.memory.accentClass}
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
            onDismiss={() => dispatchCelebration({ type: 'dismiss' })}
            startNextRound={startNextRound}
          />
        ) : undefined
      }
    >
      <div className="memory-grid" role="group" aria-label={prompt}>
        {round.cards.map((card) => {
          const concept = learningConcepts.find((item) => item.id === card.conceptId)!;
          const flipped = flippedIds.includes(card.id) || matchedPairIds.includes(card.pairId);
          return (
            <button
              key={card.id}
              className={`memory-card ${flipped ? 'memory-card--flipped' : ''}`}
              disabled={mismatch !== null}
              onClick={() => handleCardClick(card.id)}
              type="button"
              aria-label={flipped ? (englishOnly ? concept.en : concept.he) : (englishOnly ? 'Hidden card' : 'קלף סגור')}
              aria-pressed={flipped}
            >
              <span
                className="memory-card__inner"
                onTransitionEnd={(event) => handleFlipTransitionEnd(card.id, event)}
              >
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
