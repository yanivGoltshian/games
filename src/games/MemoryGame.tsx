import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type TransitionEvent } from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { cardPressFeedback } from '../components/cardPressFeedback';
import { getMemoryConcept, MEMORY_GARDEN_ART } from '../content/memoryGarden';
import { gameMeta } from '../content/games';
import { generateMemoryRound, getMemoryRoundSignature } from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
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
  const [celebratedPairIds, setCelebratedPairIds] = useState<string[]>([]);
  const [mismatch, setMismatch] = useState<{ token: number } | null>(null);
  const mismatchTokenRef = useRef(0);
  const interactionRef = useRef(0);

  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'memory',
    domainProgress,
    generateMemoryRound,
    { getSignature: getMemoryRoundSignature, limit: 8 },
  );
  const { retryVisible, beginInteraction, runRetry } = useRetryFeedback({ scope: SPEECH_SCOPE, roundKey, settings });
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
    setCelebratedPairIds([]);
    setMismatch(null);
    if (mediaReady) {
      void speakPromptRef.current();
    }
    return () => { interactionRef.current += 1; };
  }, [mediaReady, roundKey]);

  useEffect(() => {
    if (!pendingCelebration) {
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

    const handle = scheduleMemoryMismatchClose(
      mismatchHoldMs,
      () => {
        setFlippedIds([]);
        setMismatch(null);
      },
      window,
    );

    return handle.cancel;
  }, [mismatch, mismatchHoldMs]);

  const handleCardClick = (cardId: string) => {
    if (
      celebration
      || pendingCelebration
      || mismatch
      || flippedIds.includes(cardId)
    ) {
      return;
    }

    const card = round.cards.find((item) => item.id === cardId);
    if (!card || matchedPairIds.includes(card.pairId)) {
      return;
    }

    const interaction = ++interactionRef.current;
    beginInteraction();
    soundService.playTap(settings);
    const concept = getMemoryConcept(card.conceptId);
    const nextFlipped = [...flippedIds, cardId];
    setFlippedIds(nextFlipped);

    if (nextFlipped.length < 2) {
      if (concept) {
        void speechService.speakSegments(
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

    if (firstCard.pairId === card.pairId) {
      const nextMatched = [...matchedPairIds, card.pairId];
      setMatchedPairIds(nextMatched);
      setCelebratedPairIds((current) => current.includes(card.pairId)
        ? current
        : [...current, card.pairId]);
      setFlippedIds([]);
      const secondLabelPromise = concept
        ? speechService.speakSegments(
          buildPhraseSegments(concept.he, concept.en, settings.languageMode, settings.englishVoiceLocale),
          settings,
          { scope: SPEECH_SCOPE, key: 'card-label', priority: 'label' },
        )
        : null;
      if (nextMatched.length === round.pairConceptIds.length) {
        const summary = onCompleteRound({
          attempts: nextAttempts,
          requiredActions: round.pairConceptIds.length,
          concepts: round.pairConceptIds,
        });
        const info: CelebrationInfo = {
          seed: `memory-${round.pairConceptIds.join('-')}-${nextAttempts}`,
          targetSegments: [],
          ...(secondLabelPromise ? { beforeSpeech: secondLabelPromise } : {}),
          tier: summary.milestone ? 'milestone' : 'standard',
          recommendation: summary.recommendation,
          celebrationVariant: 'memory-fireworks',
          soundVariant: 'memory',
          soundTiming: 'after-speech',
        };
        dispatchCelebration({
          type: 'queue',
          finalCardId: cardId,
          info,
        });
      } else if (secondLabelPromise) {
        void secondLabelPromise.then((result) => {
          if (interaction !== interactionRef.current) {
            return;
          }
          if (result.status !== 'cancelled' && result.status !== 'superseded') {
            soundService.playMemoryPair(settings);
          }
        });
      }
      return;
    }

    const nextMisses = misses + 1;
    setMisses(nextMisses);
    setMismatch({ token: (mismatchTokenRef.current += 1) });
    // Fire-and-forget audio only. Card close + interaction lock are owned by the
    // mismatch timeout above, never by this speech promise (which can hang on iPad).
    runRetry({
      missCount: nextMisses,
      seed: `${roundKey}:${nextMisses}:${firstCard.conceptId}:${card.conceptId}`,
      modelLines: concept ? [{ he: concept.he, en: concept.en, pauseAfterMs: 220 }] : [],
      phraseScope: 'memory-search',
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
            onDismiss={() => dispatchCelebration({ type: 'dismiss' })}
            startNextRound={startNextRound}
          />
        ) : undefined
      }
    >
      <div className="pair-playfield">
        <div
          className="memory-grid"
          role="group"
          aria-label={prompt}
          data-card-count={round.cards.length}
          style={{ '--memory-count': round.cards.length } as CSSProperties}
        >
          {round.cards.map((card) => {
            const concept = getMemoryConcept(card.conceptId)!;
            const matched = matchedPairIds.includes(card.pairId);
            const flipped = flippedIds.includes(card.id) || matched;
            const celebrated = celebratedPairIds.includes(card.pairId);
            return (
              <button
                key={card.id}
                {...cardPressFeedback}
                className={`memory-card ${flipped ? 'memory-card--flipped' : ''} ${celebrated ? 'memory-card--celebrated' : ''}`}
                disabled={mismatch !== null || matched}
                onClick={() => handleCardClick(card.id)}
                type="button"
                aria-label={flipped ? (englishOnly ? concept.en : concept.he) : (englishOnly ? 'Hidden card' : 'קלף סגור')}
                aria-pressed={flipped}
              >
                <span
                  className="memory-card__inner"
                  onTransitionEnd={(event) => handleFlipTransitionEnd(card.id, event)}
                >
                  <span
                    className="memory-face memory-face--front"
                    aria-hidden={flipped ? undefined : true}
                  >
                    {MEMORY_GARDEN_ART[concept.id]
                      ? <img className="memory-face__art" src={MEMORY_GARDEN_ART[concept.id]} alt={englishOnly ? concept.en : concept.he} data-memory-art={concept.id} draggable={false} />
                      : <ConceptArt conceptId={concept.id} label={englishOnly ? concept.en : concept.he} className="memory-face__art" />}
                  </span>
                  <span className="memory-face memory-face--back" aria-hidden="true" />
                </span>
                {celebrated ? (
                  <span className="memory-card__sparkles" aria-hidden="true">
                    <i /><i /><i /><i /><i />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}
