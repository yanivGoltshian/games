import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { GameShell } from '../components/GameShell';
import { gameMeta } from '../content/games';
import { MORE_NUMBERS_SPEECH } from '../content/levelUpSpeech';
import {
  NUMBER_WORDS_EN,
  NUMBER_WORDS_HE,
  generateNumberPairsRound,
  getNumberPairsRoundSignature,
} from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import {
  INITIAL_NUMBER_PAIRS_STATE,
  reduceNumberPairs,
  type NumberPairsState,
} from './numberPairsState';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useRetryFeedback } from './useRetryFeedback';

const SPEECH_SCOPE = 'game:number-pairs';

function numberSegments(value: number, settings: ToddlerGameProps['settings']) {
  return buildPhraseSegments(
    NUMBER_WORDS_HE[value] ?? String(value),
    NUMBER_WORDS_EN[value] ?? String(value),
    settings.languageMode,
    settings.englishVoiceLocale,
  );
}

export function NumberPairsGame({
  domainProgress,
  settings,
  mediaReady,
  onBack,
  onCompleteRound,
}: ToddlerGameProps) {
  const [state, setState] = useState<NumberPairsState>(INITIAL_NUMBER_PAIRS_STATE);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'numberPairs',
    domainProgress,
    generateNumberPairsRound,
    { getSignature: getNumberPairsRoundSignature, limit: 8 },
  );
  const { retryVisible, beginInteraction, runRetry } = useRetryFeedback({
    scope: SPEECH_SCOPE,
    roundKey,
    settings,
  });
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;

  const speakPrompt = useCallback(async (interrupt = false): Promise<void> => {
    await speechService.speakSegments(
      buildPhraseSegments(
        round.promptHe,
        round.promptEn,
        settings.languageMode,
        settings.englishVoiceLocale,
      ),
      settings,
      {
        scope: SPEECH_SCOPE,
        key: `prompt:${roundKey}`,
        priority: interrupt ? 'replay' : 'prompt',
        interrupt,
      },
    );
  }, [round.promptEn, round.promptHe, roundKey, settings]);
  const speakPromptRef = useRef(speakPrompt);
  speakPromptRef.current = speakPrompt;

  useEffect(() => {
    setState(INITIAL_NUMBER_PAIRS_STATE);
    setCelebration(null);
    if (mediaReady) {
      void speakPromptRef.current();
    }
  }, [mediaReady, roundKey]);
  const speakNumber = (value: number) => {
    return speechService.speakSegments(numberSegments(value, settings), settings, {
      scope: SPEECH_SCOPE,
      key: 'number-label',
      priority: 'label',
      staleAfterSuccess: true,
    });
  };

  const chooseTile = (row: 'top' | 'bottom', index: number): void => {
    const top = row === 'top';
    if (state.completed || celebration || (retryVisible && (top ? state.wrongTopIndex : state.wrongBottomIndex) === index)) {
      return;
    }
    const chosenValue = (top ? round.topRow : round.bottomRow)[index]!;
    const anchorIndex = top ? state.selectedBottomIndex : state.selectedTopIndex;
    const nextState = reduceNumberPairs(state, { type: top ? 'select-top' : 'select-bottom', index }, round);
    if (nextState === state) {
      return;
    }
    beginInteraction();
    soundService.playTap(settings);
    setState(nextState);

    if (anchorIndex === null) {
      void speakNumber(chosenValue);
      return;
    }

    if (nextState.wrongTopIndex !== null || nextState.wrongBottomIndex !== null) {
      const selectedValue = (top ? round.bottomRow : round.topRow)[anchorIndex]!;
      const missCount = nextState.attempts - nextState.matchedTopIndices.length;
      runRetry({
        missCount,
        seed: `${roundKey}:${nextState.attempts}:${selectedValue}`,
        modelLines: [chosenValue, selectedValue].map((value) => ({
          he: NUMBER_WORDS_HE[value] ?? String(value),
          en: NUMBER_WORDS_EN[value] ?? String(value),
          pauseAfterMs: 220,
        })),
        phraseScope: 'number-pairs',
      });
      return;
    }

    soundService.playSuccess(settings);
    if (!nextState.completed) {
      void speakNumber(chosenValue);
      return;
    }

    const summary = onCompleteRound({
      attempts: nextState.attempts,
      requiredActions: round.selectedValues.length,
      concepts: round.selectedValues.map((value) => `number-${value}`),
    });
    const followUpSegments = summary.recommendation
      ? buildPhraseSegments(
          MORE_NUMBERS_SPEECH.he,
          MORE_NUMBERS_SPEECH.en,
          settings.languageMode,
          settings.englishVoiceLocale,
        )
      : [];
    setCelebration({
      seed: `number-pairs-${roundKey}-${round.signature}-${nextState.attempts}`,
      targetSegments: numberSegments(chosenValue, settings),
      tier: summary.milestone ? 'milestone' : 'standard',
      recommendation: summary.recommendation,
      celebrationVariant: 'trophy-spark',
      followUpSegments,
    });
  };

  const rowStyle = { '--pair-count': round.topRow.length } as CSSProperties;
  return (
    <GameShell
      ariaLabel={gameMeta.numberPairs.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.numberPairs.accentClass}
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
      <div className="pair-playfield">
        <div className="number-pairs-surface" role="group" aria-label={prompt}>
          <div
            className="number-pairs-row number-pairs-row--top"
            data-count={round.topRow.length}
            style={rowStyle}
            role="group"
            aria-label={englishOnly ? 'Top numbers' : 'מספרים למעלה'}
          >
            {round.topRow.map((value, index) => {
              const selected = state.selectedTopIndex === index;
              const matched = state.matchedTopIndices.includes(index);
              const wrong = retryVisible && state.wrongTopIndex === index;
              return (
                <button
                  key={`top-${index}-${value}`}
                  className={`number-pair-tile ${selected ? 'is-selected' : ''} ${matched ? 'is-matched' : ''} ${wrong ? 'is-wrong is-wiggling' : ''}`}
                  disabled={matched}
                  onClick={() => chooseTile('top', index)}
                  type="button"
                  aria-label={englishOnly ? NUMBER_WORDS_EN[value] : NUMBER_WORDS_HE[value]}
                  aria-pressed={selected || matched}
                >
                  <span className={value === 10 ? 'number-pair-tile__two-digits' : undefined} aria-hidden="true">{value}</span>
                </button>
              );
            })}
          </div>
          <div
            className="number-pairs-row number-pairs-row--bottom"
            data-count={round.bottomRow.length}
            style={rowStyle}
            role="group"
            aria-label={englishOnly ? 'Bottom numbers' : 'מספרים למטה'}
          >
            {round.bottomRow.map((value, index) => {
              const selected = state.selectedBottomIndex === index;
              const matched = state.matchedBottomIndices.includes(index);
              const wrong = retryVisible && state.wrongBottomIndex === index;
              return (
                <button
                  key={`bottom-${index}-${value}`}
                  className={`number-pair-tile ${selected ? 'is-selected' : ''} ${matched ? 'is-matched' : ''} ${wrong ? 'is-wrong is-wiggling' : ''}`}
                  disabled={matched}
                  onClick={() => chooseTile('bottom', index)}
                  type="button"
                  aria-label={englishOnly ? NUMBER_WORDS_EN[value] : NUMBER_WORDS_HE[value]}
                  aria-pressed={selected || matched}
                >
                  <span className={value === 10 ? 'number-pair-tile__two-digits' : undefined} aria-hidden="true">{value}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </GameShell>
  );
}
