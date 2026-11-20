import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { GameShell } from '../components/GameShell';
import { gameMeta } from '../content/games';
import {
  GARDEN_ASK,
  GARDEN_BANANA_SENTENCE,
  GARDEN_BANANA_WORDS,
  GARDEN_FRUITS,
  GARDEN_INVITATION,
  GARDEN_PERSIMMON_WORD,
  GARDEN_STAGES,
  createGardenRound,
  gardenPhrase,
  gardenSegments,
  type GardenLine,
} from '../content/wordGarden';
import { subscribeAppLifecycle } from '../platform/useAppLifecycle';
import { createInteractionMediaUnits, interactionMediaCoordinator } from '../services/interactionMediaCoordinator';
import { soundService } from '../services/sound';
import type { ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';

const ART = {
  persimmon: '/assets/garden/persimmon.webp',
  token: '/assets/garden/token.webp',
  watering: '/assets/garden/watering-can.webp',
} as const;

const JOURNEY = [
  { id: 'ask', image: ART.persimmon, destination: 'child', line: GARDEN_STAGES[1].line, expanded: GARDEN_STAGES[1].expanded },
  { id: 'exchange', image: ART.token, destination: 'gardener', line: GARDEN_STAGES[3].line, expanded: GARDEN_STAGES[3].expanded },
  { id: 'seed', image: ART.persimmon, destination: 'soil', line: GARDEN_STAGES[12].line, expanded: GARDEN_STAGES[12].expanded },
  { id: 'cover', image: 'seed', destination: 'soil', line: GARDEN_STAGES[14].line, expanded: GARDEN_STAGES[14].expanded },
  { id: 'water', image: ART.watering, destination: 'soil', line: GARDEN_STAGES[15].line, expanded: GARDEN_STAGES[15].expanded },
  { id: 'sprout', image: 'sprout', destination: 'soil', line: GARDEN_STAGES[17].line, expanded: GARDEN_STAGES[17].expanded },
  { id: 'tree', image: 'tree', destination: 'soil', line: GARDEN_STAGES[18].line, expanded: GARDEN_STAGES[18].expanded },
  { id: 'fruit', image: ART.persimmon, destination: 'tree', line: GARDEN_STAGES[20].line, expanded: GARDEN_STAGES[20].expanded },
] as const;

const RESPONSE_PAUSE_MS = 1_100;
const FALLBACK_MS = 6_000;

function ChildArt() {
  return (
    <svg viewBox="0 0 170 220" role="presentation" aria-hidden="true">
      <ellipse cx="88" cy="210" rx="60" ry="8" fill="#627c55" opacity=".22" />
      <path d="M56 158l-10 48h30l12-38 12 38h30l-11-48" fill="#506a70" />
      <path d="M46 111q39-27 79 0l11 67H35z" fill="#f3cf86" stroke="#997256" strokeWidth="3" />
      <path d="M45 124q-22 21-12 40m90-40q23 3 35-12" stroke="#b37c60" strokeWidth="13" fill="none" strokeLinecap="round" />
      <circle cx="153" cy="109" r="10" fill="#b37c60" />
      <rect x="76" y="95" width="21" height="23" rx="8" fill="#ae765b" />
      <circle cx="85" cy="66" r="42" fill="#c28c6b" />
      <path d="M44 69q-19-24 0-40 0-24 25-21 17-17 33-1 27-9 30 18 18 12 0 31-4-20-18-20-24 15-51 8-7 12-19 25" fill="#47362f" />
      <circle cx="69" cy="67" r="3" fill="#332b29" /><circle cx="99" cy="67" r="3" fill="#332b29" />
      <path d="M71 83q13 13 27 0" fill="none" stroke="#704439" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function GardenerArt() {
  return (
    <svg viewBox="0 0 170 220" role="presentation" aria-hidden="true">
      <ellipse cx="85" cy="210" rx="66" ry="8" fill="#627c55" opacity=".22" />
      <path d="M49 159l-10 48h34l13-38 14 38h33l-11-48" fill="#435f58" />
      <path d="M40 107q41-29 91 0l10 68H28z" fill="#e1ae76" stroke="#966b4b" strokeWidth="3" />
      <path d="M42 117l-23 42m111-43q20 13 27 32" stroke="#ae7252" strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M63 113l5 65h40l7-65" fill="#548364" stroke="#3c654f" strokeWidth="3" />
      <circle cx="83" cy="67" r="43" fill="#bb815e" />
      <path d="M42 68q-7-39 40-45 47-3 47 39-12-19-31-16-26 12-56 22" fill="#413730" />
      <path d="M35 42q11-39 50-37 45 0 53 37-45 23-103 0" fill="#8ca272" stroke="#56694e" strokeWidth="3" />
      <ellipse cx="87" cy="43" rx="66" ry="10" fill="#b6a771" stroke="#56694e" strokeWidth="3" />
      <circle cx="67" cy="69" r="3" fill="#302b28" /><circle cx="100" cy="69" r="3" fill="#302b28" />
      <path d="M68 87q16 13 32 0" fill="none" stroke="#68463a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function GrowingArt({ kind }: { kind: 'seed' | 'sprout' | 'tree' }) {
  return (
    <svg viewBox="0 0 160 170" aria-hidden="true">
      <path d="M13 140q65-22 135 0v30H13z" fill="#b3936a" />
      {kind === 'seed' ? <ellipse cx="80" cy="113" rx="17" ry="23" fill="#785037" transform="rotate(-25 80 113)" /> : null}
      {kind !== 'seed' ? (
        <>
          <path d="M80 142q-5-49 6-100" fill="none" stroke="#6b7950" strokeWidth={kind === 'tree' ? 13 : 7} strokeLinecap="round" />
          <path d="M79 98q-26-29-42-10 20 24 42 10M84 79q33-27 41-4-26 21-41 4" fill="#72a46b" stroke="#4e8255" strokeWidth="3" />
        </>
      ) : null}
      {kind === 'tree' ? <><circle cx="78" cy="49" r="37" fill="#739e67" /><circle cx="50" cy="66" r="24" fill="#84ac71" /><circle cx="113" cy="65" r="25" fill="#68935d" /></> : null}
    </svg>
  );
}

function SeedArt() {
  return (
    <svg viewBox="0 0 160 170" aria-hidden="true">
      <ellipse cx="80" cy="88" rx="38" ry="51" fill="#79533a" stroke="#573c2b" strokeWidth="4" transform="rotate(-25 80 88)" />
      <path d="M66 70q12-19 27-19" fill="none" stroke="#b48b68" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function BananaActionArt() {
  return (
    <span className="garden-bonus__action" aria-hidden="true">
      <ChildArt />
      <img src="/assets/garden/banana.webp" alt="" />
    </span>
  );
}

function BananaBonus({
  play,
  settings,
  onAgain,
  onPartChange,
  cancelCurrent,
}: {
  play: (line: GardenLine) => Promise<unknown>;
  settings: ToddlerGameProps['settings'];
  onAgain: () => void;
  onPartChange: (part: number) => void;
  cancelCurrent: () => void;
}) {
  const [part, setPart] = useState(0);
  const [acted, setActed] = useState(false);
  const partRef = useRef(0);
  const actedRef = useRef(false);
  const foreground = useRef(true);
  const timer = useRef<number | null>(null);
  const english = settings.languageMode === 'en';
  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const next = useCallback(() => {
    clear();
    cancelCurrent();
    partRef.current += 1;
    onPartChange(partRef.current);
    setPart(partRef.current);
    actedRef.current = false;
    setActed(false);
  }, [cancelCurrent, clear, onPartChange]);

  useEffect(() => {
    if (part < 3 && !settings.quietMode && !acted) void play(GARDEN_BANANA_WORDS[part]!);
  }, [acted, part, play, settings.quietMode]);
  useEffect(() => subscribeAppLifecycle((state) => {
    foreground.current = state !== 'background';
    if (!foreground.current) clear();
    else if (actedRef.current) timer.current = window.setTimeout(next, RESPONSE_PAUSE_MS);
  }), [clear, next]);
  useEffect(() => clear, [clear]);

  const touch = () => {
    if (actedRef.current || partRef.current >= 3 || !foreground.current) return;
    const index = partRef.current;
    actedRef.current = true;
    setActed(true);
    soundService.playTap(settings);
    clear();
    cancelCurrent();
    timer.current = window.setTimeout(() => {
      if (foreground.current && partRef.current === index) next();
    }, FALLBACK_MS);
    const narrate = async () => {
      await play(GARDEN_BANANA_WORDS[index]!);
      if (index === 2 && foreground.current && partRef.current === index) {
        await play(GARDEN_BANANA_SENTENCE);
      }
      if (!foreground.current || partRef.current !== index) return;
      clear();
      timer.current = window.setTimeout(next, RESPONSE_PAUSE_MS);
    };
    void narrate();
  };

  return (
    <div className="garden-bonus" data-part={part} data-acted={acted} dir="rtl">
      <div className="garden-bonus__strip" aria-hidden="true">
        <span className={part >= 0 ? 'is-lit' : ''}><ChildArt /></span>
        <span className={part >= 1 ? 'is-lit' : ''}><BananaActionArt /></span>
        <span className={part >= 2 ? 'is-lit' : ''}><img src="/assets/garden/banana.webp" alt="" /></span>
      </div>
      {part < 3 ? (
        <button type="button" className={`garden-bonus__target garden-bonus__target--${part}`} disabled={acted} onClick={touch} aria-label={english ? GARDEN_BANANA_WORDS[part]!.en : GARDEN_BANANA_WORDS[part]!.he}>
          {part === 0 ? <ChildArt /> : part === 1 ? <BananaActionArt />
            : <img src={acted ? '/assets/garden/banana-bitten.webp' : '/assets/garden/banana.webp'} alt="" />}
        </button>
      ) : <button type="button" className="garden-bonus__target" onClick={onAgain} aria-label={english ? 'Back to the garden' : 'חזרה לגן'}><img src="/assets/garden/banana-bitten.webp" alt="" /><span aria-hidden="true">↻</span></button>}
      {part === 3 ? <span className="garden-bonus__leaves" aria-hidden="true">🍃 🍃 🍃</span> : null}
    </div>
  );
}

function ConnectorBonus({
  play,
  settings,
  onAgain,
  onPartChange,
  cancelCurrent,
}: {
  play: (line: GardenLine) => Promise<unknown>;
  settings: ToddlerGameProps['settings'];
  onAgain: () => void;
  onPartChange: (part: number) => void;
  cancelCurrent: () => void;
}) {
  const [part, setPart] = useState(0);
  const [acted, setActed] = useState(false);
  const partRef = useRef(0);
  const actedRef = useRef(false);
  const foreground = useRef(true);
  const timer = useRef<number | null>(null);
  const english = settings.languageMode === 'en';
  const first = GARDEN_FRUITS[0]!;
  const second = GARDEN_FRUITS[1]!;
  const line = part === 0 ? gardenPhrase(first) : gardenPhrase(first, second);
  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const next = useCallback(() => {
    clear();
    cancelCurrent();
    partRef.current += 1;
    onPartChange(partRef.current);
    setPart(partRef.current);
    actedRef.current = false;
    setActed(false);
  }, [cancelCurrent, clear, onPartChange]);
  useEffect(() => {
    if (!settings.quietMode) void play(GARDEN_INVITATION);
  }, [play, settings.quietMode]);
  useEffect(() => subscribeAppLifecycle((state) => {
    foreground.current = state !== 'background';
    if (!foreground.current) clear();
    else if (actedRef.current) timer.current = window.setTimeout(next, RESPONSE_PAUSE_MS);
  }), [clear, next]);
  useEffect(() => clear, [clear]);

  const touch = () => {
    if (actedRef.current || partRef.current >= 2 || !foreground.current) return;
    const index = partRef.current;
    actedRef.current = true;
    setActed(true);
    soundService.playTap(settings);
    clear();
    cancelCurrent();
    timer.current = window.setTimeout(() => {
      if (foreground.current && partRef.current === index) next();
    }, FALLBACK_MS);
    void play(index === 0 ? gardenPhrase(first) : gardenPhrase(first, second)).then(() => {
      if (!foreground.current || partRef.current !== index) return;
      clear();
      timer.current = window.setTimeout(next, RESPONSE_PAUSE_MS);
    });
  };

  return (
    <div className="garden-bonus garden-bonus--connector" data-part={part} data-acted={acted} dir="rtl">
      <div className="garden-bonus__strip garden-bonus__strip--fruit" aria-hidden="true">
        <span className={part >= 1 ? 'is-lit' : ''}><img src={first.image} alt="" /></span>
        <span className={part >= 2 ? 'is-lit' : ''}>⌁</span>
        <span className={part >= 2 ? 'is-lit' : ''}><img src="/assets/garden/dates.webp" alt="" /></span>
      </div>
      {part < 2 ? (
        <button type="button" className="garden-bonus__target" disabled={acted} onClick={touch} aria-label={english ? line.en : line.he}>
          <img src={part === 0 ? first.image : '/assets/garden/dates.webp'} alt="" />
        </button>
      ) : (
        <button type="button" className="garden-bonus__target" onClick={onAgain} aria-label={english ? 'Back to the garden' : 'חזרה לגן'}>
          <img src="/assets/garden/dates.webp" alt="" /><span aria-hidden="true">↻</span>
        </button>
      )}
    </div>
  );
}

export function WordGardenGame({
  domainProgress,
  settings,
  mediaReady,
  speechStatus,
  onBack,
  onCompleteRound,
}: ToddlerGameProps) {
  const { roundKey, startNextRound } = useAdaptiveRound('wordGarden', domainProgress, createGardenRound);
  const sessionId = useId();
  const [stepIndex, setStepIndex] = useState(0);
  const [acted, setActed] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [bonusActive, setBonusActive] = useState(false);
  const [connectorActive, setConnectorActive] = useState(false);
  const stepRef = useRef(0);
  const actedRef = useRef(false);
  const foreground = useRef(true);
  const timer = useRef<number | null>(null);
  const playSerial = useRef(0);
  const completed = useRef(false);
  const bonusPart = useRef(0);
  const connectorPart = useRef(0);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const destination = useRef<HTMLDivElement>(null);
  const english = settings.languageMode === 'en';
  const current = JOURNEY[stepIndex];

  const scope = useCallback((stepId: string) => ({
    activityId: 'word-garden',
    sessionId,
    roundId: String(roundKey),
    stepId,
  }), [roundKey, sessionId]);
  const cancelBonusSpeech = useCallback(() => {
    interactionMediaCoordinator.notifyInteraction(scope('bonus-transition'), 'round-replacement');
  }, [scope]);
  const onBonusPartChange = useCallback((part: number) => {
    bonusPart.current = part;
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const play = useCallback(async (line: GardenLine) => {
    const serial = ++playSerial.current;
    const mediaScope = scope(String(serial));
    const result = await interactionMediaCoordinator.play({
      intentId: `word-garden:${sessionId}:${roundKey}:${serial}`,
      source: 'touch',
      scope: mediaScope,
      audioClass: 'mandatory',
      settings,
      units: createInteractionMediaUnits(mediaScope, gardenSegments(line, settings.languageMode, settings.englishVoiceLocale)),
    });
    if (foreground.current && serial === playSerial.current
      && (result.status === 'errored' || result.status === 'unavailable')) {
      setLiveStatus(english ? 'Sound is unavailable. Keep playing by touch.' : 'השמע אינו זמין. אפשר להמשיך בנגיעה.');
    }
    return result;
  }, [english, roundKey, scope, sessionId, settings]);

  const advance = useCallback(() => {
    clearTimer();
    interactionMediaCoordinator.notifyInteraction(scope('transition'), 'round-replacement');
    actedRef.current = false;
    setActed(false);
    setLiveStatus('');
    setBonusActive(false);
    setConnectorActive(false);
    stepRef.current += 1;
    setStepIndex(stepRef.current);
  }, [clearTimer, scope]);

  useEffect(() => {
    stepRef.current = 0;
    actedRef.current = false;
    completed.current = false;
    foreground.current = true;
    setStepIndex(0);
    setActed(false);
    setLiveStatus('');
    clearTimer();
    return () => {
      foreground.current = false;
      clearTimer();
      interactionMediaCoordinator.notifyInteraction(scope('exit'), 'exit');
    };
  }, [roundKey, clearTimer, scope]);

  useEffect(() => subscribeAppLifecycle((state) => {
    foreground.current = state !== 'background';
    if (!foreground.current) {
      clearTimer();
      interactionMediaCoordinator.notifyInteraction(scope('background'), 'background');
    } else if (actedRef.current) {
      timer.current = window.setTimeout(advance, RESPONSE_PAUSE_MS);
    } else if (mediaReady && !settings.quietMode && stepRef.current < JOURNEY.length) {
      void play(stepRef.current === 0 ? GARDEN_ASK : JOURNEY[stepRef.current]!.line);
    }
  }), [advance, clearTimer, mediaReady, play, scope, settings.quietMode]);

  useEffect(() => {
    if (!mediaReady || settings.quietMode || !foreground.current || actedRef.current || !current) return;
    void play(stepIndex === 0 ? GARDEN_ASK : current.line);
  }, [current, mediaReady, play, settings.quietMode, stepIndex]);

  const handleTouch = () => {
    const stage = JOURNEY[stepRef.current];
    if (!stage || actedRef.current || !foreground.current) return;
    actedRef.current = true;
    setActed(true);
    soundService.playTap(settings);
    const index = stepRef.current;
    const phrase = stage.expanded;
    setLiveStatus(english ? phrase.en : phrase.he);
    interactionMediaCoordinator.notifyInteraction(scope('touch'), 'round-replacement');
    clearTimer();
    const armFallback = () => {
      timer.current = window.setTimeout(() => {
        if (foreground.current && stepRef.current === index) advance();
      }, FALLBACK_MS);
    };
    armFallback();
    const narrate = async () => {
      if (index === 0) {
        await play(GARDEN_PERSIMMON_WORD);
        if (!foreground.current || stepRef.current !== index) return;
        clearTimer();
        armFallback();
      }
      if (!foreground.current || stepRef.current !== index) return;
      await play(index === 0 ? stage.line : phrase);
      if (!foreground.current || stepRef.current !== index) return;
      clearTimer();
      if (index === 0) {
        timer.current = window.setTimeout(() => {
          if (!foreground.current || stepRef.current !== index) return;
          armFallback();
          void play(stage.expanded).then(() => {
            if (!foreground.current || stepRef.current !== index) return;
            timer.current = window.setTimeout(advance, RESPONSE_PAUSE_MS);
          });
        }, RESPONSE_PAUSE_MS);
      } else {
        timer.current = window.setTimeout(advance, RESPONSE_PAUSE_MS);
      }
    };
    void narrate();
    if (index === JOURNEY.length - 1 && !completed.current) {
      completed.current = true;
      soundService.playSuccess(settings);
      onCompleteRound({
        attempts: JOURNEY.length,
        requiredActions: JOURNEY.length,
        concepts: ['persimmon'],
      });
    }
  };

  const dragEnabled = current?.id === 'exchange' || current?.id === 'cover';
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragEnabled || actedRef.current) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const x = event.clientX - drag.current.x;
    const y = event.clientY - drag.current.y;
    if (Math.hypot(x, y) > 12) drag.current.moved = true;
    if (drag.current.moved) setDragOffset({ x, y });
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    if (drag.current.moved && destination.current) {
      const box = destination.current.getBoundingClientRect();
      if (event.clientX >= box.left && event.clientX <= box.right
        && event.clientY >= box.top && event.clientY <= box.bottom) handleTouch();
    }
    setDragOffset({ x: 0, y: 0 });
    // Keep the moved flag until the synthesized click, so a missed drop never becomes a tap.
    if (!drag.current.moved) drag.current = null;
  };
  const onTargetClick = () => {
    if (drag.current?.moved) { drag.current = null; return; }
    handleTouch();
  };
  const leave = () => {
    clearTimer();
    interactionMediaCoordinator.notifyInteraction(scope('exit'), 'exit');
    onBack();
  };

  return (
    <GameShell
      ariaLabel={english ? 'Word Garden' : gameMeta.wordGarden.title}
      accentClass={gameMeta.wordGarden.accentClass}
      languageMode={settings.languageMode}
      reducedMotion={settings.reducedMotion}
      onHome={leave}
      homeLabel={english ? 'Back home' : 'חזרה לבית'}
      onRepeat={() => {
        if (bonusActive) void play(GARDEN_BANANA_WORDS[bonusPart.current] ?? GARDEN_BANANA_SENTENCE);
        else if (connectorActive) void play(connectorPart.current === 0
          ? GARDEN_INVITATION : gardenPhrase(GARDEN_FRUITS[0]!, connectorPart.current === 1 ? undefined : GARDEN_FRUITS[1]!));
        else if (current) void play(stepIndex === 0 && !acted ? GARDEN_ASK : acted ? current.expanded : current.line);
      }}
      replayLabel={english ? 'Hear again' : 'לשמוע שוב'}
      repeatDisabled={!mediaReady || settings.quietMode || !speechStatus.supported || (!current && !bonusActive && !connectorActive)}
      liveStatus={liveStatus}
    >
      <div className="garden-journey" data-stage={current?.id ?? 'complete'} data-acted={acted} dir="rtl">
        <div className="garden-journey__people" aria-hidden="true">
          <div className="garden-journey__person garden-journey__person--child"><ChildArt /></div>
          <div className="garden-journey__person garden-journey__person--gardener"><GardenerArt /></div>
        </div>
        {stepIndex === 1 ? <img className="garden-journey__held garden-journey__held--fruit" src={ART.persimmon} alt="" aria-hidden="true" /> : null}
        {stepIndex >= 2 ? <img className="garden-journey__held garden-journey__held--token" src={ART.token} alt="" aria-hidden="true" /> : null}
        <div className="garden-journey__ground" aria-hidden="true">
          {stepIndex >= 4 ? <GrowingArt kind={stepIndex >= 7 ? 'tree' : stepIndex >= 6 ? 'sprout' : 'seed'} /> : null}
        </div>
        {bonusActive ? <BananaBonus play={play} settings={settings} onAgain={() => startNextRound()} onPartChange={onBonusPartChange} cancelCurrent={cancelBonusSpeech} /> : connectorActive ? (
          <ConnectorBonus
            play={play}
            settings={settings}
            onAgain={() => startNextRound()}
            onPartChange={(part) => { connectorPart.current = part; }}
            cancelCurrent={cancelBonusSpeech}
          />
        ) : current ? (
          <>
            <div className={`garden-journey__destination garden-journey__destination--${current.destination}`} ref={destination} aria-hidden="true">
              {current.destination === 'soil' || current.destination === 'tree' ? <span className="garden-journey__soil" /> : <span className="garden-journey__hand">●</span>}
            </div>
            <button
              className={`garden-journey__target garden-journey__target--${current.id}`}
              type="button"
              onClick={onTargetClick}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => { drag.current = null; setDragOffset({ x: 0, y: 0 }); }}
              style={{ '--drag-x': `${dragOffset.x}px`, '--drag-y': `${dragOffset.y}px` } as CSSProperties}
              aria-label={english ? current.line.en : current.line.he}
              disabled={acted}
            >
              {current.image === 'seed' ? <SeedArt /> : current.image === 'sprout' || current.image === 'tree'
                ? <GrowingArt kind={current.image} />
                : <img src={current.image} alt="" draggable={false} />}
              {current.id === 'seed' && acted ? <span className="garden-journey__seed-reveal"><SeedArt /></span> : null}
            </button>
            <span className="garden-journey__hint" aria-hidden="true">☝</span>
          </>
        ) : (
          <div className="garden-journey__finish">
            <button type="button" className="garden-journey__finish-choice" onClick={() => { bonusPart.current = 0; setBonusActive(true); }} aria-label={english ? 'Play with a banana' : 'משחק הבננה'}>
              <img src="/assets/garden/banana.webp" alt="" />
            </button>
            <button type="button" className="garden-journey__finish-choice" onClick={() => { connectorPart.current = 0; setConnectorActive(true); }} aria-label={english ? 'Join two fruits' : 'מחברים שני פירות'}>
              <img src="/assets/garden/dates.webp" alt="" />
            </button>
            <button type="button" className="garden-journey__finish-choice" onClick={() => startNextRound()} aria-label={english ? 'Play in the garden again' : 'לשחק שוב בגן'}>
              <GrowingArt kind="tree" /><span aria-hidden="true">↻</span>
            </button>
          </div>
        )}
      </div>
    </GameShell>
  );
}
