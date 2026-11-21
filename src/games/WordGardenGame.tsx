import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as CardPointer } from 'react';
import { GameShell } from '../components/GameShell';
import { gameMeta } from '../content/games';
import {
  GARDEN_DEFAULT_AVATAR, GARDEN_NEXT_SENTENCE, GARDEN_SENTENCE_QUESTION,
  makeGardenVisit, getGardenVoiceKey, type GardenSentence,
} from '../content/gardenSentences';
import { gardenSegments, type GardenLine } from '../content/wordGarden';
import { readAppLifecycleState, subscribeAppLifecycle } from '../platform/useAppLifecycle';
import { soundService } from '../services/sound';
import type { SpeechSegment } from '../services/speech';
import { recordedSpeechPlayer } from '../services/recordedSpeech';
import { playGardenVoice } from '../services/gardenVoiceMedia';
import { readGardenVoice } from '../services/gardenVoiceStorage';
import type { ToddlerGameProps } from './types';
import { useGardenAvatar } from './useGardenAvatar';
import { GardenActionScene } from './GardenActionScene';
import { GardenDrawing } from './GardenStoryScene';
import './wordGardenGame.css';

export const GARDEN_RESPONSE_PAUSE_MS = 1_300;
export const GARDEN_CLIP_TIMEOUT_MS = 5_000;
const TRAVEL_MS = 2_400;
const STATION_DWELL_MS = 950;
const SHOW_ACTION_MS = 2_300;
let previousFirstStory: string | undefined;
const PARTS = ['actor', 'action', 'object'] as const;
type Part = 0 | 1 | 2 | 3;

type SeanArtProps = {
  url: string | null;
  english: boolean;
  onLoad: (url: string) => void;
  onError: (url: string) => void;
};

function SeanArt({ url, english, onLoad, onError }: SeanArtProps) {
  if (url) return <img key={url} className="sentence-train__avatar" src={url} alt="" draggable={false}
    onLoad={() => onLoad(url)} onError={() => onError(url)} />;
  return (
    <svg className="sentence-train__badge" viewBox="0 0 120 104" aria-hidden="true">
      <path d="M12 19h96a5 5 0 0 1 5 5v10a10 10 0 0 0 0 20v10a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V54a10 10 0 0 0 0-20V24a5 5 0 0 1 5-5Z"
        fill="#155649" stroke="#203d35" strokeWidth="3" />
      <path d="M21 25v38m78-38v38" stroke="#f4d296" strokeWidth="2" strokeDasharray="3 4" />
      <text x="60" y="46" dominantBaseline="central" textAnchor="middle" fill="#fff6d8" fontSize="39" fontWeight="900">
        {english ? 'S' : 'ש'}
      </text>
      <path d="M20 88h80M27 94h66" stroke="#936940" strokeWidth="3" strokeLinecap="round" />
      {[33, 87].map((x) => <circle key={x} cx={x} cy="77" r="8" fill="#203d35" stroke="#f4d296" strokeWidth="2" />)}
    </svg>
  );
}

function Picture({ sentence, index, art, acted }: {
  sentence: GardenSentence; index: number; art: SeanArtProps; acted: boolean;
}) {
  if (index === 0 && sentence.isSean) return <div className="sentence-train__picture"><SeanArt {...art} /></div>;
  if (index !== 1) {
    const src = index === 0 ? sentence.art.subject! : sentence.art.object;
    return <div className="sentence-train__picture">
      {src.startsWith('#') ? <svg viewBox="0 0 100 100" aria-hidden="true"><GardenDrawing src={src} /></svg>
        : <img src={src} alt="" draggable={false} />}
    </div>;
  }
  return <GardenActionScene sentence={sentence} acted={acted} original={art.url === GARDEN_DEFAULT_AVATAR} actor={<SeanArt {...art} />} />;
}

function TrainArt() {
  return (
    <svg viewBox="0 0 180 65" aria-hidden="true">
      <path d="M48 54h12m37 0h15" stroke="#24463e" strokeWidth="4" />
      {[4, 56].map((x) => <g key={x} transform={`translate(${x} 0)`}>
        <rect y="28" width="46" height="25" rx="5" fill="#c47b3e" stroke="#744820" strokeWidth="1.5" />
        <path d="M2 31h42M5 46h36" stroke="#f4d296" strokeWidth="3" />
        <path d="M13 34v9m10-9v9m10-9v9" stroke="#98592d" strokeWidth="2" />
      </g>)}
      <path d="M108 50V33h5V11h26v17h26a11 11 0 0 1 11 11v12Z" fill="#206454" stroke="#203d35" strokeWidth="2" />
      <path d="M109 12V8q15-7 33 0v4Z" fill="#943f32" stroke="#633a2d" strokeWidth="1.5" />
      <path d="M157 28V17l-2-3v-3h12v3l-2 3v11" fill="#274b41" />
      <rect x="117" y="16" width="17" height="15" rx="3" fill="#e2eedb" stroke="#c3a362" strokeWidth="2" />
      <path d="M145 30v15m7-15v15M109 49h65" stroke="#e8be79" strokeWidth="2" />
      <path d="m171 48 8 8h-11" fill="#90553b" />
      {[15, 39, 67, 91, 119, 139, 162].map((x) => <g key={x}>
        <circle cx={x} cy="55" r={x > 100 ? 8 : 6.5} fill="#293e37" stroke="#ead3a1" strokeWidth="2" />
        <circle cx={x} cy="55" r="2.3" fill="#c49159" />
      </g>)}
      <path d="M119 55h20l23-1" stroke="#bd945f" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function quietTurn(signal: AbortSignal, delay = GARDEN_RESPONSE_PAUSE_MS): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener('abort', finish, { once: true });
  });
}

