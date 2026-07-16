import { countingConceptIds, learningConcepts, puzzleScenes, sortingItems } from '../content/concepts';
import { buildPracticeWeights, createInitialConceptStat } from './progression';
import { createSeededRandom, pickWeightedUnique } from './rng';
import type {
  ColorId,
  CountingRound,
  DomainProgress,
  ListeningRound,
  MemoryRound,
  PuzzleRound,
  ShapeId,
  SortingRound,
  SortingRule,
} from './types';

export const NUMBER_WORDS_HE = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];
export const NUMBER_WORDS_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

const listeningStages: string[][] = [
  ['ball', 'car', 'banana', 'dog', 'cat', 'apple'],
  ['ball', 'car', 'banana', 'dog', 'cat', 'apple', 'shoe'],
  learningConcepts.map((concept) => concept.id),
];

const memoryStages: string[][] = [
  ['ball', 'car', 'banana', 'dog', 'cat', 'apple'],
  ['ball', 'car', 'banana', 'dog', 'cat', 'apple', 'shoe'],
  learningConcepts.map((concept) => concept.id),
];

const colorLabels: Record<ColorId, { he: string; en: string }> = {
  red: { he: 'אדום', en: 'red' },
  blue: { he: 'כחול', en: 'blue' },
  green: { he: 'ירוק', en: 'green' },
  yellow: { he: 'צהוב', en: 'yellow' },
};

const shapeLabels: Record<ShapeId, { he: string; en: string }> = {
  circle: { he: 'עיגול', en: 'circle' },
  square: { he: 'ריבוע', en: 'square' },
  triangle: { he: 'משולש', en: 'triangle' },
  star: { he: 'כוכב', en: 'star' },
};

function conceptById(id: string) {
  const concept = learningConcepts.find((item) => item.id === id);
  if (!concept) {
    throw new Error(`Unknown concept: ${id}`);
  }
  return concept;
}

function uniqueNumberOptions(random: ReturnType<typeof createSeededRandom>, target: number, max: number, optionCount: number): number[] {
  const options = new Set([target]);
  while (options.size < Math.min(optionCount, max)) {
    options.add(random.int(1, max));
  }
  return random.shuffle([...options]);
}

export function generateListeningRound(domain: DomainProgress, seed: string | number): ListeningRound {
  const random = createSeededRandom(seed);
  const stageIndex = Math.min(listeningStages.length - 1, Math.max(0, domain.level - 1));
  const available = [...listeningStages[stageIndex]!];
  // Level 1 keeps the very first choices to exactly two clear pictures.
  const optionCount = domain.level === 1 ? 2 : domain.level === 2 ? 3 : 4;
  const weights = buildPracticeWeights(domain, available);
  const targetId = pickWeightedUnique(available, weights, 1, random)[0]!;
  const target = conceptById(targetId);
  const sameCategoryIds = available.filter(
    (conceptId) => conceptId !== targetId && conceptById(conceptId).category === target.category,
  );
  const distractorIds = pickWeightedUnique(
    sameCategoryIds,
    weights,
    Math.min(optionCount - 1, sameCategoryIds.length),
    random,
  );
  const optionIds = random.shuffle([targetId, ...distractorIds]);

  return {
    targetId,
    optionIds,
    promptHe: `איפה ${target.he}?`,
    promptEn: `Where is the ${target.en}?`,
  };
}

export function generateCountingRound(domain: DomainProgress, seed: string | number): CountingRound {
  const random = createSeededRandom(seed);
  const maxCount = domain.level === 1 ? 3 : domain.level === 2 ? 5 : 10;
  // Level 1 offers only the target plus one distractor number.
  const optionCount = domain.level === 1 ? 2 : domain.level === 2 ? 3 : 4;
  const targetCount = random.int(1, maxCount);
  const countingConceptId = countingConceptIds[random.int(0, countingConceptIds.length - 1)]!;

  return {
    targetCount,
    options: uniqueNumberOptions(random, targetCount, maxCount, optionCount),
    countingConceptId,
    promptHe: 'כמה יש כאן?',
    promptEn: 'How many do you see?',
    answerHe: NUMBER_WORDS_HE[targetCount] ?? String(targetCount),
    answerEn: NUMBER_WORDS_EN[targetCount] ?? String(targetCount),
  };
}

