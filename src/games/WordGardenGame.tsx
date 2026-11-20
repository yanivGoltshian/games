import { useCallback, useEffect, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { CaregiverGate } from '../components/CaregiverGate';
import { gameMeta } from '../content/games';
import {
  GARDEN_NEXT_SENTENCE, GARDEN_PART_QUESTIONS, GARDEN_SENTENCE_QUESTION, GARDEN_SENTENCES,
  getGardenSentenceLines, getGardenVoiceKey, type GardenSentence,
} from '../content/gardenSentences';
import { gardenSegments, type GardenLine } from '../content/wordGarden';
import { subscribeAppLifecycle } from '../platform/useAppLifecycle';
import { soundService } from '../services/sound';
import type { SpeechSegment } from '../services/speech';
import { recordedSpeechPlayer } from '../services/recordedSpeech';
import { playGardenVoice } from '../services/gardenVoiceMedia';
import { readGardenVoice } from '../services/gardenVoiceStorage';
import type { ToddlerGameProps } from './types';
import { useGardenAvatar } from './useGardenAvatar';
import './wordGardenGame.css';

export const GARDEN_RESPONSE_PAUSE_MS = 1_300;
export const GARDEN_CLIP_TIMEOUT_MS = 5_000;
const PARTS = ['actor', 'action', 'object'] as const;
type Part = 0 | 1 | 2 | 3;

function SeanArt({ url, onError }: { url: string; onError: () => void }) {
  return <img className="sentence-train__avatar" src={url} alt="" draggable={false} onError={onError} />;
}

function GardenerArt() {
  return (
    <svg viewBox="0 0 120 124" aria-hidden="true">
      <path d="M21 123V99q0-29 39-29t39 29v24Z" fill="#63704a" />
      <circle cx="60" cy="56" r="34" fill="#be845f" />
      <path d="M32 43 39 15q21-13 42 0l7 28Z" fill="#8a9868" />
      <ellipse cx="60" cy="43" rx="50" ry="9" fill="#a2af78" />
      <circle cx="48" cy="59" r="3" fill="#382620" /><circle cx="73" cy="59" r="3" fill="#382620" />
      <path d="M50 72q10 10 20 0" fill="none" stroke="#713f2c" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Picture({ sentence, index, avatar, onAvatarError, acted }: {
  sentence: GardenSentence; index: number; avatar: string; onAvatarError: () => void; acted: boolean;
}) {
  if (index === 0) return <div className="sentence-train__picture"><SeanArt url={avatar} onError={onAvatarError} /></div>;
  if (index === 2) {
    return <div className="sentence-train__picture"><img src={sentence.image} alt="" draggable={false} /></div>;
  }
  const { motion } = sentence;
  return (
    <div className={`sentence-train__picture sentence-train__action is-${motion}`} data-acted={acted}>
      <div className="sentence-train__actor"><SeanArt url={avatar} onError={onAvatarError} /></div>
      {motion === 'handoff' && <div className="sentence-train__recipient"><GardenerArt /></div>}
      {sentence.setting && (motion !== 'grow' || !acted) && <img className="sentence-train__setting" src={sentence.setting} alt="" draggable={false} />}
      {motion === 'bury'
        ? <span className="sentence-train__pit" aria-hidden="true" />
        : (motion !== 'grow' || acted) && <img className="sentence-train__moving-object" src={acted && sentence.aftermath ? sentence.aftermath : sentence.image} alt="" draggable={false} />}
      {motion === 'water' && acted && <span className="sentence-train__drops" aria-hidden="true"><i /><i /><i /></span>}
    </div>
  );
}

function TrainArt() {
  return (
    <svg viewBox="0 0 180 65" aria-hidden="true">
      <path d="M48 54h12m37 0h15" stroke="#24463e" strokeWidth="4" />
      <rect x="4" y="29" width="47" height="27" rx="6" fill="#c47b3e" />
      <rect x="56" y="29" width="47" height="27" rx="6" fill="#c47b3e" />
      <path d="M107 53V35h16V11a6 6 0 0 1 6-6h23a6 6 0 0 1 6 6v28h6V22h9v17h4v14Z" fill="#155649" />
      <rect x="130" y="12" width="20" height="13" rx="3" fill="#e1efe2" />
      <path d="M11 41h33m19 0h33m22 5h51" stroke="#f4d296" strokeWidth="3" strokeLinecap="round" />
      {[16, 40, 67, 92, 123, 153, 169].map((x) => <circle key={x} cx={x} cy="57" r="6" fill="#263e35" />)}
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

export function WordGardenGame(props: ToddlerGameProps & { onSetupAvatar: () => void }) {
  const [unreadableAvatar, setUnreadableAvatar] = useState<string | null>(null);
  const selectedAvatar = useGardenAvatar(props.settings.gardenAvatarPhotoId);
  if (selectedAvatar && selectedAvatar !== unreadableAvatar) {
    return <SentenceBoard {...props} avatar={selectedAvatar} onAvatarError={() => setUnreadableAvatar(selectedAvatar)} />;
  }
  const { settings, onBack, onSetupAvatar } = props;
  const english = settings.languageMode === 'en';
  const title = english ? 'Sean’s picture' : 'האיור של שון';
  return (
    <GameShell ariaLabel={english ? 'Word Garden' : gameMeta.wordGarden.title}
      accentClass={gameMeta.wordGarden.accentClass} reducedMotion={settings.reducedMotion}
      languageMode={settings.languageMode} onHome={onBack} homeLabel={english ? 'Back home' : 'חזרה לבית'}
      liveStatus={title}>
      <div className="sentence-train sentence-train--setup">
        <h1 className="sentence-train__prompt">{title}</h1>
        <p>{english ? 'Grown-ups: hold the gear to choose Sean’s original picture.' : 'להורים: לחצו לחיצה ארוכה על גלגל השיניים כדי לבחור את האיור המקורי של שון.'}</p>
        <CaregiverGate onUnlock={onSetupAvatar} inline english={english} />
      </div>
    </GameShell>
  );
}

function SentenceBoard({ settings, mediaReady, onBack, onCompleteRound, avatar, onAvatarError }:
  ToddlerGameProps & { avatar: string; onAvatarError: () => void }) {
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [part, setPart] = useState<Part>(0);
  const [trainReady, setTrainReady] = useState(false);
  const [phase, setPhase] = useState<'question' | 'your-turn' | 'model'>('question');
  const english = settings.languageMode === 'en';
  const voiceEnabled = mediaReady && !settings.quietMode && settings.soundLevel > 0;
  const sentence = GARDEN_SENTENCES[sentenceIndex]!;
  const { words, model } = getGardenSentenceLines(sentence);
  const localized = (line: GardenLine) => english ? line.en : line.he;
  const prompts = [
    english ? 'Tap Sean' : 'געו בשון',
    localized(GARDEN_PART_QUESTIONS[1]),
    localized(sentence.objectQuestion),
  ];
  const step = useRef<Part>(0);
  const run = useRef<AbortController | null>(null);
  const modeled = useRef<Part | null>(null);
  const activeCard = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const focusOnChange = useRef(false);
  const pendingWord = useRef<0 | 1 | 2 | null>(null);

  const cancel = useCallback(() => {
    run.current?.abort();
    run.current = null;
  }, []);

  const speakTurn = useCallback((index: Part, replay = false) => {
    cancel();
    if (!voiceEnabled) {
      if (index === 3) setTrainReady(true);
      return;
    }
    const controller = new AbortController();
    run.current = controller;
    const { signal } = controller;
    const { words: currentWords, model: currentModel } = getGardenSentenceLines(sentence);
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
    const question = index === 3 ? GARDEN_SENTENCE_QUESTION : index === 2 ? sentence.objectQuestion : GARDEN_PART_QUESTIONS[index];
    void (async () => {
      if (previousWord !== null) await speak(currentWords[previousWord], 'word');
      if (signal.aborted) return;
      if (!(replay && index === 3 && trainReady)) {
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
          setTrainReady(true);
          if (!replay) await speak(GARDEN_NEXT_SENTENCE, 'next');
        }
      } else {
        await speak(currentWords[index], 'word');
        if (!signal.aborted) modeled.current = index;
      }
    })();
  }, [cancel, sentence, settings, trainReady, voiceEnabled]);

  const latestTurn = useRef(speakTurn);
  latestTurn.current = speakTurn;
  const payoffReady = useRef(trainReady);
  payoffReady.current = trainReady;
  useEffect(() => {
    const unsubscribe = subscribeAppLifecycle((state) => {
      if (state === 'background') cancel();
      else if (!payoffReady.current) latestTurn.current(step.current);
    });
    return () => { unsubscribe(); cancel(); };
  }, [cancel]);
  useEffect(() => {
    latestTurn.current(part);
    if (focusOnChange.current && part < 3) {
      activeCard.current?.focus();
      focusOnChange.current = false;
    }
  }, [part, sentenceIndex, voiceEnabled]);
  useEffect(() => {
    if (trainReady && focusOnChange.current) {
      nextButton.current?.focus();
      focusOnChange.current = false;
    }
  }, [trainReady]);

  const tap = (index: 0 | 1 | 2, keyboard: boolean) => {
    if (step.current !== index) return;
    cancel();
    soundService.playTap(settings);
    focusOnChange.current = keyboard;
    pendingWord.current = modeled.current === index ? null : index;
    step.current = (index + 1) as Part;
    setPart(step.current);
    if (index === 2) {
      onCompleteRound({ attempts: 3, requiredActions: 3, concepts: [`garden-${sentence.id}`] });
    }
  };
  const next = (keyboard: boolean) => {
    if (!trainReady || step.current !== 3) return;
    cancel();
    soundService.playTap(settings);
    step.current = 0;
    modeled.current = null;
    focusOnChange.current = keyboard;
    setTrainReady(false);
    setPart(0);
    setSentenceIndex((current) => (current + 1) % GARDEN_SENTENCES.length);
  };
  const heading = part === 3 ? localized(model) : prompts[part]!;

  return (
    <GameShell
      ariaLabel={english ? 'Word Garden' : gameMeta.wordGarden.title}
      accentClass={gameMeta.wordGarden.accentClass}
      reducedMotion={settings.reducedMotion}
      languageMode={settings.languageMode}
      onHome={onBack}
      onRepeat={() => speakTurn(part, true)}
      homeLabel={english ? 'Back home' : 'חזרה לבית'}
      replayLabel={english ? 'Hear this part again' : 'השמיעו שוב'}
      liveStatus={heading}
    >
      <div className="sentence-train" data-sentence={sentence.id} data-part={part} data-phase={phase} data-departed={trainReady}>
        <h1 className="sentence-train__prompt">{heading}</h1>
        <div className="sentence-train__cards">
          {PARTS.map((name, i) => {
            const index = i as 0 | 1 | 2;
            if (index > part) return <div key={name} className="sentence-train__card is-empty" aria-hidden="true"><span /></div>;
            const word = localized(words[index]);
            const picture = <Picture sentence={sentence} index={index} avatar={avatar}
              onAvatarError={onAvatarError} acted={part > index} />;
            return index === part ? (
              <button
                key={name} type="button" className="sentence-train__card is-target" data-garden-part={name}
                ref={activeCard} onClick={(event) => tap(index, event.detail === 0)}
              >
                {picture}<span className="sentence-train__word">{word}</span>
                <span className="sentence-train__pointer" aria-hidden="true">↑</span>
              </button>
            ) : (
              <div key={name} className="sentence-train__card" data-garden-part={name}>
                {picture}<span className="sentence-train__word">{word}</span>
              </div>
            );
          })}
        </div>
        <div className="sentence-train__track" aria-hidden="true">
          <div className="sentence-train__engine"><TrainArt /></div>
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
