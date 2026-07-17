import type { DomainProgress, PuzzleRound } from '../domain/types';

export const FAMILY_PHOTO_PROMPT_HE = 'בוא נמשיך.';
export const FAMILY_PHOTO_PROMPT_EN = "Let's do it again.";
export const FAMILY_PHOTO_SUCCESS_HE = 'יופי!';
export const FAMILY_PHOTO_SUCCESS_EN = 'Great!';

export function createFamilyPhotoRound(
  level: DomainProgress['level'],
  objectUrl: string,
): PuzzleRound {
  const [rows, cols] = level === 1 ? [1, 2] : level === 2 ? [2, 2] : [3, 3];
  const pieces = Array.from({ length: rows * cols }, (_, index) => ({
    id: `family-photo-piece-${index}`,
    row: Math.floor(index / cols),
    col: index % cols,
  }));

  return {
    scene: {
      id: 'family-photo',
      titleHe: FAMILY_PHOTO_SUCCESS_HE,
      titleHeSpoken: FAMILY_PHOTO_SUCCESS_HE,
      titleEn: FAMILY_PHOTO_SUCCESS_EN,
      promptHe: FAMILY_PHOTO_PROMPT_HE,
      promptHeSpoken: FAMILY_PHOTO_PROMPT_HE,
      promptEn: FAMILY_PHOTO_PROMPT_EN,
      image: { kind: 'family', href: objectUrl },
    },
    rows,
    cols,
    pieces,
    promptHe: FAMILY_PHOTO_PROMPT_HE,
    promptEn: FAMILY_PHOTO_PROMPT_EN,
  };
}
