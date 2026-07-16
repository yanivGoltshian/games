import { createRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { ShapeArt } from '../art/shapes';
import { GameShell } from '../components/GameShell';
import { useMeasuredSize } from '../components/useMeasuredSize';
import { type DragItemState, useToddlerDrag } from '../components/drag/useToddlerDrag';
import { gameMeta } from '../content/games';
import { buildSortingMissModelLine } from '../content/feedbackSpeech';
import { generateSortingRound } from '../domain/rounds';
import type { ColorId, ShapeId } from '../domain/types';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useRetryFeedback } from './useRetryFeedback';

const BASE_ITEM_SIZE = 96;
const SPEECH_SCOPE = 'game:sorting';

export function SortingGame({
  domainProgress,
  settings,
  mediaReady,
  speechStatus,
  onBack,
  onCompleteRound,
  onProgressionChoice,
}: ToddlerGameProps) {
  const [attempts, setAttempts] = useState(0);
  const [misses, setMisses] = useState(0);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [hintZoneId, setHintZoneId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Record<string, DragItemState>>({});
  const surfaceRef = useRef<HTMLDivElement>(null);
  const zoneGridRef = useRef<HTMLDivElement>(null);
  const lastSpokenSelection = useRef<string | null>(null);
  const size = useMeasuredSize(surfaceRef);

  const { round, roundKey, startNextRound } = useAdaptiveRound('sorting', domainProgress, generateSortingRound);
  const { retryBusy, runRetry } = useRetryFeedback({ scope: SPEECH_SCOPE, roundKey, settings });
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;
  const zoneRefs = useMemo(
    () => Object.fromEntries(round.bins.map((bin) => [bin.id, createRef<HTMLButtonElement>()])) as Record<string, RefObject<HTMLButtonElement | null>>,
    [round],
  );

  const speakPrompt = useCallback(async (interrupt = false): Promise<void> => {
    const segments = buildPhraseSegments(round.promptHe, round.promptEn, settings.languageMode, settings.englishVoiceLocale);
    await speechService.speakSegments(segments, settings, {
      scope: SPEECH_SCOPE,
      key: `prompt:${roundKey}`,
      priority: interrupt ? 'replay' : 'prompt',
      interrupt,
    });
  }, [round.promptEn, round.promptHe, roundKey, settings]);
  const speakPromptRef = useRef(speakPrompt);
  speakPromptRef.current = speakPrompt;

  useEffect(() => {
    const itemSize = Math.max(72, Math.min(140, Math.floor(Math.min(size.width, size.height) * 0.22))) || BASE_ITEM_SIZE;
    const columns = Math.min(3, round.items.length);
    const rows = Math.ceil(round.items.length / columns);
    const gap = 16;
    const totalWidth = columns * itemSize + (columns - 1) * gap;
    const startX = Math.max(18, (size.width - totalWidth) / 2);
    const zoneGridBottom = zoneGridRef.current?.getBoundingClientRect().bottom ?? 0;
    const surfaceTop = surfaceRef.current?.getBoundingClientRect().top ?? 0;
    const availableTop = zoneGridRef.current ? zoneGridBottom - surfaceTop + 20 : size.height * 0.55;
    const itemsBlockHeight = rows * itemSize + (rows - 1) * gap;
    const remaining = Math.max(0, size.height - availableTop - 16);
    const startY = availableTop + Math.max(0, (remaining - itemsBlockHeight) / 2);

    setItems(
      Object.fromEntries(
        round.items.map((item, index) => {
          const row = Math.floor(index / columns);
          const col = index % columns;
          const x = startX + col * (itemSize + gap);
          const y = startY + row * (itemSize + gap);
          return [item.id, { x, y, homeX: x, homeY: y, width: itemSize, height: itemSize, locked: false }];
        }),
      ),
    );
  }, [round, size.height, size.width]);

  useEffect(() => {
    setPlacements({});
    setAttempts(0);
    setMisses(0);
    setCelebration(null);
    setHintZoneId(null);
    lastSpokenSelection.current = null;
    if (mediaReady) {
      void speakPromptRef.current();
    }
  }, [mediaReady, roundKey]);

  const getSnapPosition = (itemId: string, zoneId: string, placementIndex: number) => {
    const zoneRect = zoneRefs[zoneId]?.current?.getBoundingClientRect();
    const surfaceRect = surfaceRef.current?.getBoundingClientRect();
    if (!zoneRect || !surfaceRect) {
      return null;
    }

    const itemSize = items[itemId]?.width ?? BASE_ITEM_SIZE;
    const slotX = zoneRect.left - surfaceRect.left + 16 + (placementIndex % 2) * (itemSize * 0.68);
    const slotY = zoneRect.top - surfaceRect.top + 72 + Math.floor(placementIndex / 2) * (itemSize * 0.52);
    return { x: slotX, y: slotY };
  };

  const { bindItem, bindZone, selectedId, draggingId, hoverZoneId, wigglingId } = useToddlerDrag({
    surfaceRef,
    items,
    setItems,
    zones: zoneRefs,
    disabled: retryBusy,
    onDrop: (itemId, zoneId) => {
      if (retryBusy) {
        return false;
      }
      speechService.supersedeRetry(SPEECH_SCOPE);
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      const definition = round.items.find((item) => item.id === itemId);
      const isMatch = definition ? (round.rule === 'color' ? definition.colorId === zoneId : definition.shapeId === zoneId) : false;
      if (!isMatch) {
        const nextMisses = misses + 1;
        setMisses(nextMisses);
        const targetId = definition ? (round.rule === 'color' ? definition.colorId : definition.shapeId) : null;
        const targetBin = round.bins.find((bin) => bin.id === targetId);
        if (targetBin) {
          if (settings.quietMode || !speechStatus.supported) {
            setHintZoneId(targetBin.id);
          }
          const modelLine = buildSortingMissModelLine(
            round.rule,
            targetBin.labelHe,
            targetBin.labelEn,
            `sort-zone:${targetBin.id}`,
          );
          void runRetry({
            missCount: nextMisses,
            seed: `${roundKey}:${nextMisses}:${itemId}`,
            modelLines: [modelLine],
          }).finally(() => setHintZoneId(null));
        }
        return false;
      }

      const placementIndex = Object.values(placements).filter((value) => value === zoneId).length;
      const snapPosition = getSnapPosition(itemId, zoneId, placementIndex);
      if (!snapPosition) {
        return false;
      }

      setPlacements((current) => ({ ...current, [itemId]: zoneId }));
      setItems((current) => ({
        ...current,
        [itemId]: {
          ...current[itemId]!,
          x: snapPosition.x,
          y: snapPosition.y,
          homeX: snapPosition.x,
          homeY: snapPosition.y,
          locked: true,
        },
      }));
      soundService.playSuccess(settings);

      if (Object.keys(placements).length + 1 === round.items.length) {
        const summary = onCompleteRound({
          attempts: nextAttempts,
          requiredActions: round.items.length,
          concepts: round.items.map((item) => item.id),
        });
        const lastItemLabel = definition ? buildPhraseSegments(definition.he, definition.en, settings.languageMode, settings.englishVoiceLocale) : [];
        setCelebration({
          seed: `sorting-${round.rule}-${nextAttempts}`,
          targetSegments: lastItemLabel,
          tier: summary.milestone ? 'milestone' : 'standard',
          recommendation: summary.recommendation,
        });
      }
      return true;
    },
  });

  // Labeling tap: naming the object as soon as it is selected/picked up.
  useEffect(() => {
    if (!selectedId || selectedId === lastSpokenSelection.current || !mediaReady) {
      return;
    }
    lastSpokenSelection.current = selectedId;
    const definition = round.items.find((item) => item.id === selectedId);
    if (definition) {
      void speechService.speakSegments(
        buildPhraseSegments(definition.he, definition.en, settings.languageMode, settings.englishVoiceLocale),
        settings,
        { scope: SPEECH_SCOPE, key: 'selection-label', priority: 'label' },
      );
    }
  }, [selectedId, round.items, settings, mediaReady]);

  return (
    <GameShell
      ariaLabel={gameMeta.sorting.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.sorting.accentClass}
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
            onProgressionChoice={onProgressionChoice}
            startNextRound={startNextRound}
          />
        ) : undefined
      }
    >
      <div ref={surfaceRef} className="drag-surface sorting-surface">
        <div className="sort-zone-grid" ref={zoneGridRef}>
          {round.bins.map((bin) => (
            <button
              key={bin.id}
              ref={zoneRefs[bin.id]}
              className={`sort-zone ${hoverZoneId === bin.id ? 'is-zone-hover' : ''} ${hintZoneId === bin.id || speechStatus.activeCue === `sort-zone:${bin.id}` ? 'is-teaching-hint' : ''}`}
              type="button"
              {...bindZone(bin.id)}
              aria-label={englishOnly ? `${bin.labelEn} basket` : `סל ${bin.labelHe}`}
            >
              <ShapeArt
                className="sort-zone__art"
                shapeId={bin.rule === 'shape' ? (bin.id as ShapeId) : 'circle'}
                colorId={bin.rule === 'color' ? (bin.id as ColorId) : 'blue'}
              />
            </button>
          ))}
        </div>

        {round.items.map((item) => {
          const state = items[item.id];
          if (!state) {
            return null;
          }
          const isDragging = draggingId === item.id;
          const isSelected = selectedId === item.id;
          const isWiggling = wigglingId === item.id;
          return (
            <button
              key={item.id}
              className={`draggable-chip ${isSelected ? 'is-selected' : ''} ${state.locked ? 'is-placed' : ''} ${isDragging ? 'is-dragging' : ''} ${isWiggling ? 'is-wiggling' : ''}`}
              style={{ left: `${state.x}px`, top: `${state.y}px`, width: state.width, height: state.height } as CSSProperties}
              type="button"
              {...bindItem(item.id)}
              aria-label={englishOnly ? item.en : item.he}
            >
              <ShapeArt shapeId={item.shapeId} colorId={item.colorId} className="draggable-chip__art" />
            </button>
          );
        })}
      </div>
    </GameShell>
  );
}
