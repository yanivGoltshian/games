import { createRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { sceneImageHref } from '../art/puzzleScenes';
import { GameShell } from '../components/GameShell';
import { PuzzlePieceArt } from '../components/puzzle/PuzzlePieceArt';
import { useFamilyPhotoPreviews } from '../components/useFamilyPhotoPreviews';
import { useMeasuredSize } from '../components/useMeasuredSize';
import { type DragItemState, useToddlerDrag } from '../components/drag/useToddlerDrag';
import { puzzleScenes } from '../content/concepts';
import { gameMeta } from '../content/games';
import { buildPuzzleMissModelLine } from '../content/feedbackSpeech';
import { generatePuzzleRound, getPuzzleRoundSignature } from '../domain/rounds';
import { soundService } from '../services/sound';
import { buildPhraseSegments, speechService } from '../services/speech';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import { RoundSuccessOverlay } from './RoundSuccessOverlay';
import { createFamilyPhotoRound, nextPuzzleLevel, type PuzzleLevel } from './familyPuzzle';
import { computePuzzleLayout } from './puzzleGeometry';
import { useAdaptiveRound } from './useAdaptiveRound';
import { useRetryFeedback } from './useRetryFeedback';

const SPEECH_SCOPE = 'game:puzzle';

type PuzzleExperience =
  | { kind: 'deciding' }
  | { kind: 'choose' }
  | { kind: 'built-in' }
  | { kind: 'family'; photoId: string };

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
  const [experience, setExperience] = useState<PuzzleExperience>({ kind: 'deciding' });
  const [puzzleLevel, setPuzzleLevel] = useState<PuzzleLevel>(1);
  const [arrangementIndex, setArrangementIndex] = useState(0);
  const pendingPuzzleLevelRef = useRef<PuzzleLevel>(1);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const playing = experience.kind === 'built-in' || experience.kind === 'family';
  const size = useMeasuredSize(surfaceRef, playing);
  const {
    previews: familyPhotos,
    loading: familyPhotosLoading,
    error: familyPhotosError,
    reload: reloadFamilyPhotos,
  } = useFamilyPhotoPreviews();

  const puzzleProgress = useMemo(
    () => ({ ...domainProgress, level: puzzleLevel }),
    [domainProgress, puzzleLevel],
  );
  const {
    round: builtInRound,
    roundKey: builtInRoundKey,
    startNextRound,
  } = useAdaptiveRound(
    'puzzle',
    puzzleProgress,
    generatePuzzleRound,
    { getSignature: getPuzzleRoundSignature, limit: 8 },
  );
  const selectedFamilyPhoto = experience.kind === 'family'
    ? familyPhotos.find((photo) => photo.id === experience.photoId) ?? null
    : null;
  const familyRound = useMemo(
    () => selectedFamilyPhoto
      ? createFamilyPhotoRound(puzzleLevel, selectedFamilyPhoto.objectUrl)
      : null,
    [puzzleLevel, selectedFamilyPhoto],
  );
  const round = familyRound ?? builtInRound;
  const roundKey = experience.kind === 'family'
    ? `family:${experience.photoId}:${puzzleLevel}:${arrangementIndex}`
    : `built-in:${builtInRoundKey}`;
  const itemsRoundKeyRef = useRef(roundKey);
  const { retryBusy, runRetry } = useRetryFeedback({ scope: SPEECH_SCOPE, roundKey, settings });
  const englishOnly = settings.languageMode === 'en';
  const prompt = playing
    ? (englishOnly ? round.promptEn : round.promptHe)
    : (englishOnly ? 'Choose a picture puzzle' : 'בוחרים פאזל תמונה');
  const zoneRefs = useMemo(
    () => Object.fromEntries(round.pieces.map((piece) => [piece.id, createRef<HTMLButtonElement>()])) as Record<string, RefObject<HTMLButtonElement | null>>,
    [round],
  );
  const loosePieces = useMemo(() => {
    if (round.pieces.length < 2) {
      return round.pieces;
    }
    const shift = arrangementIndex % round.pieces.length;
    return [...round.pieces.slice(shift), ...round.pieces.slice(0, shift)];
  }, [arrangementIndex, round.pieces]);

  useEffect(() => {
    if (experience.kind !== 'deciding' || familyPhotosLoading || familyPhotosError) {
      return;
    }
    setExperience({ kind: familyPhotos.length > 0 ? 'choose' : 'built-in' });
  }, [experience.kind, familyPhotos.length, familyPhotosError, familyPhotosLoading]);

  useEffect(() => {
    if (experience.kind === 'family' && !selectedFamilyPhoto && !familyPhotosLoading) {
      setExperience({ kind: familyPhotos.length > 0 ? 'choose' : 'built-in' });
    }
  }, [experience.kind, familyPhotos.length, familyPhotosLoading, selectedFamilyPhoto]);

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
    const preservePlacedPieces = itemsRoundKeyRef.current === roundKey;
    itemsRoundKeyRef.current = roundKey;
    setItems((current) => Object.fromEntries(
      loosePieces.map((piece, index) => {
        const previous = preservePlacedPieces ? current[piece.id] : undefined;
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
  }, [layout, loosePieces, roundKey]);

  useEffect(() => {
    setSolvedIds([]);
    setAttempts(0);
    setMisses(0);
    setCelebration(null);
    setHintSlotId(null);
    pendingPuzzleLevelRef.current = puzzleLevel;
    if (mediaReady && playing) {
      void speakPromptRef.current();
    }
  }, [mediaReady, playing, puzzleLevel, roundKey]);

  const { bindItem, bindZone, selectedId, draggingId, hoverZoneId, wigglingId } = useToddlerDrag({
    surfaceRef,
    items,
    setItems,
    zones: zoneRefs,
    disabled: retryBusy || !playing,
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
        pendingPuzzleLevelRef.current = nextPuzzleLevel(puzzleLevel);
        const summary = onCompleteRound({
          attempts: nextAttempts,
          requiredActions: round.pieces.length,
          concepts: [round.scene.image.kind === 'family' ? 'family-photo' : round.scene.id],
        });
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

  const chooseBuiltInPuzzle = useCallback(() => {
    startNextRound(puzzleProgress);
    setExperience({ kind: 'built-in' });
  }, [puzzleProgress, startNextRound]);
  const startNextPuzzle = useCallback(() => {
    const nextLevel = pendingPuzzleLevelRef.current;
    setPuzzleLevel(nextLevel);
    setArrangementIndex((current) => current + 1);
    if (experience.kind === 'built-in') {
      startNextRound({ ...domainProgress, level: nextLevel });
    }
  }, [domainProgress, experience.kind, startNextRound]);
  const restartPuzzle = useCallback(() => {
    speechService.cancelScope(SPEECH_SCOPE);
    setCelebration(null);
    pendingPuzzleLevelRef.current = puzzleLevel;
    setArrangementIndex((current) => current + 1);
    if (experience.kind === 'built-in') {
      startNextRound({ ...domainProgress, level: puzzleLevel });
    }
  }, [domainProgress, experience.kind, puzzleLevel, startNextRound]);

  const selectionShell = (
    <GameShell
      ariaLabel={gameMeta.puzzle.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.puzzle.accentClass}
      reducedMotion={settings.reducedMotion}
      onHome={onBack}
      restartLabel={englishOnly ? 'New game' : 'משחק חדש'}
      homeLabel={englishOnly ? 'Back home' : 'חזרה לבית'}
      liveStatus={prompt}
    >
      {familyPhotosError ? (
        <div className="family-puzzle-state" role="alert">
          <p>{englishOnly ? 'The local photo library is unavailable.' : 'ספריית התמונות המקומית אינה זמינה.'}</p>
          <div className="family-puzzle-state__actions">
            <button className="secondary-button" onClick={reloadFamilyPhotos} type="button">
              {englishOnly ? 'Try again' : 'לנסות שוב'}
            </button>
            <button
              className="puzzle-photo-choice puzzle-photo-choice--built-in"
              onClick={chooseBuiltInPuzzle}
              type="button"
              aria-label={englishOnly ? 'Play with built-in pictures' : 'פאזל עם התמונות המובנות'}
            >
              <img alt="" aria-hidden="true" src={sceneImageHref(puzzleScenes[0]!)} />
            </button>
          </div>
        </div>
      ) : familyPhotosLoading || experience.kind === 'deciding' ? (
        <div className="family-puzzle-state" aria-live="polite">
          <p>{englishOnly ? 'Preparing local pictures…' : 'מכינים את התמונות המקומיות…'}</p>
        </div>
      ) : (
        <div className="puzzle-photo-selection" aria-label={prompt}>
          <button
            className="puzzle-photo-choice puzzle-photo-choice--built-in"
            data-puzzle-source="built-in"
            onClick={chooseBuiltInPuzzle}
            type="button"
            aria-label={englishOnly ? 'Play with built-in pictures' : 'פאזל עם התמונות המובנות'}
          >
            <img alt="" aria-hidden="true" src={sceneImageHref(puzzleScenes[0]!)} />
          </button>
          {familyPhotos.map((photo, index) => (
            <button
              className="puzzle-photo-choice"
              data-family-photo-choice={photo.id}
              key={photo.id}
              onClick={() => setExperience({ kind: 'family', photoId: photo.id })}
              type="button"
              aria-label={englishOnly ? `Family photo ${index + 1}` : `תמונה משפחתית ${index + 1}`}
            >
              <img alt="" aria-hidden="true" src={photo.objectUrl} />
            </button>
          ))}
        </div>
      )}
    </GameShell>
  );

  if (!playing) {
    return selectionShell;
  }

  return (
    <GameShell
      ariaLabel={gameMeta.puzzle.title}
      languageMode={settings.languageMode}
      accentClass={gameMeta.puzzle.accentClass}
      reducedMotion={settings.reducedMotion}
      onHome={onBack}
      onRestart={restartPuzzle}
      restartLabel={englishOnly ? 'New game' : 'משחק חדש'}
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
            startNextRound={startNextPuzzle}
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

        {loosePieces.map((piece) => {
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
