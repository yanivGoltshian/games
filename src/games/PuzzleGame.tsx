import { createRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { GameShell } from '../components/GameShell';
import { PuzzlePieceArt } from '../components/puzzle/PuzzlePieceArt';
import { useMeasuredSize } from '../components/useMeasuredSize';
import { type DragItemState, useToddlerDrag } from '../components/drag/useToddlerDrag';
import { gameMeta } from '../content/games';
import { buildPuzzleMissModelLine } from '../content/feedbackSpeech';
import { generatePuzzleRound, getPuzzleRoundSignature } from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import { computePuzzleLayout } from './puzzleGeometry';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useRetryFeedback } from './useRetryFeedback';

const SPEECH_SCOPE = 'game:puzzle';

export function PuzzleGame({
  domainProgress,
  settings,
  mediaReady,
  speechStatus,
  onBack,
  onCompleteRound,
}: ToddlerGameProps) {
  const [attempts, setAttempts] = useState(0);
  const [misses, setMisses] = useState(0);
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null);
  const [hintSlotId, setHintSlotId] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, DragItemState>>({});
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const size = useMeasuredSize(surfaceRef);

  const { round, roundKey, startNextRound } = useAdaptiveRound(
    'puzzle',
    domainProgress,
    generatePuzzleRound,
    { getSignature: getPuzzleRoundSignature, limit: 8 },
  );
  const { retryBusy, runRetry } = useRetryFeedback({ scope: SPEECH_SCOPE, roundKey, settings });
  const englishOnly = settings.languageMode === 'en';
  const prompt = englishOnly ? round.promptEn : round.promptHe;
  const zoneRefs = useMemo(
    () => Object.fromEntries(round.pieces.map((piece) => [piece.id, createRef<HTMLButtonElement>()])) as Record<string, RefObject<HTMLButtonElement | null>>,
    [round],
  );

  const layout = useMemo(
    () => computePuzzleLayout(size.width, size.height, round.rows, round.cols, round.pieces.length),
    [round.cols, round.pieces.length, round.rows, size.height, size.width],
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
    if (layout.boardSize <= 0) {
      return;
    }
    setItems((current) => Object.fromEntries(
      round.pieces.map((piece, index) => {
        const previous = current[piece.id];
        const home = layout.homes[index]!;
        const snappedX = layout.boardX + piece.col * layout.pieceWidth;
        const snappedY = layout.boardY + piece.row * layout.pieceHeight;
        return [
          piece.id,
          {
            x: previous?.locked ? snappedX : home.x,
            y: previous?.locked ? snappedY : home.y,
            homeX: previous?.locked ? snappedX : home.x,
            homeY: previous?.locked ? snappedY : home.y,
            width: layout.pieceWidth,
            height: layout.pieceHeight,
            locked: previous?.locked ?? false,
          },
        ];
      }),
    ));
  }, [layout, round.pieces]);

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
          modelLines: [buildPuzzleMissModelLine(nextMisses, `puzzle-slot:${itemId}`)],
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
          recommendation: summary.recommendation,
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
      <div
        ref={surfaceRef}
        className={`drag-surface puzzle-surface puzzle-surface--${layout.orientation}`}
        style={{ '--board-size': `${layout.boardSize}px` } as CSSProperties}
      >
        <div
          className="puzzle-board"
          style={{
            width: layout.boardSize,
            height: layout.boardSize,
            left: layout.boardX,
            top: layout.boardY,
          }}
        >
          {round.pieces.map((piece) => (
            <button
              key={piece.id}
              ref={zoneRefs[piece.id]}
              className={`puzzle-slot ${hoverZoneId === piece.id ? 'is-zone-hover' : ''} ${hintSlotId === piece.id || speechStatus.activeCue === `puzzle-slot:${piece.id}` ? 'is-teaching-hint' : ''}`}
              type="button"
              style={{
                width: layout.pieceWidth,
                height: layout.pieceHeight,
                left: piece.col * layout.pieceWidth,
                top: piece.row * layout.pieceHeight,
              }}
              {...bindZone(piece.id)}
              aria-label={englishOnly ? `Place for puzzle piece ${piece.row + 1}-${piece.col + 1}` : `מקום לחתיכה ${piece.row + 1}-${piece.col + 1}`}
            >
              <PuzzlePieceArt scene={round.scene} row={piece.row} col={piece.col} rows={round.rows} cols={round.cols} />
            </button>
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
              style={{ width: state.width, height: state.height, left: `${state.x}px`, top: `${state.y}px` }}
              type="button"
              {...bindItem(piece.id)}
              aria-label={englishOnly ? `${round.scene.titleEn} puzzle piece` : `חתיכת פאזל של ${round.scene.titleHe}`}
            >
              <PuzzlePieceArt scene={round.scene} row={piece.row} col={piece.col} rows={round.rows} cols={round.cols} />
            </button>
          );
        })}
      </div>
    </GameShell>
  );
}
