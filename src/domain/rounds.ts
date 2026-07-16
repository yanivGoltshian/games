import {
  countingConceptIds,
  learningConcepts,
  puzzleScenes,
  requireLearningConcept,
  sortingItems,
} from '../content/concepts';
import { getCountingQuestion } from '../content/countingQuantity';
import { buildPracticeWeights, createInitialConceptStat } from './progression';
import { createSeededRandom, pickWeightedUnique } from './rng';
import type {
  ColorId,
  CountingRound,
  DomainProgress,
  ListeningRound,
  MemoryRound,
  NumberPairsRound,
  PuzzleRound,
  ShapeId,
  SortingRound,
  SortingRule,
} from './types';

export const NUMBER_WORDS_HE = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];
export const NUMBER_WORDS_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const NUMBER_PAIRS_GENERATION_ATTEMPTS = 32;
export const LEARNING_ROUND_GENERATION_ATTEMPTS = 32;

const learningStages: string[][] = ([1, 2, 3] as const).map((level) => learningConcepts
  .filter((concept) => concept.introducedAtLevel <= level)
  .map((concept) => concept.id));

export const SORTING_COLOR_LABELS: Record<ColorId, { he: string; en: string }> = {
  red: { he: 'אדום', en: 'red' },
  blue: { he: 'כחול', en: 'blue' },
  green: { he: 'ירוק', en: 'green' },
  yellow: { he: 'צהוב', en: 'yellow' },
};

export const SORTING_SHAPE_LABELS: Record<ShapeId, { he: string; en: string }> = {
  circle: { he: 'עיגול', en: 'circle' },
  square: { he: 'ריבוע', en: 'square' },
  triangle: { he: 'משולש', en: 'triangle' },
  star: { he: 'כוכב', en: 'star' },
};

function conceptById(id: string) {
  return requireLearningConcept(id);
}

function uniqueNumberOptions(random: ReturnType<typeof createSeededRandom>, target: number, max: number, optionCount: number): number[] {
  const options = new Set([target]);
  while (options.size < Math.min(optionCount, max)) {
    options.add(random.int(1, max));
  }
  return random.shuffle([...options]);
}

interface RepeatSafeCandidateConfig<TRound> {
  seed: string | number;
  scope: string;
  recentSignatures: readonly string[];
  create: (seed: string | number) => TRound;
  getSignature: (round: TRound) => string;
  getTokens: (round: TRound) => readonly string[];
  getSignatureTokens: (signature: string) => readonly string[];
}

function repeatPenalty<TRound>(
  round: TRound,
  config: RepeatSafeCandidateConfig<TRound>,
): number {
  const signature = config.getSignature(round);
  const tokens = new Set(config.getTokens(round));
  let penalty = config.recentSignatures.includes(signature) ? 10_000 : 0;

  config.recentSignatures.forEach((recentSignature, index) => {
    const recentTokens = new Set(config.getSignatureTokens(recentSignature));
    const overlap = [...tokens].filter((token) => recentTokens.has(token)).length;
    penalty += overlap * (index + 1);
    if (index === config.recentSignatures.length - 1) {
      penalty += overlap * 1_000;
    }
  });

  return penalty;
}

function createRepeatSafeRound<TRound>(config: RepeatSafeCandidateConfig<TRound>): TRound {
  if (config.recentSignatures.length === 0) {
    return config.create(config.seed);
  }

  let bestRound: TRound | undefined;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < LEARNING_ROUND_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = config.create(`${String(config.seed)}:${config.scope}:${attempt}`);
    const penalty = repeatPenalty(candidate, config);
    if (penalty < bestPenalty) {
      bestRound = candidate;
      bestPenalty = penalty;
    }
    if (penalty === 0) {
      return candidate;
    }
  }

  if (!bestRound) {
    throw new Error(`Unable to create a ${config.scope} round.`);
  }
  return bestRound;
}

