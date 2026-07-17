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
  SILLY_ALIEN_INTRO,
  SILLY_ALIEN_LISTENING,
  SILLY_ALIEN_PROMPT,
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
} from './sillyAlienState';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';
import { personalizeChildName } from '../domain/childName';

const SPEECH_SCOPE = 'game:silly-alien';

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  const scope = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

function microphoneSupported(): boolean {
  return (
    typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function'
    && getAudioContextCtor() !== null
  );
}

interface MicEffortController {
  start: () => Promise<boolean>;
  stop: () => void;
  supported: boolean;
}

/**
 * Opens the microphone and reports a normalised vocal *effort* level every
 * animation frame via `onSample(level, deltaMs)`. It never transcribes speech —
 * it only measures loudness (RMS of the time-domain waveform), which is exactly
 * what we want for a toddler making a big "taaa-puach!" sound. All native
 * resources are torn down on `stop()` and on unmount.
 */
function useMicEffort(
  onSample: (level: number, deltaMs: number) => void,
): MicEffortController {
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastTimeRef = useRef(0);
  const supported = microphoneSupported();

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (contextRef.current) {
      void contextRef.current.close().catch(() => undefined);
      contextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    const Ctor = getAudioContextCtor();
    if (!supported || !Ctor) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const context = new Ctor();
      contextRef.current = context;
      if (context.state === 'suspended') {
        await context.resume().catch(() => undefined);
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserRef.current = analyser;

      const waveform = new Uint8Array(analyser.fftSize);
      lastTimeRef.current = performance.now();

      const loop = (): void => {
        const node = analyserRef.current;
        if (!node) {
          return;
        }
        node.getByteTimeDomainData(waveform);
        let sumSquares = 0;
        for (let i = 0; i < waveform.length; i += 1) {
          const centered = (waveform[i]! - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / waveform.length);
        // Toddler speech tends to sit around 0.05–0.35 RMS; lift it into a
        // friendlier 0..1 range so the visuals feel responsive.
        const level = Math.min(1, rms * 2.4);
        const now = performance.now();
        const deltaMs = now - lastTimeRef.current;
        lastTimeRef.current = now;
        onSampleRef.current(level, deltaMs);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return true;
    } catch {
      stop();
      return false;
    }
  }, [stop, supported]);

  useEffect(() => stop, [stop]);

  return { start, stop, supported };
}

interface AlienFaceProps {
  level: number;
  mood: 'idle' | 'listening' | 'happy';
  replaying: boolean;
}

function AlienFace({ level, mood, replaying }: AlienFaceProps) {
  const style = { '--level': level } as CSSProperties;
  return (
    <div
      className={`silly-alien-figure silly-alien-figure--${mood} ${replaying ? 'is-replaying' : ''}`}
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
  const [micDenied, setMicDenied] = useState(false);
  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'sillyAlien',
    domainProgress,
    generateSillyAlienRound,
    { getSignature: getSillyAlienRoundSignature, limit: 8 },
  );

  const englishOnly = settings.languageMode === 'en';
  const mic = useMicEffort((level, deltaMs) => {
    dispatch({ type: 'register-effort', level, deltaMs });
  });

  const speakPrompt = useCallback(async (interrupt = false): Promise<void> => {
    await speechService.speakSegments(
      [
        ...buildLocalizedSegments(
          [
          { ...SILLY_ALIEN_INTRO, pauseAfterMs: 240 },
          { he: round.brokenHe, en: round.brokenEn, pauseAfterMs: 360 },
          ],
          settings.languageMode,
          settings.englishVoiceLocale,
        ).map((segment) => ({ ...segment, recordedText: null })),
        ...buildPersonalizedPhraseSegments(SILLY_ALIEN_PROMPT, settings),
      ],
      settings,
      {
        scope: SPEECH_SCOPE,
        key: `prompt:${roundKey}`,
        priority: interrupt ? 'replay' : 'prompt',
        interrupt,
      },
    );
  }, [round.brokenEn, round.brokenHe, roundKey, settings]);
  const speakPromptRef = useRef(speakPrompt);
  speakPromptRef.current = speakPrompt;

  // Latest-values snapshot so the success effect can depend solely on `phase`
  // and still read fresh round/settings/callbacks without re-firing.
  const successDataRef = useRef({
    round,
    roundKey,
    settings,
    listenAttempts: state.listenAttempts,
    onCompleteRound,
    stop: mic.stop,
  });
  successDataRef.current = {
    round,
    roundKey,
    settings,
    listenAttempts: state.listenAttempts,
    onCompleteRound,
    stop: mic.stop,
  };
  const successHandledRef = useRef(false);

  const { stop: stopMic } = mic;
  useEffect(() => {
    successHandledRef.current = false;
    setCelebration(null);
    setReplaying(false);
    setMicDenied(false);
    stopMic();
    dispatch({ type: 'reset' });
    if (mediaReady) {
      void speakPromptRef.current();
    }
  }, [mediaReady, roundKey, stopMic]);

  useEffect(() => {
    if (state.phase !== 'success' || successHandledRef.current) {
      return undefined;
    }
    successHandledRef.current = true;
    const snapshot = successDataRef.current;
    snapshot.stop();
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

  const handleListen = useCallback((): void => {
    if (state.phase === 'success' || replaying) {
      return;
    }
    soundService.playTap(settings);
    dispatch({ type: 'begin-listening' });
    void mic.start().then((ok) => {
      setMicDenied(!ok);
    });
  }, [mic, replaying, settings, state.phase]);

  const handleAffirm = useCallback((): void => {
    if (state.phase === 'success' || replaying) {
      return;
    }
    soundService.playTap(settings);
    mic.stop();
    dispatch({ type: 'succeed' });
  }, [mic, replaying, settings, state.phase]);

  const isListening = state.phase === 'listening';
  const isSuccess = state.phase === 'success';
  const mood: AlienFaceProps['mood'] = isSuccess ? 'happy' : isListening ? 'listening' : 'idle';
  const bubbleWord = isSuccess || replaying ? round.fullHe : round.brokenHe;
  const bubbleWordEn = isSuccess || replaying ? round.fullEn : round.brokenEn;
  const progress = selectEffortProgress(state);
  const voiceActive = state.currentLevel >= SILLY_ALIEN_LEVEL_THRESHOLD;

  const liveStatus = isSuccess
    ? (englishOnly ? `Yes! ${round.fullEn}` : `כן! ${round.fullHe}`)
    : isListening
      ? (englishOnly ? SILLY_ALIEN_LISTENING.en : SILLY_ALIEN_LISTENING.he)
      : (
          englishOnly
            ? personalizeChildName(round.promptEn, settings.childName, 'en')
            : personalizeChildName(round.promptHe, settings.childName, 'he')
        );

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
      onRepeat={() => void speakPrompt(true)}
      repeatDisabled={settings.quietMode || !speechStatus.supported}
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
      <div className="silly-alien-surface" style={surfaceStyle}>
        <div className="silly-alien-stage">
          <AlienFace level={state.currentLevel} mood={mood} replaying={replaying} />
          <div
            className={`silly-alien-bubble ${isSuccess || replaying ? 'is-full' : ''}`}
            aria-hidden="true"
          >
            {!isSuccess && !replaying ? (
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
          {!isListening && !isSuccess ? (
            <button
              type="button"
              className="silly-alien-mic-button"
              onClick={handleListen}
            >
              <MicIcon />
              <span>{englishOnly ? 'Press and speak' : 'לוחצים ומדברים'}</span>
            </button>
          ) : null}

          {isListening ? (
            <div className="silly-alien-listening" role="group">
              <div
                className={`silly-alien-meter ${voiceActive ? 'is-hot' : ''}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                aria-label={englishOnly ? 'Voice effort' : 'עוצמת הקול'}
              >
                <span className="silly-alien-meter__fill" />
              </div>
              <p className="silly-alien-listening__label">
                {englishOnly ? SILLY_ALIEN_LISTENING.en : SILLY_ALIEN_LISTENING.he}
              </p>
              <button
                type="button"
                className="silly-alien-affirm"
                onClick={handleAffirm}
              >
                {englishOnly ? 'I said it!' : 'אמרתי!'}
              </button>
              {micDenied ? (
                <p className="silly-alien-hint">
                  {englishOnly
                    ? 'No microphone — tap the button when you say it.'
                    : 'אין מיקרופון — לוחצים על הכפתור אחרי שאומרים.'}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </GameShell>
  );
}

function MicIcon() {
  return (
    <svg
      className="silly-alien-mic-button__icon"
      viewBox="0 0 48 48"
      role="presentation"
      aria-hidden="true"
    >
      <rect x="18" y="6" width="12" height="24" rx="6" fill="currentColor" />
      <path
        d="M12 22a12 12 0 0 0 24 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line x1="24" y1="34" x2="24" y2="42" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <line x1="16" y1="42" x2="32" y2="42" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
