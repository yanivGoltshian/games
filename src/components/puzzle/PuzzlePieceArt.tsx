import { useId } from 'react';
import type { PuzzleScene } from '../../domain/types';
import { sceneImageHref } from '../../art/puzzleScenes';
import { buildPuzzlePiecePath } from '../../games/puzzleGeometry';

interface PuzzlePieceArtProps {
  scene: PuzzleScene;
  row: number;
  col: number;
  rows: number;
  cols: number;
}

export function PuzzlePieceArt({ scene, row, col, rows, cols }: PuzzlePieceArtProps) {
  const clipId = useId().replaceAll(':', '');
  const path = buildPuzzlePiecePath(row, col, rows, cols);

  return (
    <svg
      className="puzzle-piece-art"
      viewBox="-20 -20 140 140"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={path} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <image
          href={sceneImageHref(scene)}
          x={-col * 100}
          y={-row * 100}
          width={cols * 100}
          height={rows * 100}
          preserveAspectRatio="none"
        />
        <path className="puzzle-piece-art__shine" d={path} />
      </g>
      <path className="puzzle-piece-art__edge" d={path} />
    </svg>
  );
}
