import { useCallback, useEffect, useRef, useState } from 'react';
import type { RetryScope } from '../content/retry';
import type { InteractionMediaScope } from '../domain/interactionMedia';
import { SessionRetryHistory } from '../domain/retry';
import type { ToddlerSettings } from '../domain/types';
import {
  createInteractionMediaUnits,
  interactionMediaCoordinator,
} from '../services/interactionMediaCoordinator';
import { soundService } from '../services/sound';
import {
  buildLocalizedSegments,
  buildPersonalizedPhraseSegments,
  speechService,
  type LocalizedSpeechLine,
} from '../services/speech';

const retryHistory = new SessionRetryHistory();

interface RetryFeedbackOptions {
  scope: string;
  roundKey: string | number;
  settings: ToddlerSettings;
  coordinatedSpeech?: {
    intentIdPrefix: string;
    scope: InteractionMediaScope;
  };
}

interface RunRetryOptions {
  missCount: number;
  seed: string;
  modelLines: LocalizedSpeechLine[];
  phraseScope?: RetryScope;
}

export function useRetryFeedback({
  scope,
  roundKey,
  settings,
  coordinatedSpeech,
}: RetryFeedbackOptions) {
  const [retryVisible, setRetryVisible] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const callIdRef = useRef(0);

  const cancelFeedback = useCallback(() => {
    window.clearTimeout(timerRef.current);
    if (coordinatedSpeech) {
      interactionMediaCoordinator.notifyInteraction(coordinatedSpeech.scope, 'touch');
    } else {
      speechService.cancelScope(scope, 'replay');
    }
  }, [coordinatedSpeech, scope]);
  const beginInteraction = useCallback(() => {
    cancelFeedback();
    setRetryVisible(false);
  }, [cancelFeedback]);

  useEffect(() => {
    setRetryVisible(false);
    return cancelFeedback;
  }, [cancelFeedback, roundKey]);

  const runRetry = useCallback(
    ({
      missCount,
      seed,
      modelLines,
      phraseScope = 'generic',
    }: RunRetryOptions): void => {
      const callId = ++callIdRef.current;
      setRetryVisible(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setRetryVisible(false), settings.reducedMotion ? 450 : 720);
      soundService.playRetry(settings);

      const heLine = retryHistory.select({
        locale: 'he',
        missCount,
        seed,
        scope: phraseScope,
        historyKey: `${scope}:${phraseScope}:he`,
      });
      const enLine = retryHistory.select({
        locale: 'en',
        missCount,
        seed,
        scope: phraseScope,
        historyKey: `${scope}:${phraseScope}:en`,
      });
      const encouragement = buildPersonalizedPhraseSegments({
        he: heLine.text,
        en: enLine.text,
        ...(heLine.recordedFallbackText
          ? { recordedFallbackHe: heLine.recordedFallbackText }
          : {}),
        ...(enLine.recordedFallbackText
          ? { recordedFallbackEn: enLine.recordedFallbackText }
          : {}),
      }, settings);
      const model = buildLocalizedSegments(modelLines, settings.languageMode, settings.englishVoiceLocale);

      if (coordinatedSpeech) {
        const mediaScope = {
          ...coordinatedSpeech.scope,
          stepId: `${coordinatedSpeech.scope.stepId}:${callId}`,
        };
        const segments = [...model, ...encouragement];
        const modelEndIndex = model.length - 1;
        if (modelEndIndex >= 0 && encouragement.length > 0) {
          segments[modelEndIndex] = { ...segments[modelEndIndex]!, pauseAfterMs: 260 };
        }
        void interactionMediaCoordinator.play({
          intentId: `${coordinatedSpeech.intentIdPrefix}:${roundKey}:${callId}`,
          source: 'automatic',
          scope: mediaScope,
          audioClass: 'conditional',
          settings,
          units: createInteractionMediaUnits(mediaScope, segments),
        });
      } else {
        void speechService.speakRetrySequence(model, encouragement, settings, {
          scope,
          key: 'retry',
        });
      }
    },
    [coordinatedSpeech, roundKey, scope, settings],
  );

  return { retryVisible, beginInteraction, runRetry };
}
