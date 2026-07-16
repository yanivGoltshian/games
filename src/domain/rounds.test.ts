import { describe, expect, it } from 'vitest';
import { REALISTIC_CONCEPT_IDS } from '../art/conceptAssets';
import { ORIGINAL_PUZZLE_SCENE_IDS } from '../art/puzzleScenes';
import { learningConcepts } from '../content/concepts';
import { getCountingQuestion, type CountingConceptId } from '../content/countingQuantity';
import { createInitialDomainProgress } from './progression';
import {
  NUMBER_PAIRS_GENERATION_ATTEMPTS,
  generateCountingRound,
  generateListeningRound,
  generateMemoryRound,
  generateNumberPairsRound,
  generatePuzzleRound,
  generateSortingRound,
  getNumberPairsRoundSignature,
} from './rounds';

function permutations(values: readonly number[]): number[][] {
  if (values.length === 0) {
    return [[]];
  }
  return values.flatMap((value, index) => permutations([
    ...values.slice(0, index),
    ...values.slice(index + 1),
  ]).map((tail) => [value, ...tail]));
}

describe('round generation', () => {
  it('limits every generated vocabulary concept to a licensed realistic asset', () => {
    const assetIds = new Set(REALISTIC_CONCEPT_IDS);
    const levels = [1, 2, 3] as const;
    expect(learningConcepts.every((concept) => assetIds.has(concept.id as (typeof REALISTIC_CONCEPT_IDS)[number]))).toBe(true);

    for (let index = 0; index < 50; index += 1) {
      const domain = createInitialDomainProgress();
      domain.level = levels[index % levels.length]!;
      const listening = generateListeningRound(domain, `art-listening-${index}`);
      const counting = generateCountingRound(domain, `art-counting-${index}`);
      const memory = generateMemoryRound(domain, `art-memory-${index}`);
      const puzzle = generatePuzzleRound(domain, `art-puzzle-${index}`);
      expect([listening.targetId, ...listening.optionIds, counting.countingConceptId, ...memory.pairConceptIds]
        .every((conceptId) => assetIds.has(conceptId as (typeof REALISTIC_CONCEPT_IDS)[number]))).toBe(true);
      expect(ORIGINAL_PUZZLE_SCENE_IDS).toContain(puzzle.scene.id);
    }
  });

  it('is deterministic for the same listening seed', () => {
    const domain = createInitialDomainProgress();
    const first = generateListeningRound(domain, 'same-seed');
    const second = generateListeningRound(domain, 'same-seed');

    expect(first).toEqual(second);
  });

  it('groups listening choices by semantic category', () => {
    const domain = createInitialDomainProgress();
    domain.level = 3;
    const round = generateListeningRound(domain, 'semantic-group');
    const categories = round.optionIds.map(
      (conceptId) => learningConcepts.find((concept) => concept.id === conceptId)?.category,
    );

    expect(new Set(categories).size).toBe(1);
  });

  it('respects counting difficulty bands', () => {
    const domain = createInitialDomainProgress();
    domain.level = 3;

    const round = generateCountingRound(domain, 'counting');

    expect(round.targetCount).toBeLessThanOrEqual(10);
    expect(round.targetCount).toBeGreaterThanOrEqual(1);
    expect(round.options).toContain(round.targetCount);
  });

  it('uses the selected concept question for every counting round', () => {
    const domain = createInitialDomainProgress();
    domain.level = 3;
    const seenConcepts = new Set<string>();

    for (let index = 0; index < 50; index += 1) {
      const round = generateCountingRound(domain, `counting-question-${index}`);
      const conceptId = round.countingConceptId as CountingConceptId;
      seenConcepts.add(conceptId);
      expect(round.promptHe).toBe(getCountingQuestion('he', conceptId));
      expect(round.promptEn).toBe(getCountingQuestion('en', conceptId));
      expect(round.promptHe).not.toBe('כמה יש כאן?');
      expect(round.promptEn).not.toBe('How many do you see?');
    }

    expect([...seenConcepts].sort()).toEqual(['apple', 'ball', 'banana']);
  });

  it('builds sorting bins that match the requested rule', () => {
    const domain = createInitialDomainProgress();
    domain.level = 2;

    const round = generateSortingRound(domain, 'sorting');

    expect(round.items.length).toBeGreaterThanOrEqual(5);
    expect(round.bins.every((bin) => bin.rule === round.rule)).toBe(true);
  });

  it.each([
    [1, 1, 2, 2],
    [2, 2, 2, 4],
    [3, 3, 3, 9],
  ] as const)('creates the level %i puzzle as %ix%i with %i pieces', (level, rows, cols, count) => {
    const domain = createInitialDomainProgress();
    domain.level = level;

    const round = generatePuzzleRound(domain, `puzzle-level-${level}`);

    expect(round.rows).toBe(rows);
    expect(round.cols).toBe(cols);
    expect(round.pieces).toHaveLength(count);
    expect(round.pieces).toHaveLength(round.rows * round.cols);
  });

  it('creates matching memory pairs', () => {
    const domain = createInitialDomainProgress();
    const round = generateMemoryRound(domain, 'memory');
    const counts = new Map<string, number>();

    round.cards.forEach((card) => {
      counts.set(card.pairId, (counts.get(card.pairId) ?? 0) + 1);
    });

    expect([...counts.values()]).toEqual(Array(round.pairConceptIds.length).fill(2));
  });

  describe('level 1 early constraints', () => {
    it('offers at most two listening choices', () => {
      const domain = createInitialDomainProgress();
      const round = generateListeningRound(domain, 'listening-level-1');

      expect(round.optionIds).toHaveLength(2);
      expect(round.optionIds).toContain(round.targetId);
    });

    it('offers at most two counting choices', () => {
      const domain = createInitialDomainProgress();
      const round = generateCountingRound(domain, 'counting-level-1');

      expect(round.options.length).toBeLessThanOrEqual(2);
      expect(round.options).toContain(round.targetCount);
    });

    it('sorts exactly two objects across exactly two bins', () => {
      const domain = createInitialDomainProgress();
      const round = generateSortingRound(domain, 'sorting-level-1');

      expect(round.items).toHaveLength(2);
      expect(round.bins).toHaveLength(2);
    });

    it('builds a two-piece puzzle', () => {
      const domain = createInitialDomainProgress();
      const round = generatePuzzleRound(domain, 'puzzle-level-1');

      expect(round.pieces).toHaveLength(2);
    });

    it('builds a two-pair memory round', () => {
      const domain = createInitialDomainProgress();
      const round = generateMemoryRound(domain, 'memory-level-1');

      expect(round.pairConceptIds).toHaveLength(2);
      expect(round.cards).toHaveLength(4);
    });
  });

  describe('number pairs', () => {
    it.each([
      [3, 3, 1],
      [4, 6, 2],
      [5, 10, 3],
    ] as const)('uses exactly %i values within 1..%i at level %i', (count, max, level) => {
      const domain = createInitialDomainProgress();
      domain.level = level;

      for (let index = 0; index < 40; index += 1) {
        const round = generateNumberPairsRound(domain, `number-pairs-${level}-${index}`);
        const sortedSelection = [...round.selectedValues].sort((left, right) => left - right);

        expect(round.selectedValues).toHaveLength(count);
        expect(new Set(round.selectedValues).size).toBe(count);
        expect(round.selectedValues.every((value) => value >= 1 && value <= max)).toBe(true);
        expect([...round.topRow].sort((left, right) => left - right)).toEqual(sortedSelection);
        expect([...round.bottomRow].sort((left, right) => left - right)).toEqual(sortedSelection);
        expect(round.topRow).not.toEqual(round.bottomRow);
        expect(round.signature).toBe(getNumberPairsRoundSignature(round));
        expect(round.promptHe).not.toBe('');
        expect(round.promptEn).not.toBe('');
      }
    });

    it('always selects one, two, and three at level one', () => {
      const domain = createInitialDomainProgress();

      for (let index = 0; index < 20; index += 1) {
        expect(generateNumberPairsRound(domain, index).selectedValues).toEqual([1, 2, 3]);
      }
    });

    it('is deterministic for the same seed and signature history', () => {
      const domain = createInitialDomainProgress();
      domain.level = 3;
      const history = ['unrelated-signature'];

      expect(generateNumberPairsRound(domain, 'stable-board', history)).toEqual(
        generateNumberPairsRound(domain, 'stable-board', history),
      );
    });

    it('uses stable signatures that distinguish row arrangements', () => {
      const first = getNumberPairsRoundSignature({
        selectedValues: [3, 1, 2],
        topRow: [1, 2, 3],
        bottomRow: [2, 3, 1],
      });
      const sameBoard = getNumberPairsRoundSignature({
        selectedValues: [1, 2, 3],
        topRow: [1, 2, 3],
        bottomRow: [2, 3, 1],
      });
      const differentBoard = getNumberPairsRoundSignature({
        selectedValues: [1, 2, 3],
        topRow: [3, 2, 1],
        bottomRow: [2, 3, 1],
      });

      expect(first).toBe(sameBoard);
      expect(first).not.toBe(differentBoard);
    });

    it('avoids immediate and local board repeats deterministically', () => {
      const domain = createInitialDomainProgress();
      domain.level = 2;
      const signatures: string[] = [];

      for (let index = 0; index < 20; index += 1) {
        const round = generateNumberPairsRound(domain, 'repeat-safe-board', signatures);
        expect(signatures).not.toContain(round.signature);
        signatures.push(round.signature);
      }

      expect(new Set(signatures).size).toBe(signatures.length);
      expect(generateNumberPairsRound(domain, 'repeat-safe-board', signatures)).toEqual(
        generateNumberPairsRound(domain, 'repeat-safe-board', signatures),
      );
    });

    it('terminates with a deterministic fallback when every level-one board is in history', () => {
      const domain = createInitialDomainProgress();
      const rows = permutations([1, 2, 3]);
      const exhaustiveHistory = rows.flatMap((topRow) => rows
        .filter((bottomRow) => bottomRow.some((value, index) => value !== topRow[index]))
        .map((bottomRow) => getNumberPairsRoundSignature({
          selectedValues: [1, 2, 3],
          topRow,
          bottomRow,
        })));

      expect(NUMBER_PAIRS_GENERATION_ATTEMPTS).toBeGreaterThan(0);
      const first = generateNumberPairsRound(domain, 'bounded-fallback', exhaustiveHistory);
      const second = generateNumberPairsRound(domain, 'bounded-fallback', exhaustiveHistory);

      expect(first).toEqual(second);
      expect(exhaustiveHistory).toContain(first.signature);
      expect(first.topRow).not.toEqual(first.bottomRow);
    });
  });
});
