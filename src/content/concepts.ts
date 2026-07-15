import type { LearningConcept, PuzzleScene, SortingItemDefinition } from '../domain/types';

/**
 * Stable concept ids double as art-library lookup keys (see src/art/objects.tsx)
 * so content, speech, progression, and illustration all reference the same
 * identity. Do not rename an id without checking domain/rounds.ts, progression
 * history shape, and the art registry.
 */
export const learningConcepts: LearningConcept[] = [
  { id: 'ball', category: 'object', he: 'כדור', en: 'ball', audio: {} },
  { id: 'car', category: 'object', he: 'אוטו', en: 'car', audio: {} },
  { id: 'banana', category: 'object', he: 'בננה', en: 'banana', audio: {} },
  { id: 'apple', category: 'object', he: 'תפוח', en: 'apple', audio: {} },
  { id: 'book', category: 'object', he: 'ספר', en: 'book', audio: {} },
  { id: 'cup', category: 'object', he: 'כוס', en: 'cup', audio: {} },
  { id: 'shoe', category: 'object', he: 'נעל', en: 'shoe', audio: {} },
  { id: 'sun', category: 'object', he: 'שמש', en: 'sun', audio: {} },
  { id: 'flower', category: 'object', he: 'פרח', en: 'flower', audio: {} },
  { id: 'dog', category: 'animal', he: 'כלב', en: 'dog', audio: {} },
  { id: 'cat', category: 'animal', he: 'חתול', en: 'cat', audio: {} },
  { id: 'duck', category: 'animal', he: 'ברווז', en: 'duck', audio: {} },
  { id: 'fish', category: 'animal', he: 'דג', en: 'fish', audio: {} },
  { id: 'bird', category: 'animal', he: 'ציפור', en: 'bird', audio: {} },
  { id: 'bear', category: 'animal', he: 'דובי', en: 'bear', audio: {} },
];

export const countingConceptIds = ['apple', 'ball', 'banana', 'flower', 'sun', 'cup'];

export const sortingItems: SortingItemDefinition[] = [
  { id: 'red-circle', colorId: 'red', shapeId: 'circle', he: 'עיגול אדום', en: 'red circle' },
  { id: 'red-square', colorId: 'red', shapeId: 'square', he: 'ריבוע אדום', en: 'red square' },
  { id: 'red-triangle', colorId: 'red', shapeId: 'triangle', he: 'משולש אדום', en: 'red triangle' },
  { id: 'blue-circle', colorId: 'blue', shapeId: 'circle', he: 'עיגול כחול', en: 'blue circle' },
  { id: 'blue-square', colorId: 'blue', shapeId: 'square', he: 'ריבוע כחול', en: 'blue square' },
  { id: 'blue-star', colorId: 'blue', shapeId: 'star', he: 'כוכב כחול', en: 'blue star' },
  { id: 'green-circle', colorId: 'green', shapeId: 'circle', he: 'עיגול ירוק', en: 'green circle' },
  { id: 'green-triangle', colorId: 'green', shapeId: 'triangle', he: 'משולש ירוק', en: 'green triangle' },
  { id: 'green-star', colorId: 'green', shapeId: 'star', he: 'כוכב ירוק', en: 'green star' },
  { id: 'yellow-square', colorId: 'yellow', shapeId: 'square', he: 'ריבוע צהוב', en: 'yellow square' },
  { id: 'yellow-triangle', colorId: 'yellow', shapeId: 'triangle', he: 'משולש צהוב', en: 'yellow triangle' },
  { id: 'yellow-star', colorId: 'yellow', shapeId: 'star', he: 'כוכב צהוב', en: 'yellow star' },
];

export const puzzleScenes: PuzzleScene[] = [
  { id: 'fishy', titleHe: 'דג', titleEn: 'fish' },
  { id: 'sunny', titleHe: 'שמש', titleEn: 'sun' },
  { id: 'teddy', titleHe: 'דובי', titleEn: 'teddy' },
  { id: 'flower', titleHe: 'פרח', titleEn: 'flower' },
];
