import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { GameShell } from '../components/GameShell';
import { gameMeta } from '../content/games';
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
  speechStatus,
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
  const { retryBusy, runRetry } = useRetryFeedback({
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

  const speakNumber = (value: number, key: string): void => {
    void speechService.speakSegments(numberSegments(value, settings), settings, {
      scope: SPEECH_SCOPE,
      key,
      priority: 'label',
      staleAfterSuccess: true,
    });
  };

  const handleTop = (index: number): void => {
    if (celebration || retryBusy) {
      return;
    }
    const nextState = reduceNumberPairs(state, { type: 'select-top', index }, round);
    if (nextState === state) {
      return;
    }
    soundService.playTap(settings);
    setState(nextState);
    speakNumber(round.topRow[index]!, 'selected-number');
  };

  const handleBottom = (index: number): void => {
    if (celebration || retryBusy) {
      return;
    }
    const selectedTopIndex = state.selectedTopIndex;
    const nextState = reduceNumberPairs(state, { type: 'choose-bottom', index }, round);
    if (nextState === state || selectedTopIndex === null) {
      return;
    }
    setState(nextState);

    const selectedValue = round.topRow[selectedTopIndex]!;
    if (nextState.wrongBottomIndex !== null) {
      const missCount = nextState.attempts - nextState.matchedTopIndices.length;
      void runRetry({
        missCount,
        seed: `${roundKey}:${nextState.attempts}:${selectedValue}`,
        modelLines: [{
          he: NUMBER_WORDS_HE[selectedValue] ?? String(selectedValue),
          en: NUMBER_WORDS_EN[selectedValue] ?? String(selectedValue),
          pauseAfterMs: 220,
        }],
        phraseScope: 'number-pairs',
        lockUntilComplete: true,
      }).finally(() => {
        setState((current) => reduceNumberPairs(current, { type: 'clear-wrong' }, round));
      });
      return;
    }

    soundService.playSuccess(settings);
    if (!nextState.completed) {
      speakNumber(selectedValue, 'matched-number');
      return;
    }

    const summary = onCompleteRound({
      attempts: nextState.attempts,
      requiredActions: round.selectedValues.length,
      concepts: round.selectedValues.map((value) => `number-${value}`),
    });
    const followUpSegments = [
      ...(summary.recommendation
        ? buildPhraseSegments(
            'עכשיו יותר מספרים',
            'Now more numbers',
            settings.languageMode,
            settings.englishVoiceLocale,
          )
        : []),
      ...buildPhraseSegments(
        'זכית בגביע!',
        'You won a trophy!',
        settings.languageMode,
        settings.englishVoiceLocale,
      ),
    ];
    setCelebration({
      seed: `number-pairs-${round.signature}-${nextState.attempts}`,
      targetSegments: numberSegments(selectedValue, settings),
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
      <div className="number-pairs-surface" role="group" aria-label={prompt}>
        <div
          className="number-pairs-row number-pairs-row--top"
          data-count={round.topRow.length}
          style={rowStyle}
        >
          {round.topRow.map((value, index) => {
            const selected = state.selectedTopIndex === index;
            const matched = state.matchedTopIndices.includes(index);
            return (
              <button
                key={`top-${index}-${value}`}
                className={`number-pair-tile ${selected ? 'is-selected' : ''} ${matched ? 'is-matched' : ''}`}
                disabled={retryBusy || matched}
                onClick={() => handleTop(index)}
                type="button"
                aria-label={englishOnly ? NUMBER_WORDS_EN[value] : NUMBER_WORDS_HE[value]}
                aria-pressed={selected || matched}
              >
                <span aria-hidden="true">{value}</span>
              </button>
            );
          })}
        </div>
        <div
          className="number-pairs-row number-pairs-row--bottom"
          data-count={round.bottomRow.length}
          style={rowStyle}
        >
          {round.bottomRow.map((value, index) => {
            const matched = state.matchedBottomIndices.includes(index);
            const wrong = state.wrongBottomIndex === index;
            return (
              <button
                key={`bottom-${index}-${value}`}
                className={`number-pair-tile ${matched ? 'is-matched' : ''} ${wrong ? 'is-wrong is-wiggling' : ''}`}
                disabled={retryBusy || matched}
                onClick={() => handleBottom(index)}
                type="button"
                aria-label={englishOnly ? NUMBER_WORDS_EN[value] : NUMBER_WORDS_HE[value]}
                aria-pressed={matched}
              >
                <span aria-hidden="true">{value}</span>
              </button>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}
