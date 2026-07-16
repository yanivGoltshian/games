import { describe, expect, it } from 'vitest';
import { buildPuzzlePiecePath, computePuzzleLayout, getPuzzlePieceEdges } from './puzzleGeometry';

describe('puzzle geometry', () => {
  it('creates complementary tabs and sockets for every shared edge', () => {
    const rows = 3;
    const cols = 3;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const edges = getPuzzlePieceEdges(row, col, rows, cols);
        if (col < cols - 1) {
          expect(edges.right).toBe(-getPuzzlePieceEdges(row, col + 1, rows, cols).left);
        }
        if (row < rows - 1) {
          expect(edges.bottom).toBe(-getPuzzlePieceEdges(row + 1, col, rows, cols).top);
        }
        expect(buildPuzzlePiecePath(row, col, rows, cols)).toMatch(/^M 0 0.+Z$/);
      }
    }
  });

  it.each([
    ['portrait 2x2', 768, 1024, 2, 2, 4],
    ['portrait 3x3', 768, 1024, 3, 3, 9],
    ['landscape 2x2', 1024, 768, 2, 2, 4],
    ['landscape 3x3', 1024, 768, 3, 3, 9],
    ['short landscape 3x3', 844, 390, 3, 3, 9],
  ] as const)('keeps every piece inside a %s viewport', (_name, width, height, rows, cols, count) => {
    const layout = computePuzzleLayout(width, height, rows, cols, count);
    expect(layout.boardSize).toBeGreaterThan(0);
    expect(layout.pieceWidth).toBeGreaterThanOrEqual(44);
    expect(layout.pieceHeight).toBeGreaterThanOrEqual(44);
    expect(layout.boardX).toBeGreaterThanOrEqual(0);
    expect(layout.boardY).toBeGreaterThanOrEqual(0);
    expect(layout.boardX + layout.boardSize).toBeLessThanOrEqual(width);
    expect(layout.boardY + layout.boardSize).toBeLessThanOrEqual(height);
    layout.homes.forEach((home) => {
      expect(home.x).toBeGreaterThanOrEqual(0);
      expect(home.y).toBeGreaterThanOrEqual(0);
      expect(home.x + layout.pieceWidth).toBeLessThanOrEqual(width);
      expect(home.y + layout.pieceHeight).toBeLessThanOrEqual(height);
    });
  });
});