function createListeningCandidate(domain: DomainProgress, seed: string | number): ListeningRound {
  const random = createSeededRandom(seed);
  const stageIndex = Math.min(learningStages.length - 1, Math.max(0, domain.level - 1));
  const available = [...learningStages[stageIndex]!];
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
  const fallbackIds = pickWeightedUnique(
    available.filter((conceptId) => conceptId !== targetId && !distractorIds.includes(conceptId)),
    weights,
    optionCount - 1 - distractorIds.length,
    random,
  );
  const optionIds = random.shuffle([targetId, ...distractorIds, ...fallbackIds]);

  return {
    targetId,
    optionIds,
    promptHe: `איפה ${target.he}?`,
    promptEn: `Where is the ${target.en}?`,
  };
}

export function getListeningRoundSignature(round: ListeningRound): string {
  return `${round.targetId}|${[...round.optionIds].sort().join(',')}`;
}

export function generateListeningRound(
  domain: DomainProgress,
  seed: string | number,
  recentSignatures: readonly string[] = [],
): ListeningRound {
  return createRepeatSafeRound({
    seed,
    scope: 'listening',
    recentSignatures,
    create: (candidateSeed) => createListeningCandidate(domain, candidateSeed),
    getSignature: getListeningRoundSignature,
    getTokens: (round) => round.optionIds,
    getSignatureTokens: (signature) => signature.split('|')[1]?.split(',') ?? [],
  });
}

function createCountingCandidate(domain: DomainProgress, seed: string | number): CountingRound {
  const random = createSeededRandom(seed);
  const maxCount = domain.level === 1 ? 3 : domain.level === 2 ? 5 : 10;
  // Level 1 offers only the target plus one distractor number.
  const optionCount = domain.level === 1 ? 2 : domain.level === 2 ? 3 : 4;
  const targetCount = random.int(1, maxCount);
  const availableConceptIds = countingConceptIds.filter(
    (conceptId) => requireLearningConcept(conceptId).introducedAtLevel <= domain.level,
  );
  const countingConceptId = availableConceptIds[random.int(0, availableConceptIds.length - 1)]!;

  return {
    targetCount,
    options: uniqueNumberOptions(random, targetCount, maxCount, optionCount),
    countingConceptId,
    promptHe: getCountingQuestion('he', countingConceptId),
    promptEn: getCountingQuestion('en', countingConceptId),
    answerHe: NUMBER_WORDS_HE[targetCount] ?? String(targetCount),
    answerEn: NUMBER_WORDS_EN[targetCount] ?? String(targetCount),
  };
}

export function getCountingRoundSignature(round: CountingRound): string {
  return `${round.countingConceptId}|${round.targetCount}|${[...round.options].sort((left, right) => left - right).join(',')}`;
}

export function generateCountingRound(
  domain: DomainProgress,
  seed: string | number,
  recentSignatures: readonly string[] = [],
): CountingRound {
  return createRepeatSafeRound({
    seed,
    scope: 'counting',
    recentSignatures,
    create: (candidateSeed) => createCountingCandidate(domain, candidateSeed),
    getSignature: getCountingRoundSignature,
    getTokens: (round) => [`concept:${round.countingConceptId}`, `count:${round.targetCount}`],
    getSignatureTokens: (signature) => {
      const [conceptId, count] = signature.split('|');
      return conceptId && count ? [`concept:${conceptId}`, `count:${count}`] : [];
    },
  });
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
    const labels = rule === 'color'
      ? SORTING_COLOR_LABELS[id as ColorId]
      : SORTING_SHAPE_LABELS[id as ShapeId];
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

function createPuzzleCandidate(domain: DomainProgress, seed: string | number): PuzzleRound {
  const random = createSeededRandom(seed);
  const [rows, cols] = domain.level === 1 ? [1, 2] : domain.level === 2 ? [2, 2] : [3, 3];
  const availableScenes = puzzleScenes.filter((scene) => (
    scene.image.kind === 'original'
    || requireLearningConcept(scene.image.conceptId).introducedAtLevel <= domain.level
  ));
  const scene = random.pick(availableScenes);
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
    promptHe: scene.promptHe,
    promptEn: scene.promptEn,
  };
}

