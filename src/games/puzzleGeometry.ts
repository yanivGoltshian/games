export type PuzzleEdge = -1 | 0 | 1;

export interface PuzzlePieceEdges {
  top: PuzzleEdge;
  right: PuzzleEdge;
  bottom: PuzzleEdge;
  left: PuzzleEdge;
}

export interface PuzzleLayoutPoint {
  x: number;
  y: number;
}

export interface PuzzleLayout {
  orientation: 'portrait' | 'landscape';
  boardX: number;
  boardY: number;
  boardSize: number;
  pieceWidth: number;
  pieceHeight: number;
  homes: PuzzleLayoutPoint[];
}

const EDGE_START = 40;
const EDGE_END = 60;
const TAB_DEPTH = 18;

function horizontalJoin(row: number, col: number): PuzzleEdge {
  return (row + col) % 2 === 0 ? 1 : -1;
}

function verticalJoin(row: number, col: number): PuzzleEdge {
  return (row + col) % 2 === 0 ? -1 : 1;
}

export function getPuzzlePieceEdges(row: number, col: number, rows: number, cols: number): PuzzlePieceEdges {
  return {
    top: row === 0 ? 0 : (verticalJoin(row - 1, col) * -1) as PuzzleEdge,
    right: col === cols - 1 ? 0 : horizontalJoin(row, col),
    bottom: row === rows - 1 ? 0 : verticalJoin(row, col),
    left: col === 0 ? 0 : (horizontalJoin(row, col - 1) * -1) as PuzzleEdge,
  };
}

export function buildPuzzlePiecePath(row: number, col: number, rows: number, cols: number): string {
  const edges = getPuzzlePieceEdges(row, col, rows, cols);
  const topY = -TAB_DEPTH * edges.top;
  const rightX = 100 + TAB_DEPTH * edges.right;
  const bottomY = 100 + TAB_DEPTH * edges.bottom;
  const leftX = -TAB_DEPTH * edges.left;

  return [
    'M 0 0',
    `L ${EDGE_START} 0`,
    edges.top === 0
      ? `L ${EDGE_END} 0`
      : `C 43 0 42 ${topY} 50 ${topY} C 58 ${topY} 57 0 ${EDGE_END} 0`,
    'L 100 0',
    `L 100 ${EDGE_START}`,
    edges.right === 0
      ? `L 100 ${EDGE_END}`
      : `C 100 43 ${rightX} 42 ${rightX} 50 C ${rightX} 58 100 57 100 ${EDGE_END}`,
    'L 100 100',
    `L ${EDGE_END} 100`,
    edges.bottom === 0
      ? `L ${EDGE_START} 100`
      : `C 57 100 58 ${bottomY} 50 ${bottomY} C 42 ${bottomY} 43 100 ${EDGE_START} 100`,
    'L 0 100',
    `L 0 ${EDGE_END}`,
    edges.left === 0
      ? `L 0 ${EDGE_START}`
      : `C 0 57 ${leftX} 58 ${leftX} 50 C ${leftX} 42 0 43 0 ${EDGE_START}`,
    'Z',
  ].join(' ');
}

function boundedBoardSize(value: number): number {
  return Math.max(0, Math.min(420, value));
}

export function computePuzzleLayout(
  width: number,
  height: number,
  rows: number,
  cols: number,
  pieceCount: number,
): PuzzleLayout {
  const orientation = width > height ? 'landscape' : 'portrait';
  const padding = Math.min(18, Math.max(8, Math.min(width, height) * 0.025));
  const gap = Math.min(16, Math.max(8, Math.min(width, height) * 0.02));
  const trayColumns = orientation === 'portrait' ? Math.min(cols, pieceCount) : Math.min(2, pieceCount);
  const trayRows = Math.ceil(pieceCount / Math.max(1, trayColumns));

  let boardSize: number;
  if (orientation === 'portrait') {
    const widthLimit = Math.min(
      width - padding * 2,
      ((width - padding * 2 - gap * Math.max(0, trayColumns - 1)) * cols) / Math.max(1, trayColumns),
    );
    const heightLimit =
      (height - padding * 2 - gap * trayRows) /
      (1 + trayRows / rows);
    boardSize = boundedBoardSize(Math.min(widthLimit, heightLimit));
  } else {
    const widthLimit =
      (width - padding * 2 - gap * trayColumns) /
      (1 + trayColumns / cols);
    const trayHeightLimit =
      ((height - padding * 2 - gap * Math.max(0, trayRows - 1)) * rows) /
      Math.max(1, trayRows);
    boardSize = boundedBoardSize(Math.min(widthLimit, trayHeightLimit, height - padding * 2));
  }

  const pieceWidth = boardSize / cols;
  const pieceHeight = boardSize / rows;
  const trayWidth = trayColumns * pieceWidth + Math.max(0, trayColumns - 1) * gap;
  const trayHeight = trayRows * pieceHeight + Math.max(0, trayRows - 1) * gap;

  let boardX: number;
  let boardY: number;
  let trayX: number;
  let trayY: number;
  if (orientation === 'portrait') {
    boardX = (width - boardSize) / 2;
    boardY = Math.max(padding, (height - boardSize - gap - trayHeight) / 2);
    trayX = (width - trayWidth) / 2;
    trayY = boardY + boardSize + gap;
  } else {
    const totalWidth = boardSize + gap + trayWidth;
    boardX = Math.max(padding, (width - totalWidth) / 2);
    boardY = (height - boardSize) / 2;
    trayX = boardX + boardSize + gap;
    trayY = (height - trayHeight) / 2;
  }

  const homes = Array.from({ length: pieceCount }, (_, index) => ({
    x: trayX + (index % trayColumns) * (pieceWidth + gap),
    y: trayY + Math.floor(index / trayColumns) * (pieceHeight + gap),
  }));

  return { orientation, boardX, boardY, boardSize, pieceWidth, pieceHeight, homes };
}