function pickSortingRule(domain: DomainProgress, random: ReturnType<typeof createSeededRandom>): SortingRule {
  if (domain.level === 1) {
    return 'color';
  }
  return random.next() > 0.5 ? 'shape' : 'color';
}

export function generateSortingRound(domain: DomainProgress, seed: string | number): SortingRound {
  const random = createSeededRandom(seed);
  const rule = pickSortingRule(domain, random);
  const allColors: ColorId[] = ['red', 'blue', 'green', 'yellow'];
  const allShapes: ShapeId[] = ['circle', 'square', 'triangle', 'star'];
  const binIds: string[] = rule === 'color' ? random.shuffle(allColors).slice(0, 2) : random.shuffle(allShapes).slice(0, 2);
  // Level 1 keeps sorting to exactly two objects across exactly two bins.
  const itemCount = domain.level === 1 ? 2 : domain.level === 2 ? 5 : 6;
  const pool = sortingItems.filter((item) => binIds.includes(rule === 'color' ? item.colorId : item.shapeId));
  const weightIds = pool.map((item) => item.id);
  const weights = buildPracticeWeights(domain, weightIds);
  const items = pickWeightedUnique(weightIds, weights, itemCount, random).map(
    (id) => sortingItems.find((item) => item.id === id)!,
  );

  const bins = binIds.map((id) => {
    const labels = rule === 'color' ? colorLabels[id as ColorId] : shapeLabels[id as ShapeId];
    return {
      id,
      labelHe: labels.he,
      labelEn: labels.en,
      rule,
    };
  });

  return {
    rule,
    bins,
    items,
    promptHe: rule === 'color' ? 'בוא נמיין לפי צבע' : 'בוא נמיין לפי צורה',
    promptEn: rule === 'color' ? 'Let’s sort by color' : 'Let’s sort by shape',
  };
}

export function generatePuzzleRound(domain: DomainProgress, seed: string | number): PuzzleRound {
  const random = createSeededRandom(seed);
  const layouts: Array<[number, number]> = domain.level === 1 ? [[1, 2]] : domain.level === 2 ? [[1, 3]] : [[2, 2]];
  const [rows, cols] = random.pick(layouts);
  const scene = random.pick(puzzleScenes);
  const pieces = Array.from({ length: rows * cols }, (_, index) => ({
    id: `${scene.id}-${index}`,
    row: Math.floor(index / cols),
    col: index % cols,
  }));

  return {
    scene,
    rows,
    cols,
    pieces,
    promptHe: `נעזור ל${scene.titleHe} לחזור להיות שלם`,
    promptEn: `Let’s rebuild the ${scene.titleEn}`,
  };
}

export function generateMemoryRound(domain: DomainProgress, seed: string | number): MemoryRound {
  const random = createSeededRandom(seed);
  const stageIndex = Math.min(memoryStages.length - 1, Math.max(0, domain.level - 1));
  const pairCount = domain.level === 1 ? 2 : domain.level === 2 ? 3 : 4;
  const available = [...memoryStages[stageIndex]!];
  const weights = buildPracticeWeights(domain, available);
  const pairConceptIds = pickWeightedUnique(available, weights, pairCount, random);
  const cards = random.shuffle(
    pairConceptIds.flatMap((conceptId, index) => [
      { id: `a-${index}-${conceptId}`, pairId: conceptId, conceptId },
      { id: `b-${index}-${conceptId}`, pairId: conceptId, conceptId },
    ]),
  );

  return {
    pairConceptIds,
    cards,
    promptHe: 'פותחים שני קלפים ומחפשים זוג',
    promptEn: 'Open two cards and find a pair',
  };
}

export function conceptMasteryFor(domain: DomainProgress, conceptId: string): number {
  return domain.concepts[conceptId]?.mastery ?? createInitialConceptStat().mastery;
}