function playNarrator(segment: SpeechSegment, volume: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let active = true;
    const finish = () => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
      resolve();
    };
    const stop = () => {
      recordedSpeechPlayer.cancel();
      finish();
    };
    const timer = setTimeout(stop, GARDEN_CLIP_TIMEOUT_MS);
    signal.addEventListener('abort', stop, { once: true });
    void recordedSpeechPlayer.play({ text: segment.text, locale: segment.locale, volume, onStart: () => undefined })
      .then(finish, finish);
  });
}

export function WordGardenGame({ settings, mediaReady, onBack, onCompleteRound }: ToddlerGameProps) {
  const [visit] = useState(() => makeGardenVisit(previousFirstStory));
  useEffect(() => { previousFirstStory = visit[0]!.story; }, [visit]);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const sentence = visit[sentenceIndex]!;
  const [actionTake, setActionTake] = useState(0);
  const [part, setPart] = useState<Part>(0);
  const [journey, setJourney] = useState<'waiting' | 'travel' | 'station'>('waiting');
  const trainReady = journey !== 'waiting';
  const departed = useRef(false);
  const [foreground, setForeground] = useState(() => readAppLifecycleState() === 'foreground');
  const visible = useRef(foreground);
  const [replaying, setReplaying] = useState(false);
  const [phase, setPhase] = useState<'question' | 'your-turn' | 'model'>('question');
  const english = settings.languageMode === 'en';
  const selectedAvatar = useGardenAvatar(settings.gardenAvatarPhotoId);
  const [unreadableOverride, setUnreadableOverride] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const override = selectedAvatar === unreadableOverride ? null : selectedAvatar;
  const avatar = override ?? (defaultStatus === 'failed' ? null : GARDEN_DEFAULT_AVATAR);
  const actorCue = !sentence.isSean || override || defaultStatus === 'ready' ? 'picture' : defaultStatus === 'failed' ? 'card' : 'loading';
  const art: SeanArtProps = {
    url: avatar,
    english,
    onLoad: (url) => { if (url === GARDEN_DEFAULT_AVATAR) setDefaultStatus('ready'); },
    onError: (url) => {
      if (url === GARDEN_DEFAULT_AVATAR) setDefaultStatus('failed');
      else setUnreadableOverride(url);
    },
  };
  const voiceEnabled = mediaReady && !settings.quietMode && settings.soundLevel > 0;
  const { words, model } = sentence;
  const localized = (line: GardenLine) => english ? line.en : line.he;
  const prompts = [
    actorCue !== 'card' ? localized(sentence.questions[0]) : english ? 'Tap Sean’s card' : 'נוגעים בקלף של שון',
    localized(sentence.questions[1]),
    localized(sentence.questions[2]),
  ];
  const step = useRef<Part>(0);
  const run = useRef<AbortController | null>(null);
  const modeled = useRef<Part | null>(null);
  const activeCard = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const focusOnChange = useRef(false);
  const pendingWord = useRef<0 | 1 | 2 | null>(null);
  const contact = useRef<{ id: number; x: number; y: number; cancelled: boolean } | null>(null);
  const [pressed, setPressed] = useState(false);
  const stopTrainSound = useRef<(() => void) | undefined>(undefined);

  const cancel = useCallback(() => {
    run.current?.abort();
    run.current = null;
    stopTrainSound.current?.();
    stopTrainSound.current = undefined;
  }, []);

  const speakTurn = useCallback((index: Part, replay = false) => {
    cancel();
    if (!visible.current) return;
    setReplaying(replay && departed.current && voiceEnabled);
    const depart = () => {
      if (departed.current) return;
      departed.current = true;
      if (voiceEnabled) stopTrainSound.current = soundService.playGardenTrain(settings);
      setJourney('travel');
    };
    if (!voiceEnabled) {
      if (index === 3) depart();
      return;
    }
    if (index === 3 && departed.current && !replay) return;
    if (index === 0 && actorCue === 'loading') return;
    const controller = new AbortController();
    run.current = controller;
    const { signal } = controller;
    const { words: currentWords, model: currentModel } = sentence;
    const speak = async (value: GardenLine, role: 'question' | 'word' | 'model' | 'next') => {
      if (signal.aborted) return;
      const segments = gardenSegments(value, settings.languageMode, settings.englishVoiceLocale);
      for (const segment of segments) {
        if (signal.aborted) return;
        if (role === 'model') {
          const language = segment.locale === 'he-IL' ? 'he' : 'en';
          const clip = await readGardenVoice(getGardenVoiceKey(sentence, language), signal).catch(() => null);
          if (signal.aborted) return;
          if (!clip || !await playGardenVoice(clip, settings.soundLevel, signal).catch(() => false)) {
            await playNarrator(segment, settings.soundLevel, signal);
          }
        } else {
          await playNarrator(segment, settings.soundLevel, signal);
        }
        if (segment.pauseAfterMs) await quietTurn(signal, segment.pauseAfterMs);
      }
    };
    const previousWord = pendingWord.current;
    pendingWord.current = null;
    setPhase('question');
    const question = index === 3 ? GARDEN_SENTENCE_QUESTION : sentence.questions[index];
    void (async () => {
      if (previousWord !== null) await speak(currentWords[previousWord], 'word');
      if (signal.aborted) return;
      if (!(index === 0 && actorCue === 'card') && !(replay && index === 3 && departed.current)) {
        await speak(question, 'question');
        if (signal.aborted) return;
        setPhase('your-turn');
        await quietTurn(signal);
        if (signal.aborted) return;
      }
      setPhase('model');
      if (index === 3) {
        await speak(currentModel, 'model');
        if (!signal.aborted) {
          if (departed.current) setReplaying(false);
          else {
            depart();
            await quietTurn(signal, 550);
            await speak(GARDEN_NEXT_SENTENCE, 'next');
          }
        }
      } else {
        await speak(currentWords[index], 'word');
        if (!signal.aborted) modeled.current = index;
      }
    })();
  }, [actorCue, cancel, sentence, settings, voiceEnabled]);

  const latestTurn = useRef(speakTurn);
  latestTurn.current = speakTurn;
  useEffect(() => {
    const unsubscribe = subscribeAppLifecycle((state) => {
      visible.current = state === 'foreground';
      setForeground(visible.current);
      if (!visible.current) {
        cancel();
        setReplaying(false);
        contact.current = null;
        setPressed(false);
      }
      else if (!departed.current) latestTurn.current(step.current);
    });
    return () => { unsubscribe(); cancel(); };
  }, [cancel]);
  const activeActorCue = part === 0 ? actorCue : null;
  useEffect(() => {
    if (!actionTake || !foreground) return;
    const timer = setTimeout(() => setActionTake(0), SHOW_ACTION_MS);
    return () => clearTimeout(timer);
  }, [actionTake, foreground]);
  useEffect(() => {
    latestTurn.current(part);
    if (focusOnChange.current && part < 3) {
      activeCard.current?.focus();
      focusOnChange.current = false;
    }
  }, [part, sentenceIndex, voiceEnabled, activeActorCue]);
  useEffect(() => {
    if (trainReady && focusOnChange.current) {
      nextButton.current?.focus();
      focusOnChange.current = false;
    }
  }, [trainReady]);

  const tap = (index: 0 | 1 | 2, keyboard: boolean) => {
    if (!visible.current || step.current !== index) return;
    cancel();
    soundService.playTap(settings);
    focusOnChange.current = keyboard;
    pendingWord.current = modeled.current === index ? null : index;
    setActionTake(take => index === 1 ? take + 1 : 0);
    step.current = (index + 1) as Part;
    setPart(step.current);
    if (index === 2) {
      onCompleteRound({ attempts: 3, requiredActions: 3, concepts: [`garden-${sentence.id}`] });
    }
  };
  const touchStart = (event: CardPointer<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') return;
    if (!event.isPrimary) {
      if (contact.current) contact.current.cancelled = true;
      setPressed(false);
      return;
    }
    contact.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cancelled: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressed(true);
  };
  const checkSlip = (event: CardPointer<HTMLButtonElement>) => {
    const start = contact.current;
    if (!start || start.id !== event.pointerId) return null;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 24) {
      start.cancelled = true;
      setPressed(false);
    }
    return start;
  };
  const clearPress = () => { contact.current = null; setPressed(false); };
  const next = (keyboard: boolean, automatic = false) => {
    if (!visible.current || !departed.current || step.current !== 3) return;
    departed.current = false;
    cancel();
    if (!automatic) soundService.playTap(settings);
    step.current = 0;
    modeled.current = null;
    focusOnChange.current = keyboard;
    setReplaying(false);
    setJourney('waiting');
    setPart(0);
    setSentenceIndex((current) => (current + 1) % visit.length);
  };
  const autoNext = useRef(() => {});
  autoNext.current = () => next(document.activeElement === nextButton.current, true);
  const remaining = useRef({ travel: TRAVEL_MS, station: STATION_DWELL_MS });
  useEffect(() => {
    if (journey === 'waiting') {
      remaining.current = { travel: TRAVEL_MS, station: STATION_DWELL_MS };
      return;
    }
    if (!foreground || replaying) return;
    const budget = remaining.current;
    const start = performance.now();
    const timer = setTimeout(() => {
      if (!visible.current || !departed.current) return;
      if (journey === 'travel') setJourney('station');
      else autoNext.current();
    }, budget[journey]);
    return () => {
      clearTimeout(timer);
      budget[journey] = Math.max(0, budget[journey] - (performance.now() - start));
    };
  }, [journey, foreground, replaying]);
  const heading = part === 3 ? localized(model) : prompts[part]!;

  return (
    <GameShell
      ariaLabel={english ? 'Word Garden' : gameMeta.wordGarden.title}
      accentClass={gameMeta.wordGarden.accentClass}
      reducedMotion={settings.reducedMotion}
      languageMode={settings.languageMode}
      onHome={() => { visible.current = false; cancel(); onBack(); }}
      onRepeat={() => {
        if (part === 1 || part === 2) setActionTake(take => take + 1);
        speakTurn(part, true);
      }}
      homeLabel={english ? 'Back home' : 'חזרה לבית'}
      replayLabel={english ? 'Hear this part again' : 'השמיעו שוב'}
      liveStatus={heading}
    >
      <div className="sentence-train" data-story={sentence.story} data-sentence={sentence.id} data-part={part} data-phase={phase} data-departed={trainReady}
        data-journey={journey} data-paused={!foreground || replaying} style={{ '--travel-time': `${TRAVEL_MS}ms` } as CSSProperties}>
        <h1 className="sentence-train__prompt">{heading}</h1>
        <div className="sentence-train__play">
        {actionTake !== 0 && <div key={actionTake} className="sentence-train__theater" aria-hidden="true">
          <Picture sentence={sentence} index={1} art={art} acted />
        </div>}
        <div className="sentence-train__cards">
          {PARTS.map((name, i) => {
            const index = i as 0 | 1 | 2;
            if (index > part) return <div key={name} className="sentence-train__card is-empty" aria-hidden="true"><span /></div>;
            const word = localized(words[index]);
            const picture = <Picture sentence={sentence} index={index} art={art} acted={part > index} />;
            return index === part ? (
              <button
                key={name} type="button" className="sentence-train__card is-target" data-garden-part={name}
                aria-label={index === 0 && sentence.isSean ? (english ? 'Sean’s card' : 'הקלף של שון') : undefined}
                ref={activeCard} data-pressed={pressed} onPointerDown={touchStart} onPointerMove={checkSlip}
                onPointerUp={(event) => {
                  const start = checkSlip(event);
                  if (!start) return;
                  clearPress();
                  if (!start.cancelled) tap(index, false);
                }}
                onPointerCancel={clearPress} onLostPointerCapture={clearPress}
                onContextMenu={(event) => event.preventDefault()}
                onClick={(event) => {
                  const pointer = (event.nativeEvent as PointerEvent).pointerType;
                  if (event.detail === 0 || (pointer !== 'touch' && pointer !== 'pen')) tap(index, event.detail === 0);
                }}
              >
                <span className="sentence-train__face">{picture}<span className="sentence-train__word">{word}</span></span>
                <span className="sentence-train__pointer" aria-hidden="true">↑</span>
              </button>
            ) : (
              <div key={name} className="sentence-train__card" data-garden-part={name}>
                {picture}<span className="sentence-train__word">{word}</span>
              </div>
            );
          })}
        </div>
        </div>
        <div className="sentence-train__track" aria-hidden="true">
          <img className="sentence-train__station" src="/assets/garden/station.webp" alt="" draggable={false} />
          <div key={sentence.id} className="sentence-train__rail-run"><div className="sentence-train__engine"><TrainArt /></div></div>
        </div>
        <div className="sentence-train__footer">
          {trainReady
            ? <button className="sentence-train__next" ref={nextButton} type="button" onClick={(event) => next(event.detail === 0)}>
                <span aria-hidden="true">{english ? '→' : '←'}</span> {localized(GARDEN_NEXT_SENTENCE)}
              </button>
            : <span>{phase === 'your-turn'
              ? (english ? 'Your turn, if you want' : 'תורכם, אם תרצו')
              : part < 3 ? (english ? 'Tap to continue' : 'נגיעה כדי להמשיך') : null}</span>}
        </div>
      </div>
    </GameShell>
  );
}