export function getPuzzleRoundSignature(round: PuzzleRound): string {
  return round.scene.id;
}

export function generatePuzzleRound(
  domain: DomainProgress,
  seed: string | number,
  recentSignatures: readonly string[] = [],
): PuzzleRound {
  return createRepeatSafeRound({
    seed,
    scope: 'puzzle',
    recentSignatures,
    create: (candidateSeed) => createPuzzleCandidate(domain, candidateSeed),
    getSignature: getPuzzleRoundSignature,
    getTokens: (round) => [round.scene.id],
    getSignatureTokens: (signature) => [signature],
  });
}

function createMemoryCandidate(domain: DomainProgress, seed: string | number): MemoryRound {
  const random = createSeededRandom(seed);
  const stageIndex = Math.min(learningStages.length - 1, Math.max(0, domain.level - 1));
  const pairCount = domain.level === 1 ? 2 : domain.level === 2 ? 3 : 4;
  const available = [...learningStages[stageIndex]!];
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

export function getMemoryRoundSignature(round: MemoryRound): string {
  return [...round.pairConceptIds].sort().join(',');
}

export function generateMemoryRound(
  domain: DomainProgress,
  seed: string | number,
  recentSignatures: readonly string[] = [],
): MemoryRound {
  return createRepeatSafeRound({
    seed,
    scope: 'memory',
    recentSignatures,
    create: (candidateSeed) => createMemoryCandidate(domain, candidateSeed),
    getSignature: getMemoryRoundSignature,
    getTokens: (round) => round.pairConceptIds,
    getSignatureTokens: (signature) => signature.split(','),
  });
}

export function getNumberPairsRoundSignature(
  round: Pick<NumberPairsRound, 'selectedValues' | 'topRow' | 'bottomRow'>,
): string {
  const selectedValues = [...round.selectedValues].sort((left, right) => left - right);
  return `${selectedValues.join(',')}|${round.topRow.join(',')}|${round.bottomRow.join(',')}`;
}

function createNumberPairsCandidate(domain: DomainProgress, seed: string): NumberPairsRound {
  const random = createSeededRandom(seed);
  const rangeMax = domain.level === 1 ? 3 : domain.level === 2 ? 6 : 10;
  const valueCount = domain.level === 1 ? 3 : domain.level === 2 ? 4 : 5;
  const availableValues = Array.from({ length: rangeMax }, (_, index) => index + 1);
  const selectedValues = domain.level === 1
    ? availableValues
    : random.shuffle(availableValues).slice(0, valueCount).sort((left, right) => left - right);
  const topRow = random.shuffle(selectedValues);
  let bottomRow = random.shuffle(selectedValues);

  if (bottomRow.every((value, index) => value === topRow[index])) {
    const offset = random.int(1, bottomRow.length - 1);
    bottomRow = [...bottomRow.slice(offset), ...bottomRow.slice(0, offset)];
  }

  const candidate = {
    selectedValues,
    topRow,
    bottomRow,
    promptHe: 'לחץ על הזוגות',
    promptEn: 'Press the pairs',
  };

  return {
    ...candidate,
    signature: getNumberPairsRoundSignature(candidate),
  };
}

export function generateNumberPairsRound(
  domain: DomainProgress,
  seed: string | number,
  recentSignatures: readonly string[] = [],
): NumberPairsRound {
  const history = new Set(recentSignatures);
  let fallback: NumberPairsRound | null = null;

  for (let attempt = 0; attempt < NUMBER_PAIRS_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = createNumberPairsCandidate(domain, `${String(seed)}:number-pairs:${attempt}`);
    fallback ??= candidate;
    if (!history.has(candidate.signature)) {
      return candidate;
    }
  }

  return fallback!;
}

export function conceptMasteryFor(domain: DomainProgress, conceptId: string): number {
  return domain.concepts[conceptId]?.mastery ?? createInitialConceptStat().mastery;
}
