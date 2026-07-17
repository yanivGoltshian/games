import { useCallback, useEffect, useRef, useState } from 'react';
import type { RetryScope } from '../content/retry';
import { SessionRetryHistory } from '../domain/retry';
import type { ToddlerSettings } from '../domain/types';
import { soundService } from '../services/sound';
import {
  buildLocalizedSegments,
  buildPersonalizedPhraseSegments,
  speechService,
  type LocalizedSpeechLine,
  type SpeechResult,
} from '../services/speech';

const retryHistory = new SessionRetryHistory();

interface RetryFeedbackOptions {
  scope: string;
  roundKey: string | number;
  settings: ToddlerSettings;
}

interface RunRetryOptions {
  missCount: number;
  seed: string;
  modelLines: LocalizedSpeechLine[];
  phraseScope?: RetryScope;
  beforeSpeech?: Promise<unknown> | null;
  lockUntilComplete?: boolean;
}

export function useRetryFeedback({ scope, roundKey, settings }: RetryFeedbackOptions) {
  const [retryBusy, setRetryBusy] = useState(false);
  const interactionLockedRef = useRef(false);
  const callIdRef = useRef(0);
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;
    callIdRef.current += 1;
    interactionLockedRef.current = false;
    setRetryBusy(false);
    return () => {
      generationRef.current += 1;
      callIdRef.current += 1;
      interactionLockedRef.current = false;
    };
  }, [roundKey]);

  const runRetry = useCallback(
    async ({
      missCount,
      seed,
      modelLines,
      phraseScope = 'generic',
      beforeSpeech = null,
      lockUntilComplete = false,
    }: RunRetryOptions): Promise<void> => {
      if (interactionLockedRef.current) {
        return;
      }

      interactionLockedRef.current = true;
      const callId = ++callIdRef.current;
      setRetryBusy(true);
      soundService.playRetry(settings);
      const generation = generationRef.current;
      const minimumMs = settings.reducedMotion ? 450 : 720;
      const minimumVisualTime = new Promise<void>((resolve) => window.setTimeout(resolve, minimumMs));

      if (beforeSpeech) {
        const result = await beforeSpeech;
        if (
          isSpeechResult(result)
          && (result.status === 'cancelled' || result.status === 'superseded')
        ) {
          if (generation === generationRef.current && callId === callIdRef.current) {
            interactionLockedRef.current = false;
            setRetryBusy(false);
          }
          return;
        }
      }
      if (generation !== generationRef.current) {
        return;
      }

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

      const speech = speechService.speakRetrySequence(model, encouragement, settings, {
        scope,
        key: 'retry',
      });

      if (!lockUntilComplete) {
        await minimumVisualTime;
        if (generation === generationRef.current && callId === callIdRef.current) {
          interactionLockedRef.current = false;
          setRetryBusy(false);
        }
      }

      await speech;
      await minimumVisualTime;
      if (generation === generationRef.current && callId === callIdRef.current) {
        interactionLockedRef.current = false;
        setRetryBusy(false);
      }
    },
    [scope, settings],
  );

  return { retryBusy, runRetry };
}

function isSpeechResult(value: unknown): value is SpeechResult {
  if (!value || typeof value !== 'object' || !('status' in value)) {
    return false;
  }
  const { status } = value as { status: unknown };
  return status === 'completed'
    || status === 'cancelled'
    || status === 'superseded'
    || status === 'error'
    || status === 'timed-out'
    || status === 'skipped';
}
