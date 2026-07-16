import { createRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { sceneBackgroundImage } from '../art/puzzleScenes';
import { GameShell } from '../components/GameShell';
import { SuccessOverlay } from '../components/SuccessOverlay';
import { useMeasuredSize } from '../components/useMeasuredSize';
import { type DragItemState, useToddlerDrag } from '../components/drag/useToddlerDrag';
import { gameMeta } from '../content/games';
import { generatePuzzleRound } from '../domain/rounds';
import type { PuzzlePieceRound, PuzzleScene } from '../domain/types';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useRetryFeedback } from './useRetryFeedback';

const SPEECH_SCOPE = 'game:puzzle';

function pieceArtStyle(scene: PuzzleScene, rows: number, cols: number, piece: PuzzlePieceRound): CSSProperties {
  const x = cols === 1 ? '50%' : `${(piece.col / (cols - 1)) * 100}%`;
  const y = rows === 1 ? '50%' : `${(piece.row / (rows - 1)) * 100}%`;
  return {
    backgroundImage: sceneBackgroundImage(scene),
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${x} ${y}`,
  };
}

export function PuzzleGame({ domainProgress, settings, mediaReady, speechStatus, onBack, onCompleteRound }: ToddlerGameProps) {
  const [attempts, setAttempts] = useState(0);
  const [misses, setMisses] = useState(0);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [hintSlotId, setHintSlotId] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, DragItemState>>({});
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const size = useMeasuredSize(surfaceRef);

  const { round, roundKey, startNextRound } = useAdaptiveRound('puzzle', domainProgress, generatePuzzleRound);
  const { retryBusy, runRetry } = useRetryFeedback({ scope: SPEECH_SCOPE, roundKey, settings });
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;
  const zoneRefs = useMemo(
    () => Object.fromEntries(round.pieces.map((piece) => [piece.id, createRef<HTMLButtonElement>()])) as Record<string, RefObject<HTMLButtonElement | null>>,
    [round],
  );

  const boardSize = Math.min(size.width - 28, 300);
  const slotWidth = boardSize / round.cols;
  const slotHeight = boardSize / round.rows;

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
    const columns = Math.min(2, round.pieces.length);
    const gap = 14;
    const pieceWidth = slotWidth;
    const pieceHeight = slotHeight;
    const totalWidth = columns * pieceWidth + (columns - 1) * gap;
    const startX = Math.max(18, (size.width - totalWidth) / 2);
    const startY = boardSize + 38;

    setItems(
      Object.fromEntries(
        round.pieces.map((piece, index) => {
          const row = Math.floor(index / columns);
          const col = index % columns;
          const x = startX + col * (pieceWidth + gap);
          const y = startY + row * (pieceHeight + gap);
          return [piece.id, { x, y, homeX: x, homeY: y, width: pieceWidth, height: pieceHeight, locked: false }];
        }),
      ),
    );
  }, [boardSize, round, size.width, slotHeight, slotWidth]);

  useEffect(() => {
    setSolvedIds([]);
    setAttempts(0);
    setMisses(0);
    setCelebration(null);
    setHintSlotId(null);
    if (mediaReady) {
      void speakPromptRef.current();
    }
  }, [mediaReady, roundKey]);

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
      if (itemId !== zoneId) {
        const nextMisses = misses + 1;
        setMisses(nextMisses);
        if (nextMisses >= 2 && (settings.quietMode || !speechStatus.supported)) {
          setHintSlotId(itemId);
        }
        void runRetry({
          missCount: nextMisses,
          seed: `${roundKey}:${nextMisses}:${itemId}`,
          modelLines: [{
            he: nextMisses >= 2 ? 'החתיכה מתאימה למקום המואר. נסה שם.' : 'כמעט. נסה מקום אחר.',
            en: nextMisses >= 2 ? 'The piece fits in the glowing spot. Try there.' : 'Almost. Try another spot.',
            pauseAfterMs: 220,
            ...(nextMisses >= 2 ? { cue: `puzzle-slot:${itemId}` } : {}),
          }],
        }).finally(() => setHintSlotId(null));
        return false;
      }

      const zoneRect = zoneRefs[zoneId]?.current?.getBoundingClientRect();
      const surfaceRect = surfaceRef.current?.getBoundingClientRect();
      if (!zoneRect || !surfaceRect) {
        return false;
      }

      const x = zoneRect.left - surfaceRect.left;
      const y = zoneRect.top - surfaceRect.top;
      setItems((current) => ({
        ...current,
        [itemId]: { ...current[itemId]!, x, y, homeX: x, homeY: y, locked: true },
      }));
      const nextSolved = [...solvedIds, itemId];
      setSolvedIds(nextSolved);
      soundService.playSuccess(settings);

      if (nextSolved.length === round.pieces.length) {
        const summary = onCompleteRound({ attempts: nextAttempts, requiredActions: round.pieces.length, concepts: [round.scene.id] });
        setCelebration({
          seed: `puzzle-${round.scene.id}-${nextAttempts}`,
          targetSegments: buildPhraseSegments(round.scene.titleHe, round.scene.titleEn, settings.languageMode, settings.englishVoiceLocale),
          tier: summary.milestone ? 'milestone' : 'standard',
        });
      }
      return true;
    },
  });

  return (
    <GameShell
      ariaLabel={gameMeta.puzzle.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.puzzle.accentClass}
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
          <SuccessOverlay
            settings={settings}
            scope={SPEECH_SCOPE}
            seed={celebration.seed}
            targetSegments={celebration.targetSegments}
            tier={celebration.tier}
            onAdvance={() => {
              setCelebration(null);
              startNextRound();
            }}
          />
        ) : undefined
      }
    >
      <div ref={surfaceRef} className="drag-surface puzzle-surface" style={{ '--board-size': `${boardSize}px` } as CSSProperties}>
        <div className="puzzle-board" style={{ width: boardSize, height: boardSize }}>
          {round.pieces.map((piece) => (
            <button
              key={piece.id}
              ref={zoneRefs[piece.id]}
              className={`puzzle-slot ${hoverZoneId === piece.id ? 'is-zone-hover' : ''} ${hintSlotId === piece.id || speechStatus.activeCue === `puzzle-slot:${piece.id}` ? 'is-teaching-hint' : ''}`}
              type="button"
              style={{ width: slotWidth, height: slotHeight, left: piece.col * slotWidth, top: piece.row * slotHeight, ...pieceArtStyle(round.scene, round.rows, round.cols, piece) }}
              {...bindZone(piece.id)}
              aria-label={englishOnly ? `Place for puzzle piece ${piece.row + 1}-${piece.col + 1}` : `מקום לחתיכה ${piece.row + 1}-${piece.col + 1}`}
            />
          ))}
        </div>

        {round.pieces.map((piece) => {
          const state = items[piece.id];
          if (!state) {
            return null;
          }
          const isDragging = draggingId === piece.id;
          const isSelected = selectedId === piece.id;
          const isWiggling = wigglingId === piece.id;
          return (
            <button
              key={piece.id}
              className={`puzzle-piece ${isSelected ? 'is-selected' : ''} ${state.locked ? 'is-placed' : ''} ${isDragging ? 'is-dragging' : ''} ${isWiggling ? 'is-wiggling' : ''}`}
              style={{ width: state.width, height: state.height, left: `${state.x}px`, top: `${state.y}px`, ...pieceArtStyle(round.scene, round.rows, round.cols, piece) }}
              type="button"
              {...bindItem(piece.id)}
              aria-label={englishOnly ? `${round.scene.titleEn} puzzle piece` : `חתיכת פאזל של ${round.scene.titleHe}`}
            />
          );
        })}
      </div>
    </GameShell>
  );
}
