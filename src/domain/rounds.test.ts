import { describe, expect, it } from 'vitest';
import { REALISTIC_CONCEPT_IDS } from '../art/conceptAssets';
import { ORIGINAL_PUZZLE_SCENE_IDS } from '../art/puzzleScenes';
import { learningConcepts } from '../content/concepts';
import { getCountingQuestion, type CountingConceptId } from '../content/countingQuantity';
import { createInitialDomainProgress } from './progression';
import { generateCountingRound, generateListeningRound, generateMemoryRound, generatePuzzleRound, generateSortingRound } from './rounds';

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
});
