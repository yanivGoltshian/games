import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { gameMeta } from '../content/games';
import {
  GARDEN_CHILDREN,
  GARDEN_ASK,
  GARDEN_CONNECTORS,
  GARDEN_EFFORT,
  GARDEN_FRUITS,
  GARDEN_INVITATION,
  GARDEN_PERSIMMON_IMAGE,
  GARDEN_PERSIMMON_WORD,
  createGardenRound,
  gardenPhrase,
  gardenChildPhrase,
  gardenSegments,
  type GardenConnector,
  type GardenChild,
  type GardenFruit,
  type GardenLine,
  type GardenStage,
} from '../content/wordGarden';
import { subscribeAppLifecycle } from '../platform/useAppLifecycle';
import {
  createInteractionMediaUnits,
  interactionMediaCoordinator,
  type InteractionMediaOutcomeStatus,
} from '../services/interactionMediaCoordinator';
import { soundService } from '../services/sound';
import { useMicEffort } from './useMicEffort';
import type { ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';

const LISTEN_MS = 4_000;
const NEXT_ROUND_MS = 5_000;
const FRUIT_TURN_MS = 4_000;
const GROWTH_TURN_MS = 2_400;
const RESPONSE_TURN_MS = 1_800;

function canContinueAfterTouch(status: InteractionMediaOutcomeStatus): boolean {
  return status !== 'cancelled' && status !== 'replaced';
}

function GardenerArt() {
  return (
    <svg className="word-garden-person" viewBox="0 0 220 260" role="presentation" aria-hidden="true">
      <ellipse cx="110" cy="248" rx="86" ry="10" fill="#6b7751" opacity=".23" />
      <path d="M66 180 L58 237 Q76 251 91 239 L108 201 L128 239 Q146 249 162 236 L153 177 Z" fill="#455e57" />
      <path d="M45 142 Q70 118 110 119 Q153 120 175 147 L183 198 H37 Z" fill="#e3b576" />
      <path d="M53 142 L38 188 Q28 211 47 211 Q58 210 66 192 L78 156" fill="#9d6047" />
      <path d="M166 145 L190 187 Q202 209 188 214 Q176 214 166 197 L149 159" fill="#9d6047" />
      <circle cx="186" cy="209" r="13" fill="#ba7d5e" />
      <path d="M72 151 L82 215 H145 L155 151 Z" fill="#547d63" />
      <path d="M85 153 L88 126 M144 153 L140 127" fill="none" stroke="#547d63" strokeWidth="13" />
      <rect x="95" y="174" width="36" height="27" rx="5" fill="#759b76" />
      <path d="M111 186 Q107 176 98 180 M111 186 Q113 175 123 180 M111 186 V194" fill="none" stroke="#d8e6ab" strokeWidth="3" />
      <rect x="96" y="107" width="30" height="29" rx="13" fill="#ad6b50" />
      <ellipse cx="110" cy="72" rx="53" ry="57" fill="#b8795b" />
      <path d="M60 75 Q50 31 76 25 Q95 8 129 25 Q157 22 161 61 L152 77 Q143 54 122 54 Q106 64 84 54 Q75 65 60 75" fill="#43352f" />
      <path d="M59 57 Q65 6 115 10 Q157 14 161 57 Q110 78 59 57" fill="#83956a" stroke="#4c644f" strokeWidth="3" />
      <path d="M57 56 Q115 46 175 61 Q151 72 115 70 Q77 72 57 56" fill="#b3a56e" stroke="#4c644f" strokeWidth="3" />
      <path d="M76 37 Q93 23 105 27 M128 28 Q140 29 146 37" fill="none" stroke="#d7cc96" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <circle cx="92" cy="82" r="4" fill="#282c28" />
      <circle cx="130" cy="82" r="4" fill="#282c28" />
      <path d="M94 107 Q110 120 128 106" fill="none" stroke="#653e36" strokeWidth="4" strokeLinecap="round" />
      <circle cx="78" cy="97" r="9" fill="#e59b79" opacity=".7" />
      <circle cx="143" cy="97" r="9" fill="#e59b79" opacity=".7" />
      <path d="M170 165 Q190 159 200 146" stroke="#ad6b50" strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M198 148 L202 131 M198 148 L212 137" stroke="#ad6b50" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function GardenActionArt({ stage, done }: { stage: GardenStage; done: boolean }) {
  const clipId = useId();
  const hasFruit = ['ask', 'receive', 'pick', 'put', 'carry', 'wash', 'smell', 'taste', 'share', 'seed', 'fruit'].includes(stage);
  const cherry = stage === 'pick' || stage === 'wash';
  const persimmon = stage === 'ask' || stage === 'receive' || stage === 'seed' || stage === 'fruit';
  return (
    <svg viewBox="0 0 220 220" aria-hidden="true">
      <defs><clipPath id={clipId}><circle cx="110" cy="93" r="44" /></clipPath></defs>
      <path d="M22 179 Q65 170 110 180 Q156 169 199 180" fill="none" stroke="#79966a" strokeWidth="5" strokeLinecap="round" />
      {hasFruit ? (
        <image
          href={persimmon ? GARDEN_PERSIMMON_IMAGE : cherry ? GARDEN_FRUITS[0].image : GARDEN_FRUITS[1].image}
          x="66" y="49" width="88" height="88"
          clipPath={`url(#${clipId})`}
          transform={done && stage === 'put' ? 'translate(0 42)' : done && stage === 'receive' ? 'translate(36 24)' : undefined}
        />
      ) : null}
      {stage === 'ask' || stage === 'receive' ? (
        <>
          <circle cx="185" cy="96" r="25" fill="#c48b68" stroke="#735443" strokeWidth="3" />
          <path d="M161 92q4-30 27-27 21 3 21 25-18-14-38-4" fill="#453b33" />
          <path d="M180 104q8 6 14-1 M161 142q19-22 39 0" fill="none" stroke="#694638" strokeWidth="3" strokeLinecap="round" />
          {stage === 'receive' ? <path d={done ? 'M170 152q-31-5-42-25' : 'M172 156q-20 1-28-14'} fill="none" stroke="#b57f60" strokeWidth="10" strokeLinecap="round" /> : null}
        </>
      ) : null}
      {stage === 'exchange' || stage === 'accept' ? (
        <>
          <circle cx="32" cy="90" r="23" fill="#ad755b" />
          <circle cx="189" cy="90" r="23" fill="#ca926c" />
          <path d="M16 87q4-26 26-15 M171 85q9-22 33-10" fill="none" stroke="#51413a" strokeWidth="8" strokeLinecap="round" />
          <g transform={done ? 'translate(-58 0)' : 'translate(37 0)'}>
            <circle cx="110" cy="117" r="31" fill="#e1ba64" stroke="#947344" strokeWidth="6" />
            <path d="M109 129v-19q-12-10-19 0 M109 121q13-19 23-5" fill="none" stroke="#748550" strokeWidth="5" strokeLinecap="round" />
          </g>
          <path d="M36 164q34-30 55-16 M175 164q-32-30-55-16" fill="none" stroke="#a46d52" strokeWidth="9" strokeLinecap="round" />
        </>
      ) : null}
      {stage === 'arrive' || stage === 'carry' ? (
        <g transform={done ? 'translate(24 -5)' : 'translate(-18 5)'}>
          <path d="M35 113h120l-13 52H51z" fill="#bf8153" stroke="#825f42" strokeWidth="5" strokeLinejoin="round" />
          <path d="M35 113h120 M62 128l9 23 M99 128v25 M133 127l-9 24" fill="none" stroke="#f1ca8c" strokeWidth="5" strokeLinecap="round" />
          <circle cx="67" cy="171" r="11" fill="#5b5040" />
          <circle cx="132" cy="171" r="11" fill="#5b5040" />
          {stage === 'arrive' ? <path d="M22 93q-10-10 2-17 M178 110q9 5 15 0" fill="none" stroke="#73936b" strokeWidth="5" strokeLinecap="round" /> : null}
        </g>
      ) : null}
      {stage === 'pick' ? (
        <><path d="M31 37q55-22 158 10 M133 40q20-6 28-29" fill="none" stroke="#6b8051" strokeWidth="9" strokeLinecap="round" />
          {done ? <path d="M46 159h131l-12 36H58z" fill="#c69461" stroke="#835d42" strokeWidth="4" /> : null}</>
      ) : null}
      {stage === 'put' || stage === 'carry' ? (
        <path d="M45 157h131l-13 38H59z" fill={stage === 'carry' ? '#d0a571' : '#c48c5e'} stroke="#835d42" strokeWidth="5" strokeLinejoin="round" />
      ) : null}
      {stage === 'wash' ? (
        <><path d="M28 34h76q13 0 13 14v13" fill="none" stroke="#59858d" strokeWidth="11" strokeLinecap="round" />
          <path d="M103 61h27" stroke="#59858d" strokeWidth="7" strokeLinecap="round" />
          <path d={done ? 'M123 70v19 M111 76v18 M136 78v17' : 'M123 71v8'} stroke="#75b9ca" strokeWidth="6" strokeLinecap="round" /></>
      ) : null}
      {stage === 'smell' ? (
        <><circle cx="180" cy="98" r="19" fill="#bd8262" /><path d="M160 111q20 16 32-1 M162 60q-12-20 1-32 M181 65q-12-20 2-32" fill="none" stroke="#708f77" strokeWidth="4" strokeLinecap="round" /></>
      ) : null}
      {stage === 'taste' ? (
        <><circle cx="180" cy="97" r="22" fill="#bd8262" /><path d="M163 110q17 16 33-1" fill="none" stroke="#68483d" strokeWidth="4" strokeLinecap="round" />
          {done ? <path d="M148 137q20 1 32-18" fill="none" stroke="#a97659" strokeWidth="8" strokeLinecap="round" /> : null}</>
      ) : null}
      {stage === 'share' ? (
        <><circle cx="38" cy="103" r="21" fill="#ba8065" /><circle cx="183" cy="103" r="21" fill="#d4a47b" />
          <path d="M33 115q7 6 13 0 M176 115q7 6 13 0" fill="none" stroke="#775542" strokeWidth="3" strokeLinecap="round" />
          {done ? <path d="M124 147q27 15 47 0" fill="none" stroke="#6b8c5f" strokeWidth="6" strokeLinecap="round" /> : null}</>
      ) : null}
      {['seed', 'bury', 'cover', 'water', 'sun', 'sprout', 'tree', 'flower', 'fruit'].includes(stage) ? (
        <><path d="M37 169q74-20 146 0v34H37z" fill="#ad8b65" stroke="#7d674f" strokeWidth="4" />
          {['seed', 'bury', 'cover', 'water', 'sun', 'sprout'].includes(stage) ? (
            <ellipse cx="110" cy={stage === 'seed' ? 158 : done ? 178 : 154} rx="10" ry="15" fill="#71462f" transform={stage === 'seed' ? 'rotate(-20 110 158)' : undefined} />
          ) : null}
          {stage === 'seed' && done ? <path d="M83 146q-14 3-20 17" stroke="#7b6849" strokeWidth="4" fill="none" strokeLinecap="round" /> : null}
          {stage === 'cover' ? <path d={done ? 'M79 167q35-32 64 0' : 'M79 174q35-9 64 0'} fill="#b79973" stroke="#79634e" strokeWidth="4" /> : null}
          {stage === 'water' ? <><path d="M49 60h54l9 46H39z" fill="#84aab1" stroke="#527b84" strokeWidth="5" /><path d="M104 70q39 0 39 22" fill="none" stroke="#527b84" strokeWidth="9" strokeLinecap="round" />
            {done ? <path d="M144 99v13 M154 111v16 M135 115v17" stroke="#77bdcf" strokeWidth="6" strokeLinecap="round" /> : null}</> : null}
          {stage === 'sun' ? <><circle cx="110" cy="83" r="30" fill="#f3ce78" /><path d="M110 34V22 M110 131v12 M60 82H47 M161 82h12" stroke="#d39e46" strokeWidth="5" strokeLinecap="round" /></> : null}
          {stage === 'sprout' ? <><path d={done ? 'M110 160q-4-36 1-78' : 'M110 164q-5-16 0-23'} fill="none" stroke="#51855c" strokeWidth="8" strokeLinecap="round" />
            {done ? <path d="M108 122q-40-35-43-4 22 17 43 4 M112 107q41-34 45-6-22 19-45 6" fill="#6ba66a" stroke="#4f8555" strokeWidth="3" /> : null}</> : null}
          {stage === 'tree' || stage === 'flower' || stage === 'fruit' ? (
            <><path d={done ? 'M110 173q-8-56 4-118 M112 126q-30-28-48-31 M113 104q27-29 47-31' : 'M110 173q-5-40 1-78'} fill="none" stroke="#7e6a51" strokeWidth="11" strokeLinecap="round" />
              <ellipse cx="88" cy={done ? 76 : 110} rx={done ? 51 : 34} ry={done ? 44 : 26} fill="#90aa6f" />
              <ellipse cx="140" cy={done ? 71 : 105} rx={done ? 48 : 30} ry={done ? 42 : 25} fill="#73975f" /></>
          ) : null}
          {stage === 'flower' && done ? <>{[72, 94, 120, 146].map((x) => <circle key={x} cx={x} cy={63 + x % 20} r="6" fill="#fff3c6" stroke="#c9aa70" strokeWidth="2" />)}</> : null}
          {stage === 'fruit' && done ? <>{[76, 96, 142].map((x) => <circle key={x} cx={x} cy={70 + x % 17} r="11" fill="#d98c4e" stroke="#b87445" strokeWidth="3" />)}</> : null}
          {stage === 'fruit' && done ? <image href={GARDEN_PERSIMMON_IMAGE} x="78" y="46" width="64" height="64" clipPath={`url(#${clipId})`} /> : null}
        </>
      ) : null}
    </svg>
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
  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'wordGarden',
    domainProgress,
    createGardenRound,
  );
  const sessionId = useId();
  const [picked, setPicked] = useState<readonly GardenFruit[]>([]);
  const pickedRef = useRef<readonly GardenFruit[]>([]);
  const [connector, setConnector] = useState<GardenConnector>('and');
  const connectorRef = useRef<GardenConnector>('and');
  const [stageIndex, setStageIndex] = useState(-1);
  const stageIndexRef = useRef(-1);
  const [stageDone, setStageDone] = useState(false);
  const [heardVoice, setHeardVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const speechSequence = useRef(0);
  const listenTimer = useRef<number | null>(null);
  const nextTimer = useRef<number | null>(null);
  const effortMs = useRef(0);
  const voiceDetected = useRef(false);
  const completed = useRef(false);
  const activeRound = useRef(roundKey);
  const foreground = useRef(true);

  const { start: startMic, stop: stopMic, supported: micSupported } = useMicEffort((level, deltaMs) => {
    if (level !== 1 || voiceDetected.current) return;
    effortMs.current += Math.min(deltaMs, 100);
    if (effortMs.current >= 180) {
      voiceDetected.current = true;
      setHeardVoice(true);
      setLiveStatus(settings.languageMode === 'en' ? 'I heard a sound' : 'שמעתי קול');
    }
  });

  const stopListening = useCallback(() => {
    if (listenTimer.current !== null) window.clearTimeout(listenTimer.current);
    listenTimer.current = null;
    stopMic();
    setListening(false);
  }, [stopMic]);

  const stopNextTimer = useCallback(() => {
    if (nextTimer.current !== null) window.clearTimeout(nextTimer.current);
    nextTimer.current = null;
  }, []);

  const play = useCallback((line: GardenLine) => {
    speechSequence.current += 1;
    const scope = {
      activityId: 'word-garden',
      sessionId,
      roundId: String(roundKey),
      stepId: String(speechSequence.current),
    };
    const segments = gardenSegments(line, settings.languageMode, settings.englishVoiceLocale);
    return interactionMediaCoordinator.play({
      intentId: `word-garden:${sessionId}:${roundKey}:${scope.stepId}`,
      source: 'touch',
      scope,
      audioClass: 'mandatory',
      settings,
      units: createInteractionMediaUnits(scope, segments),
    }).then((result) => {
      if (activeRound.current === roundKey && foreground.current
        && (result.status === 'errored' || result.status === 'unavailable')) {
        setLiveStatus(settings.languageMode === 'en'
          ? 'Sound is unavailable. You can continue by touch.'
          : 'השמע אינו זמין. אפשר להמשיך בנגיעה.');
      }
      return result;
    });
  }, [roundKey, sessionId, settings]);

  useEffect(() => {
    activeRound.current = roundKey;
    foreground.current = true;
    pickedRef.current = [];
    setPicked([]);
    connectorRef.current = 'and';
    setConnector('and');
    stageIndexRef.current = -1;
    setStageIndex(-1);
    setStageDone(false);
    completed.current = false;
    voiceDetected.current = false;
    effortMs.current = 0;
    setHeardVoice(false);
    setLiveStatus('');
    stopListening();
    stopNextTimer();
    return () => {
      foreground.current = false;
      stopListening();
      stopNextTimer();
      interactionMediaCoordinator.notifyInteraction({
        activityId: 'word-garden',
        sessionId,
        roundId: String(roundKey),
        stepId: 'exit',
      }, 'exit');
    };
  }, [roundKey, sessionId, stopListening, stopNextTimer]);

  useEffect(() => subscribeAppLifecycle((state) => {
    if (state === 'background') {
      foreground.current = false;
      stopListening();
      stopNextTimer();
    } else {
      foreground.current = true;
    }
  }), [stopListening, stopNextTimer]);

  useEffect(() => {
    if (settings.quietMode) stopListening();
  }, [settings.quietMode, stopListening]);

  const scheduleNext = useCallback(() => {
    stopNextTimer();
    nextTimer.current = window.setTimeout(startNextRound, NEXT_ROUND_MS);
  }, [startNextRound, stopNextTimer]);

  const acknowledgeEffort = () => {
    if (!voiceDetected.current) return;
    void play(GARDEN_EFFORT);
  };

  const advanceGrowth = useCallback(() => {
    stopNextTimer();
    const next = stageIndexRef.current + 1;
    if (next >= round.stages.length) {
      if (!completed.current && pickedRef.current.length === 2) {
        completed.current = true;
        soundService.playSuccess(settings);
        onCompleteRound({
          attempts: 2 + round.stages.length,
          requiredActions: 2 + round.stages.length,
          concepts: pickedRef.current.map((item) => item.id),
        });
      }
      scheduleNext();
      return;
    }
    stageIndexRef.current = next;
    setStageIndex(next);
    setStageDone(false);
    setLiveStatus('');
    if (round.stages[next]?.id === 'ask') {
      void play(GARDEN_ASK);
    }
  }, [onCompleteRound, play, round.stages, scheduleNext, settings, stopNextTimer]);

  const handleFruit = (fruit: GardenFruit) => {
    if (stageIndexRef.current >= 0) return;
    stopListening();
    stopNextTimer();
    const current = pickedRef.current;
    if (current.length === 0) {
      pickedRef.current = [fruit];
      setPicked([fruit]);
      setLiveStatus(settings.languageMode === 'en' ? `I want ${fruit.en}` : `אני רוצה ${fruit.he}`);
      soundService.playTap(settings);
      void play(gardenPhrase(fruit));
      return;
    }
    if (current.length === 1 && current[0]!.id !== fruit.id) {
      const pair = [current[0]!, fruit] as const;
      pickedRef.current = pair;
      setPicked(pair);
      const line = gardenPhrase(pair[0], pair[1], connectorRef.current);
      setLiveStatus(settings.languageMode === 'en' ? line.en : line.he);
      soundService.playTap(settings);
      const step = speechSequence.current + 1;
      void play(line).then((result) => {
        if (foreground.current && activeRound.current === roundKey
          && stageIndexRef.current === -1 && speechSequence.current === step
          && canContinueAfterTouch(result.status)) {
          nextTimer.current = window.setTimeout(advanceGrowth, FRUIT_TURN_MS);
        }
      });
      return;
    }
    const line = current.length === 1
      ? gardenPhrase(current[0]!)
      : gardenPhrase(current[0]!, current[1]!, connectorRef.current);
    const step = speechSequence.current + 1;
    void play(line).then((result) => {
      if (foreground.current && activeRound.current === roundKey
        && current.length === 2 && stageIndexRef.current === -1 && speechSequence.current === step
        && canContinueAfterTouch(result.status)) {
        nextTimer.current = window.setTimeout(advanceGrowth, FRUIT_TURN_MS);
      }
    });
  };

  const handleConnector = () => {
    if (stageIndexRef.current >= 0) return;
    const current = pickedRef.current;
    if (current.length < 2) {
      void play(GARDEN_INVITATION);
      return;
    }
    const index = GARDEN_CONNECTORS.indexOf(connectorRef.current);
    const next = GARDEN_CONNECTORS[(index + 1) % GARDEN_CONNECTORS.length]!;
    connectorRef.current = next;
    setConnector(next);
    stopNextTimer();
    const line = gardenPhrase(current[0]!, current[1]!, next);
    setLiveStatus(settings.languageMode === 'en' ? line.en : line.he);
    const step = speechSequence.current + 1;
    void play(line).then((result) => {
      if (foreground.current && activeRound.current === roundKey
        && stageIndexRef.current === -1 && speechSequence.current === step
        && canContinueAfterTouch(result.status)) {
        nextTimer.current = window.setTimeout(advanceGrowth, FRUIT_TURN_MS);
      }
    });
  };

  const handleChild = (child: GardenChild) => {
    if (stageIndexRef.current >= 0) return;
    const current = pickedRef.current;
    if (!current[0]) {
      void play(GARDEN_INVITATION);
      return;
    }
    stopNextTimer();
    const line = gardenChildPhrase(child, current[0], current[1]);
    setLiveStatus(settings.languageMode === 'en' ? line.en : line.he);
    const step = speechSequence.current + 1;
    void play(line).then((result) => {
      if (current.length === 2 && foreground.current && activeRound.current === roundKey
        && stageIndexRef.current === -1 && speechSequence.current === step
        && canContinueAfterTouch(result.status)) {
        nextTimer.current = window.setTimeout(advanceGrowth, FRUIT_TURN_MS);
      }
    });
  };

  const handleGardener = () => {
    const current = pickedRef.current;
    const currentStage = round.stages[stageIndexRef.current];
    if (currentStage?.id === 'ask' && !stageDone) {
      void play(GARDEN_ASK);
      return;
    }
    void play((stageDone ? currentStage?.expanded : currentStage?.line) ?? (current.length === 0
      ? GARDEN_INVITATION
      : gardenPhrase(current[0]!, current[1], connectorRef.current)));
  };

  const handleCart = () => {
    if (stageIndexRef.current >= round.stages.length - 1 && completed.current) {
      stopNextTimer();
      startNextRound();
    } else if (pickedRef.current.length === 2 && stageIndexRef.current === -1) {
      advanceGrowth();
    } else if (stageIndexRef.current >= 0 && stageDone) {
      handleGrowth();
    } else {
      handleGardener();
    }
  };

  const handleGrowth = () => {
    const stage = round.stages[stageIndexRef.current];
    if (!stage) return;
    stopListening();
    stopNextTimer();
    const line = stageDone ? stage.expanded : stage.line;
    setLiveStatus(settings.languageMode === 'en' ? line.en : line.he);
    setStageDone(true);
    soundService.playTap(settings);
    const currentStage = stageIndexRef.current;
    const speakModel = () => {
      const step = speechSequence.current + 1;
      void play(line).then((result) => {
        if (!foreground.current || activeRound.current !== roundKey || stageIndexRef.current !== currentStage
          || speechSequence.current !== step || !canContinueAfterTouch(result.status)) return;
        if (!stageDone) {
          nextTimer.current = window.setTimeout(() => {
            if (!foreground.current || activeRound.current !== roundKey || stageIndexRef.current !== currentStage
              || speechSequence.current !== step) return;
            const expansion = stage.expanded;
            const expansionStep = speechSequence.current + 1;
            setLiveStatus(settings.languageMode === 'en' ? expansion.en : expansion.he);
            void play(expansion).then((expandedResult) => {
              if (foreground.current && activeRound.current === roundKey && stageIndexRef.current === currentStage
                && speechSequence.current === expansionStep && canContinueAfterTouch(expandedResult.status)) {
                nextTimer.current = window.setTimeout(advanceGrowth, GROWTH_TURN_MS);
              }
            });
          }, RESPONSE_TURN_MS);
        } else {
          nextTimer.current = window.setTimeout(advanceGrowth, GROWTH_TURN_MS);
        }
      });
    };
    if (stage.id === 'ask' && !stageDone) {
      const wordStep = speechSequence.current + 1;
      void play(GARDEN_PERSIMMON_WORD).then((result) => {
        if (foreground.current && activeRound.current === roundKey && stageIndexRef.current === currentStage
          && speechSequence.current === wordStep && canContinueAfterTouch(result.status)) {
          speakModel();
        }
      });
    } else {
      speakModel();
    }
  };

  const handleMicrophone = async () => {
    if (listening) {
      stopListening();
      acknowledgeEffort();
      return;
    }
    if (settings.quietMode || pickedRef.current.length === 0) return;
    effortMs.current = 0;
    voiceDetected.current = false;
    setHeardVoice(false);
    const result = await startMic();
    if (result.status === 'started' && foreground.current && !settings.quietMode) {
      setListening(true);
      listenTimer.current = window.setTimeout(() => {
        stopListening();
        acknowledgeEffort();
      }, LISTEN_MS);
    } else if (result.status === 'permission-denied' || result.status === 'unsupported' || result.status === 'error') {
      setLiveStatus(settings.languageMode === 'en'
        ? 'No microphone. Keep choosing fruit by touch.'
        : 'אין מיקרופון. ממשיכים לבחור פירות בנגיעה.');
    }
  };

  const leave = () => {
    stopListening();
    stopNextTimer();
    onBack();
  };
  const english = settings.languageMode === 'en';
  const stage = round.stages[stageIndex];

  return (
    <GameShell
      ariaLabel={english ? 'Word Garden' : gameMeta.wordGarden.title}
      accentClass={gameMeta.wordGarden.accentClass}
      languageMode={settings.languageMode}
      reducedMotion={settings.reducedMotion}
      onHome={leave}
      homeLabel={english ? 'Back home' : 'חזרה לבית'}
      onRepeat={handleGardener}
      repeatDisabled={!mediaReady || settings.quietMode || !speechStatus.supported}
      replayLabel={english ? 'Hear the gardener' : 'לשמוע את הגנן'}
      liveStatus={liveStatus}
    >
      <div className="word-garden-scene" data-picked={picked.length} data-connector={connector} data-stage={stage?.id ?? 'fruit'}>
        {!stage ? (
          <div className="word-garden-children" role="group" aria-label={english ? 'Friends in the garden' : 'חברים בגן'}>
            {GARDEN_CHILDREN.map((child, index) => (
              <button
                type="button"
                key={child.id}
                className={`word-garden-child word-garden-child--${child.id}`}
                onClick={() => handleChild(child)}
                aria-label={english ? `Hear ${child.en}` : `לשמוע את ${child.he}`}
              >
                <svg viewBox="0 0 56 56" aria-hidden="true">
                  <circle cx="28" cy="28" r="26" fill={['#9bba8a', '#f4c67f', '#d2b6cb'][index]} stroke="#fff9e6" strokeWidth="3" />
                  <path d="M8 52 Q9 40 28 40 Q46 40 48 52" fill={['#477167', '#8e6e63', '#b77685'][index]} />
                  <circle cx="28" cy="26" r="15" fill={['#bf8163', '#d7a278', '#ab6d56'][index]} />
                  <path d={['M13 25 Q10 9 28 9 Q44 8 44 24 Q35 16 24 20 Q17 22 13 25', 'M13 27 Q14 8 28 9 Q44 8 44 27 Q37 23 37 19 Q24 25 13 27', 'M12 32 Q8 8 28 8 Q47 8 45 34 L41 33 Q40 19 28 20 Q17 20 16 32'][index]} fill="#423630" />
                  <path d="M22 28h1 M33 28h1 M24 34q4 4 8 0" fill="none" stroke="#432e2c" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            ))}
          </div>
        ) : null}
        <button className="word-garden-gardener" onClick={handleGardener} type="button" aria-label={english ? 'Hear the gardener' : 'לשמוע את הגנן'}>
          <GardenerArt />
          <span className="word-garden-sound" aria-hidden="true">
            <svg viewBox="0 0 32 32"><path d="M5 12h6l7-6v20l-7-6H5z M22 11q6 5 0 10" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </button>
        {stage ? (
          <button
            type="button"
            className={`word-garden-growth word-garden-growth--${stage.id} ${stageDone ? 'is-growing' : ''}`}
            onClick={handleGrowth}
            aria-label={english ? `Touch to hear: ${(stageDone ? stage.expanded : stage.line).en}` : `נוגעים ושומעים: ${(stageDone ? stage.expanded : stage.line).he}`}
          >
            <GardenActionArt stage={stage.id} done={stageDone} />
          </button>
        ) : (
        <button className="word-garden-cart" onClick={handleCart} type="button" aria-label={english ? 'Hear the fruit or begin the story' : 'לשמוע את הפירות או להתחיל בסיפור'}>
          <span className="word-garden-cart__basket">
            {picked.map((fruit) => (
              <img src={fruit.image} alt="" key={fruit.id} draggable={false} />
            ))}
          </span>
          <span className="word-garden-cart__wheels" aria-hidden="true"><i /><i /></span>
        </button>
        )}
        {stage && picked.length === 2 ? (
          <button className="word-garden-cart word-garden-cart--mini" onClick={handleCart} type="button" aria-label={english ? 'Hear it again or play again' : 'לשמוע שוב או לבחור מחדש'}>
            <span className="word-garden-cart__basket">{picked.map((fruit) => <img src={fruit.image} alt="" key={fruit.id} draggable={false} />)}</span>
            <span className="word-garden-cart__wheels" aria-hidden="true"><i /><i /></span>
          </button>
        ) : null}
        {!stage ? (
        <div className="word-garden-fruits" role="group" aria-label={english ? 'Pick fruit' : 'בוחרים פירות'}>
          {round.fruits.map((fruit) => (
            <button
              type="button"
              key={fruit.id}
              onClick={() => handleFruit(fruit)}
              className={`word-garden-fruit ${picked.some((item) => item.id === fruit.id) ? 'is-picked' : ''}`}
              aria-label={english ? fruit.en : fruit.he}
            >
              <img src={fruit.image} alt="" draggable={false} />
            </button>
          ))}
        </div>
        ) : (
          <div className="word-garden-trail" aria-hidden="true">
            {round.stages.map((part, index) => <span className={index <= stageIndex ? 'is-grown' : ''} key={part.id} />)}
          </div>
        )}
        <div className="word-garden-tools">
          {!stage ? (
          <button
            type="button"
            className="word-garden-connector"
            onClick={handleConnector}
            aria-label={english ? 'Hear another way to connect the fruits' : 'לשמוע דרך נוספת לחבר בין הפירות'}
          >
            <span aria-hidden="true" className="word-garden-connector__pictures">
              <img src={(picked[0] ?? round.fruits[0]!).image} alt="" draggable={false} />
              <span className="word-garden-connector__join">+</span>
              <img src={(picked[1] ?? round.fruits[1]!).image} alt="" draggable={false} />
            </span>
          </button>
          ) : null}
          {micSupported && picked.length > 0 && (!stage || stage.id === 'ask') && !settings.quietMode ? (
            <button
              type="button"
              className={`word-garden-mic ${listening ? 'is-listening' : ''} ${heardVoice ? 'heard-voice' : ''}`}
              onClick={() => void handleMicrophone()}
              aria-label={english ? 'Optional: listen for a sound' : 'אפשר להקשיב לקול'}
            >
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <rect x="18" y="6" width="12" height="24" rx="6" fill="currentColor" />
                <path d="M12 24a12 12 0 0 0 24 0 M24 36v7 M17 43h14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </GameShell>
  );
}
