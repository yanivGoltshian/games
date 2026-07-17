import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { ConceptArt } from '../art/objects';
import { GameShell } from '../components/GameShell';
import { gameMeta } from '../content/games';
import {
  SILLY_ALIEN_LISTENING,
  SILLY_ALIEN_PROMPT,
  SILLY_ALIEN_RETRY,
} from '../content/sillyAlien';
import {
  generateSillyAlienRound,
  getSillyAlienRoundSignature,
} from '../domain/rounds';
import { soundService } from '../services/sound';
import {
  buildLocalizedSegments,
  buildPersonalizedPhraseSegments,
  buildPhraseSegments,
  speechService,
  type SpeechResult,
} from '../services/speech';
import {
  INITIAL_SILLY_ALIEN_STATE,
  reduceSillyAlien,
  selectEffortProgress,
  SILLY_ALIEN_LEVEL_THRESHOLD,
  SILLY_ALIEN_LISTEN_WINDOW_MS,
} from './sillyAlienState';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useMicEffort } from './useMicEffort';
import type { MicStartOutcome } from './useMicEffort';
import { personalizeChildName } from '../domain/childName';
import { DEFAULT_MICROPHONE_PLAYBACK_GUARD_MS } from '../services/microphonePlaybackGuard';

const SPEECH_SCOPE = 'game:silly-alien';

/**
 * A settled speech result should advance the round unless it was cut short by a
 * newer utterance (`cancelled`) or replaced in the queue (`superseded`). Quiet
 * mode / unsupported voices resolve as `skipped`/`unsupported`, which still
 * advance so a muted iPad never stalls.
 */
function settledShouldAdvance(status: SpeechResult['status']): boolean {
  return status !== 'cancelled' && status !== 'superseded';
}

function micOutcomeUsesFallback(outcome: MicStartOutcome): boolean {
  return (
    outcome.status === 'unsupported'
    || outcome.status === 'permission-denied'
    || outcome.status === 'error'
  );
}

type AlienMood = 'asleep' | 'confused' | 'listening' | 'happy';

interface AlienFaceProps {
  level: number;
  mood: AlienMood;
  replaying: boolean;
  chasing: boolean;
}

/**
 * The alien creature. Everything expressive is driven by CSS from the `mood`
 * class and the live `--level` custom property (microphone energy), so a
 * pre-reading child understands the whole interaction from motion alone:
 *   asleep    → gentle bob, waiting for the wake tap.
 *   confused  → the comic gag: eyes/antennae chase the escaped syllable.
 *   listening → leans in, glows and pulses with Sean's voice.
 *   happy     → beams and springs (paired with the snap-back animation).
 */
