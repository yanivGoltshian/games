import { describe, expect, it } from 'vitest';
import { learningConcepts } from '../content/concepts';
import { createInitialDomainProgress } from './progression';
import { generateCountingRound, generateListeningRound, generateMemoryRound, generatePuzzleRound, generateSortingRound } from './rounds';

describe('round generation', () => {
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

  it('builds sorting bins that match the requested rule', () => {
    const domain = createInitialDomainProgress();
    domain.level = 2;

    const round = generateSortingRound(domain, 'sorting');

    expect(round.items.length).toBeGreaterThanOrEqual(5);
    expect(round.bins.every((bin) => bin.rule === round.rule)).toBe(true);
  });

  it('creates puzzle layouts with the expected number of pieces', () => {
    const domain = createInitialDomainProgress();
    domain.level = 3;

    const round = generatePuzzleRound(domain, 'puzzle');

    expect(round.pieces).toHaveLength(round.rows * round.cols);
    expect(round.pieces.length).toBeGreaterThanOrEqual(4);
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
