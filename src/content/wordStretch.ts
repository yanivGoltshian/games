import { requireLearningConcept } from './concepts';

export interface WordStretchWord {
  conceptId: string;
  stretchedHe: string;
  stretchedEn: string;
  leadSeconds: number;
}

export const WORD_STRETCH_WORDS: readonly WordStretchWord[] = [
  { conceptId: 'dog', stretchedHe: 'כֶּאאאאא־לֶב', stretchedEn: 'dooooog', leadSeconds: 0.18 },
  { conceptId: 'cat', stretchedHe: 'חָאאאאא־תוּל', stretchedEn: 'caaaaat', leadSeconds: 0.2 },
  { conceptId: 'ball', stretchedHe: 'כַּאאאאא־דּוּר', stretchedEn: 'baaaaall', leadSeconds: 0.18 },
  { conceptId: 'banana', stretchedHe: 'בָּאאאאא־נָנָה', stretchedEn: 'baaaa-nana', leadSeconds: 0.2 },
  { conceptId: 'apple', stretchedHe: 'תַּאאאאא־פּוּחַ', stretchedEn: 'aaaaapple', leadSeconds: 0.18 },
  { conceptId: 'shoe', stretchedHe: 'נָאאאאא־עַל', stretchedEn: 'shoooooe', leadSeconds: 0.2 },
  { conceptId: 'duck', stretchedHe: 'בַּאאאאא־רְוָז', stretchedEn: 'duuuuuck', leadSeconds: 0.18 },
  { conceptId: 'rabbit', stretchedHe: 'אַאאאאא־רְנָב', stretchedEn: 'raaaaabbit', leadSeconds: 0.2 },
  { conceptId: 'orange', stretchedHe: 'תַּאאאאא־פּוּז', stretchedEn: 'ooooorange', leadSeconds: 0.18 },
  { conceptId: 'elephant', stretchedHe: 'פִּייייי־ל', stretchedEn: 'eeeeelephant', leadSeconds: 0.2 },
  { conceptId: 'flower', stretchedHe: 'פֶּאאאאא־רַח', stretchedEn: 'flooooower', leadSeconds: 0.2 },
  { conceptId: 'train', stretchedHe: 'רַאאאאא־כֶּבֶת', stretchedEn: 'traaaaain', leadSeconds: 0.2 },
  { conceptId: 'tree', stretchedHe: 'עֵאאאאא־ץ', stretchedEn: 'treeeeee', leadSeconds: 0.18 },
];

export function requireWordStretchWord(conceptId: string): WordStretchWord {
  const word = WORD_STRETCH_WORDS.find((entry) => entry.conceptId === conceptId);
  if (!word) {
    throw new Error(`Unknown word-stretch concept: ${conceptId}`);
  }
  return word;
}

export function wordStretchConceptIdsForLevel(level: 1 | 2 | 3): string[] {
  return WORD_STRETCH_WORDS
    .filter((word) => requireLearningConcept(word.conceptId).introducedAtLevel <= level)
    .map((word) => word.conceptId);
}