function AlienFace({ level, mood, replaying, chasing }: AlienFaceProps) {
  const style = { '--level': level } as CSSProperties;
  return (
    <div
      className={[
        'silly-alien-figure',
        `silly-alien-figure--${mood}`,
        replaying ? 'is-replaying' : '',
        chasing ? 'is-chasing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden="true"
    >
      <span className="silly-alien-figure__glow" />
      <svg className="silly-alien-figure__svg" viewBox="0 0 200 220" role="presentation">
        <g className="silly-alien-figure__antenna">
          <line x1="100" y1="46" x2="100" y2="14" stroke="#7c9cff" strokeWidth="6" strokeLinecap="round" />
          <circle className="silly-alien-figure__bulb" cx="100" cy="12" r="10" fill="#ffe14d" />
        </g>
        <ellipse className="silly-alien-figure__head" cx="100" cy="120" rx="76" ry="70" fill="#8be6b8" />
        <ellipse cx="100" cy="120" rx="76" ry="70" fill="url(#silly-alien-shade)" opacity="0.25" />
        <ellipse className="silly-alien-figure__cheek" cx="52" cy="140" rx="14" ry="9" fill="#ff9fce" />
        <ellipse className="silly-alien-figure__cheek" cx="148" cy="140" rx="14" ry="9" fill="#ff9fce" />
        <g className="silly-alien-figure__eyes">
          <circle cx="72" cy="104" r="26" fill="#ffffff" />
          <circle cx="128" cy="104" r="26" fill="#ffffff" />
          <circle className="silly-alien-figure__pupil" cx="72" cy="106" r="12" fill="#2a2350" />
          <circle className="silly-alien-figure__pupil" cx="128" cy="106" r="12" fill="#2a2350" />
          <circle cx="77" cy="100" r="4" fill="#ffffff" />
          <circle cx="133" cy="100" r="4" fill="#ffffff" />
        </g>
        <path
          className="silly-alien-figure__mouth"
          d="M78 158 Q100 176 122 158"
          fill="#3a2c5e"
          stroke="#3a2c5e"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <defs>
          <radialGradient id="silly-alien-shade" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#3fae86" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}

export function SillyAlienGame({
  domainProgress,
  settings,
  mediaReady,
  speechStatus,
  onBack,
  onCompleteRound,
}: ToddlerGameProps) {
  const [state, dispatch] = useReducer(reduceSillyAlien, INITIAL_SILLY_ALIEN_STATE);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  );
  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'sillyAlien',
    domainProgress,
    generateSillyAlienRound,
    { getSignature: getSillyAlienRoundSignature, limit: 8 },
  );

  const englishOnly = settings.languageMode === 'en';
  // The mic only samples while it is open (listening); the reducer ignores
  // `register-effort` outside the listening phase, so stray frames are no-ops.
  const mic = useMicEffort((level, deltaMs) => {
    dispatch({ type: 'register-effort', level, deltaMs });
  });

  // Latest-values snapshot so effects can key on `phase`/`roundKey` alone and
  // still read fresh round/settings/mic handles without re-firing on every
  // render. Refs are stable, so this never triggers extra effect runs.
  const dataRef = useRef({
    phase: state.phase,
    unlocked: state.unlocked,
    round,
    roundKey,
    settings,
    englishOnly,
    listenAttempts: state.listenAttempts,
    nudges: state.nudges,
    onCompleteRound,
    micStart: mic.start,
    micStop: mic.stop,
  });
  dataRef.current = {
    phase: state.phase,
    unlocked: state.unlocked,
    round,
    roundKey,
    settings,
    englishOnly,
    listenAttempts: state.listenAttempts,
    nudges: state.nudges,
    onCompleteRound,
    micStart: mic.start,
    micStop: mic.stop,
  };
  const successHandledRef = useRef(false);

  // The one obvious, non-reading gesture. It must run inside the user gesture so
  // iOS Safari grants both the AudioContext (soundService.unlock) and the
  // microphone. We open the mic just to satisfy the permission prompt, then stop
  // it immediately — real listening starts only after the model has spoken.
  const unlock = useCallback(async (): Promise<void> => {
    if (dataRef.current.unlocked) {
      return;
    }
    const { settings: current, micStart, micStop } = dataRef.current;
    soundService.unlock();
    soundService.playTap(current);
    const outcome = await micStart();
    micStop();
    if (outcome.status === 'started') {
      dispatch({ type: 'unlock', micGranted: true });
    } else if (micOutcomeUsesFallback(outcome)) {
      dispatch({ type: 'unlock', micGranted: false });
    }
  }, []);

  // Tapping the alien: wakes it when locked; otherwise it is an optional,
  // non-blocking "I said it / grown-up help" shortcut (never required, never a
  // press-and-hold). Ignored while the alien is talking or celebrating.
  const handleAlienTap = useCallback((): void => {
    const { phase, settings: current, micStop } = dataRef.current;
    if (phase === 'locked') {
      void unlock();
      return;
    }
    if (phase === 'listening' || phase === 'nudge' || phase === 'parentFallback') {
      soundService.playTap(current);
      micStop();
      dispatch({ type: 'succeed' });
    }
  }, [unlock]);

  const handleRepeat = useCallback((): void => {
    const { round: current, settings: currentSettings, roundKey: rk } = dataRef.current;
    void speechService.speakSegments(
      [
        ...buildLocalizedSegments(
          [{ he: current.brokenHe, en: current.brokenEn, pauseAfterMs: 420 }],
          currentSettings.languageMode,
          currentSettings.englishVoiceLocale,
        ),
        ...buildPersonalizedPhraseSegments(SILLY_ALIEN_PROMPT, currentSettings),
      ],
      currentSettings,
      { scope: SPEECH_SCOPE, key: `repeat:${rk}`, priority: 'replay', interrupt: true },
    );
  }, []);

  // ── Page visibility ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    const onVisibility = (): void => {
      setPageVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // ── New word: reset per-round UI, stop capture, replay the gag once unlocked ─
  useEffect(() => {
    successHandledRef.current = false;
    setCelebration(null);
    setReplaying(false);
    dataRef.current.micStop();
    if (dataRef.current.unlocked) {
      dispatch({ type: 'begin-round' });
    }
  }, [roundKey]);

  // ── Presenting: comic gag + spoken model, mic strictly OFF ──────────────────
  useEffect(() => {
    if (state.phase !== 'presenting') {
      return undefined;
    }
    const { round: current, roundKey: rk, settings: current2, micStop } = dataRef.current;
    micStop();
    soundService.playPop(current2); // the first syllable escapes as a bubble
    let cancelled = false;
    const advance = (): void => {
      if (cancelled) {
        return;
      }
      cancelled = true;
      dispatch({ type: 'present-done' });
    };
    const speech = speechService.speakSegments(
      [
        ...buildLocalizedSegments(
          [{ he: current.brokenHe, en: current.brokenEn, pauseAfterMs: 420 }],
          current2.languageMode,
          current2.englishVoiceLocale,
        ),
        ...buildPersonalizedPhraseSegments(SILLY_ALIEN_PROMPT, current2),
      ],
      current2,
      { scope: SPEECH_SCOPE, key: `present:${rk}`, priority: 'prompt' },
    );
    void speech.then((result) => {
      if (settledShouldAdvance(result.status)) {
        advance();
      }
    });
    // Backstop so a stalled/blocked voice never freezes the round.
    const safety = window.setTimeout(advance, current2.reducedMotion ? 1600 : 4200);
    return () => {
      cancelled = true;
      window.clearTimeout(safety);
    };
  }, [state.phase, roundKey]);

  // ── Listening: open mic after the model, generous window, pause when hidden ─
  useEffect(() => {
    if (state.phase !== 'listening' || !pageVisible) {
      return undefined;
    }
    const { micStart, micStop } = dataRef.current;
    let cancelled = false;
    let listenTimer = 0;
    let retryTimer = 0;
    const startListening = async (): Promise<void> => {
      const outcome = await micStart();
      if (cancelled) {
        micStop();
        return;
      }
      if (outcome.status === 'started') {
        listenTimer = window.setTimeout(() => {
          micStop();
          dispatch({ type: 'listen-timeout' });
        }, SILLY_ALIEN_LISTEN_WINDOW_MS);
        return;
      }
      if (micOutcomeUsesFallback(outcome)) {
        dispatch({ type: 'mic-denied' });
        return;
      }
      if (outcome.status !== 'background') {
        retryTimer = window.setTimeout(
          () => void startListening(),
          DEFAULT_MICROPHONE_PLAYBACK_GUARD_MS,
        );
      }
    };
    void startListening();
    return () => {
      cancelled = true;
      window.clearTimeout(listenTimer);
      window.clearTimeout(retryTimer);
      micStop();
    };
  }, [state.phase, roundKey, pageVisible]);

  // ── Nudge: supportive replay (never framed as failure), then listen again ───
  useEffect(() => {
    if (state.phase !== 'nudge') {
      return undefined;
    }
    const { round: current, settings: current2, roundKey: rk, nudges, micStop } = dataRef.current;
    micStop();
    soundService.playRetry(current2);
    let cancelled = false;
    const advance = (): void => {
      if (cancelled) {
        return;
      }
      cancelled = true;
      dispatch({ type: 'nudge-done' });
    };
    const speech = speechService.speakSegments(
      buildLocalizedSegments(
        [
          { he: current.brokenHe, en: current.brokenEn, pauseAfterMs: 360 },
          SILLY_ALIEN_RETRY,
        ],
        current2.languageMode,
        current2.englishVoiceLocale,
      ),
      current2,
      { scope: SPEECH_SCOPE, key: `nudge:${rk}:${nudges}`, priority: 'retry', staleAfterSuccess: true },
    );
    void speech.then((result) => {
      if (settledShouldAdvance(result.status)) {
        advance();
      }
    });
    const safety = window.setTimeout(advance, current2.reducedMotion ? 1400 : 3400);
    return () => {
      cancelled = true;
      window.clearTimeout(safety);
    };
  }, [state.phase, roundKey, state.nudges]);

  // ── Success: snap the syllable home, model the full word, then celebrate ────
  useEffect(() => {
    if (state.phase !== 'success' || successHandledRef.current) {
      return undefined;
    }
    successHandledRef.current = true;
    const snapshot = dataRef.current;
    snapshot.micStop();
    soundService.playBoing(snapshot.settings); // spring snap-back
    soundService.playSuccess(snapshot.settings);
    setReplaying(true);

    const revealSpeech: Promise<SpeechResult> = speechService.speakSegments(
      buildPhraseSegments(
        snapshot.round.fullHe,
        snapshot.round.fullEn,
        snapshot.settings.languageMode,
        snapshot.settings.englishVoiceLocale,
      ),
      snapshot.settings,
      {
        scope: SPEECH_SCOPE,
        key: `reveal:${snapshot.roundKey}`,
        priority: 'label',
        staleAfterSuccess: true,
      },
    );

    const summary = snapshot.onCompleteRound({
      attempts: Math.max(1, snapshot.listenAttempts),
      requiredActions: 1,
      concepts: [snapshot.round.conceptId],
    });

    const revealMs = snapshot.settings.reducedMotion ? 650 : 1500;
    const timer = window.setTimeout(() => {
      setReplaying(false);
      setCelebration({
        seed: `silly-alien-${snapshot.roundKey}-${snapshot.round.signature}-${snapshot.listenAttempts}`,
        targetSegments: [],
        beforeSpeech: revealSpeech,
        tier: summary.milestone ? 'milestone' : 'standard',
        recommendation: summary.recommendation,
        celebrationVariant: 'trophy-spark',
      });
    }, revealMs);

    return () => window.clearTimeout(timer);
  }, [state.phase]);

  // ── Parent fallback: mic denied/unavailable only. Model the word, allow tap ─
  useEffect(() => {
    if (state.phase !== 'parentFallback') {
      return undefined;
    }
    const { round: current, settings: current2, roundKey: rk, micStop } = dataRef.current;
    micStop();
    void speechService.speakSegments(
      [
        ...buildLocalizedSegments(
          [{ he: current.brokenHe, en: current.brokenEn, pauseAfterMs: 380 }],
          current2.languageMode,
          current2.englishVoiceLocale,
        ),
        ...buildPersonalizedPhraseSegments(SILLY_ALIEN_PROMPT, current2),
      ],
      current2,
      { scope: SPEECH_SCOPE, key: `fallback:${rk}`, priority: 'prompt' },
    );
    return undefined;
  }, [state.phase, roundKey]);

  const isLocked = state.phase === 'locked';
  const isPresenting = state.phase === 'presenting';
  const isListening = state.phase === 'listening';
  const isNudge = state.phase === 'nudge';
  const isSuccess = state.phase === 'success';
  const isFallback = state.phase === 'parentFallback';

  const showFull = isSuccess || replaying;
  const mood: AlienMood = isSuccess
    ? 'happy'
    : isListening
      ? 'listening'
      : isLocked
        ? 'asleep'
        : 'confused';
  const bubbleWord = showFull ? round.fullHe : round.brokenHe;
  const bubbleWordEn = showFull ? round.fullEn : round.brokenEn;
  const progress = selectEffortProgress(state);
  const voiceActive = state.currentLevel >= SILLY_ALIEN_LEVEL_THRESHOLD;
  const syllableLoose = isPresenting || isListening || isNudge;

  const alienTapLabel = englishOnly
    ? isLocked
      ? 'Wake up the alien'
      : isFallback
        ? 'Grown-up: tap the alien to continue'
        : isListening || isNudge
          ? 'Tap if you already said it'
          : 'The alien is talking'
    : isLocked
      ? 'להעיר את החייזר'
      : isFallback
        ? 'מבוגר: הקישו על החייזר כדי להמשיך'
        : isListening || isNudge
          ? 'הקישו אם כבר אמרתם'
          : 'החייזר מדבר';

  const liveStatus = isLocked
    ? (englishOnly ? 'Tap the alien to wake it up' : 'הקישו על החייזר כדי להעיר אותו')
    : isSuccess
      ? (englishOnly ? `Yes! ${round.fullEn}` : `כן! ${round.fullHe}`)
      : isListening
        ? (englishOnly ? SILLY_ALIEN_LISTENING.en : SILLY_ALIEN_LISTENING.he)
        : isNudge
          ? (englishOnly ? SILLY_ALIEN_RETRY.en : SILLY_ALIEN_RETRY.he)
          : isFallback
            ? (englishOnly
              ? 'No microphone — a grown-up can tap the alien.'
              : 'אין מיקרופון — מבוגר יכול להקיש על החייזר.')
            : (englishOnly
              ? personalizeChildName(round.promptEn, settings.childName, 'en')
              : personalizeChildName(round.promptHe, settings.childName, 'he'));

  const surfaceStyle = {
    '--level': state.currentLevel,
    '--progress': progress,
  } as CSSProperties;

  return (
    <GameShell
      ariaLabel={gameMeta.sillyAlien.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.sillyAlien.accentClass}
      reducedMotion={settings.reducedMotion}
      onHome={onBack}
      onRepeat={handleRepeat}
      repeatDisabled={settings.quietMode || !speechStatus.supported || isLocked || !mediaReady}
      repeatSpeaking={speechStatus.speaking}
      replayLabel={englishOnly ? 'Hear it again' : 'לשמוע שוב'}
      homeLabel={englishOnly ? 'Back home' : 'חזרה לבית'}
      liveStatus={liveStatus}
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
      <div className="silly-alien-surface" data-phase={state.phase} style={surfaceStyle}>
        <div className="silly-alien-stage">
          <button
            type="button"
            className={`silly-alien-figure-tap silly-alien-figure-tap--${state.phase}`}
            onClick={handleAlienTap}
            aria-label={alienTapLabel}
          >
            <AlienFace
              level={state.currentLevel}
              mood={mood}
              replaying={replaying}
              chasing={isPresenting}
            />
            <span
              className={`silly-alien-syllable ${syllableLoose ? 'is-loose' : 'is-home'}`}
              lang={englishOnly ? 'en' : 'he'}
              aria-hidden="true"
            >
              {round.droppedLetterHe}
            </span>
            {isLocked ? (
              <span className="silly-alien-wake" aria-hidden="true">
                <span className="silly-alien-wake__ring" />
                <span className="silly-alien-wake__hand">👆</span>
              </span>
            ) : null}
          </button>

          <div className={`silly-alien-bubble ${showFull ? 'is-full' : ''}`} aria-hidden="true">
            {!showFull ? (
              <span className="silly-alien-bubble__ghost">{round.droppedLetterHe}</span>
            ) : null}
            <span className="silly-alien-bubble__word" lang={englishOnly ? 'en' : 'he'}>
              {englishOnly ? bubbleWordEn : bubbleWord}
            </span>
          </div>
        </div>

        <div className="silly-alien-object">
          <ConceptArt
            conceptId={round.conceptId}
            label={englishOnly ? round.fullEn : round.fullHe}
            className="silly-alien-object__art"
          />
        </div>

        <div className="silly-alien-controls">
          {isListening || isNudge ? (
            <div
              className={`silly-alien-reactor ${voiceActive ? 'is-hot' : ''} ${isNudge ? 'is-nudge' : ''}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label={englishOnly ? 'Voice effort' : 'עוצמת הקול'}
            >
              <span className="silly-alien-reactor__ring" />
              <span className="silly-alien-reactor__core" />
            </div>
          ) : null}

          {isFallback ? (
            <div className="silly-alien-fallback" role="group">
              <button
                type="button"
                className="silly-alien-fallback__button"
                onClick={handleAlienTap}
              >
                {englishOnly ? 'Help the alien' : 'עוזרים לחייזר'}
              </button>
              <p className="silly-alien-hint">
                {englishOnly
                  ? 'No microphone — a grown-up can tap.'
                  : 'אין מיקרופון — מבוגר יכול להקיש.'}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </GameShell>
  );
}
