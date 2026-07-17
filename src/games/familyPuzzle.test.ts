import { describe, expect, it } from 'vitest';
import { createFamilyPhotoRound } from './familyPuzzle';

describe('createFamilyPhotoRound', () => {
  it.each([
    [1, 1, 2, 2],
    [2, 2, 2, 4],
    [3, 3, 3, 9],
  ] as const)('reuses level %i progression', (level, rows, cols, pieceCount) => {
    const round = createFamilyPhotoRound(level, 'blob:synthetic-family-photo');

    expect(round).toMatchObject({
      rows,
      cols,
      promptHe: 'בוא נמשיך.',
      promptEn: "Let's do it again.",
      scene: {
        id: 'family-photo',
        titleHe: 'יופי!',
        titleEn: 'Great!',
        image: {
          kind: 'family',
          href: 'blob:synthetic-family-photo',
        },
      },
    });
    expect(round.pieces).toHaveLength(pieceCount);
    expect(new Set(round.pieces.map((piece) => piece.id)).size).toBe(pieceCount);
  });
});
