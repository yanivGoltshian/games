import { describe, expect, it } from 'vitest';
import { REALISTIC_CONCEPT_IDS } from '../art/conceptAssets';
import { ORIGINAL_PUZZLE_SCENE_IDS, sceneImageHref } from '../art/puzzleScenes';
import { conceptPuzzleScenes, learningConcepts, originalPuzzleScenes } from '../content/concepts';
import { getCountingQuestion, type CountingConceptId } from '../content/countingQuantity';
import { createInitialDomainProgress } from './progression';
import {
  NUMBER_PAIRS_GENERATION_ATTEMPTS,
  SYLLABLE_TRAIN_GENERATION_ATTEMPTS,
  generateCountingRound,
  generateListeningRound,
  generateMemoryRound,
  generateNumberPairsRound,
  generatePuzzleRound,
  generateSortingRound,
  generateSyllableTrainRound,
  getCountingRoundSignature,
  getListeningRoundSignature,
  getMemoryRoundSignature,
  getNumberPairsRoundSignature,
  getPuzzleRoundSignature,
  getSyllableTrainRoundSignature,
} from './rounds';
import { SYLLABLE_TRAIN_WORDS } from '../content/syllableTrain';
import { requireLearningConcept } from '../content/concepts';

const NEW_CONCEPT_IDS = [
  'duck',
  'rabbit',
  'elephant',
  'strawberry',
  'orange',
  'carrot',
  'cup',
  'spoon',
  'chair',
  'bus',
  'train',
  'airplane',
  'flower',
  'tree',
] as const;

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
    const assetIds = new Set<string>(REALISTIC_CONCEPT_IDS);
    const levels = [1, 2, 3] as const;
    expect(learningConcepts.every((concept) => assetIds.has(concept.id))).toBe(true);

    for (let index = 0; index < 50; index += 1) {
      const domain = createInitialDomainProgress();
      domain.level = levels[index % levels.length]!;
      const listening = generateListeningRound(domain, `art-listening-${index}`);
      const counting = generateCountingRound(domain, `art-counting-${index}`);
      const memory = generateMemoryRound(domain, `art-memory-${index}`);
      const puzzle = generatePuzzleRound(domain, `art-puzzle-${index}`);
      expect([listening.targetId, ...listening.optionIds, counting.countingConceptId, ...memory.pairConceptIds]
        .every((conceptId) => assetIds.has(conceptId))).toBe(true);
      expect(sceneImageHref(puzzle.scene)).not.toBe('');
    }
    expect(ORIGINAL_PUZZLE_SCENE_IDS).toEqual([
      'blue-forest-party',
      'rescue-planes',
      'giant-carrot-garden',
    ]);
  });

  it('is deterministic for the same listening seed', () => {
    const domain = createInitialDomainProgress();
    const first = generateListeningRound(domain, 'same-seed');
    const second = generateListeningRound(domain, 'same-seed');

    expect(first).toEqual(second);
  });

  it('prioritizes same-category listening choices before deterministic fallback choices', () => {
    const domain = createInitialDomainProgress();
    domain.level = 3;
    for (let index = 0; index < 80; index += 1) {
      const round = generateListeningRound(domain, `semantic-group-${index}`);
      const target = learningConcepts.find((concept) => concept.id === round.targetId)!;
      const availableSameCategory = learningConcepts.filter(
        (concept) => concept.id !== target.id && concept.category === target.category,
      ).length;
      const selectedSameCategory = round.optionIds.filter(
        (conceptId) => conceptId !== target.id
          && learningConcepts.find((concept) => concept.id === conceptId)?.category === target.category,
      ).length;

      expect(selectedSameCategory).toBe(Math.min(round.optionIds.length - 1, availableSameCategory));
    }
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

    for (let index = 0; index < 500; index += 1) {
      const round = generateCountingRound(domain, `counting-question-${index}`);
      const conceptId = round.countingConceptId as CountingConceptId;
      seenConcepts.add(conceptId);
      expect(round.promptHe).toBe(getCountingQuestion('he', conceptId));
      expect(round.promptEn).toBe(getCountingQuestion('en', conceptId));
      expect(round.promptHe).not.toBe('כמה יש כאן?');
      expect(round.promptEn).not.toBe('How many do you see?');
    }

    expect([...seenConcepts].sort()).toEqual([
      'airplane',
      'apple',
      'ball',
      'banana',
      'bus',
      'carrot',
      'chair',
      'cup',
      'duck',
      'elephant',
      'flower',
      'orange',
      'rabbit',
      'spoon',
      'strawberry',
      'train',
      'tree',
    ]);
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

  it('uses only the original narrative scenes for default puzzles', () => {
    const domain = createInitialDomainProgress();
    domain.level = 3;
    const originalIds = new Set(originalPuzzleScenes.map((scene) => scene.id));
    const generatedIds = new Set(
      Array.from({ length: 80 }, (_, index) => generatePuzzleRound(domain, `narrative-puzzle-${index}`).scene.id),
    );

    expect([...generatedIds].every((sceneId) => originalIds.has(sceneId))).toBe(true);
    expect(generatedIds).toEqual(originalIds);
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

    it('keeps level-one counting on the original three countable concepts', () => {
      const domain = createInitialDomainProgress();
      const seen = new Set<string>();

      for (let index = 0; index < 100; index += 1) {
        seen.add(generateCountingRound(domain, `counting-level-1-${index}`).countingConceptId);
      }

      expect([...seen].sort()).toEqual(['apple', 'ball', 'banana']);
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

    it('keeps level-one puzzles on the three original scenes', () => {
      const domain = createInitialDomainProgress();

      for (let index = 0; index < 100; index += 1) {
        expect(generatePuzzleRound(domain, `puzzle-level-1-${index}`).scene.image.kind).toBe('original');
      }
    });

    it('builds a two-pair memory round', () => {
      const domain = createInitialDomainProgress();
      const round = generateMemoryRound(domain, 'memory-level-1');

      expect(round.pairConceptIds).toHaveLength(2);
      expect(round.cards).toHaveLength(4);
    });
  });

  describe('expanded concept coverage and anti-repetition', () => {
    it('covers all 14 approved concepts in listening, memory, and counting', () => {
      const domain = createInitialDomainProgress();
      domain.level = 3;
      const listening = new Set<string>();
      const memory = new Set<string>();
      const counting = new Set<string>();

      for (let index = 0; index < 1_200; index += 1) {
        const listeningRound = generateListeningRound(domain, `coverage-listening-${index}`);
        listening.add(listeningRound.targetId);
        generateMemoryRound(domain, `coverage-memory-${index}`).pairConceptIds.forEach((id) => memory.add(id));
        counting.add(generateCountingRound(domain, `coverage-counting-${index}`).countingConceptId);
      }

      for (const conceptId of NEW_CONCEPT_IDS) {
        expect(listening).toContain(conceptId);
        expect(memory).toContain(conceptId);
        expect(counting).toContain(conceptId);
      }
      expect(conceptPuzzleScenes).toHaveLength(NEW_CONCEPT_IDS.length);
      expect(conceptPuzzleScenes.map((scene) => (
        scene.image.kind === 'concept' ? scene.image.conceptId : null
      ))).toEqual(NEW_CONCEPT_IDS);
    });

    it('is deterministic for identical seeds and recent-round histories', () => {
      const domain = createInitialDomainProgress();
      domain.level = 3;
      const history = ['unrelated-signature'];

      expect(generateListeningRound(domain, 'stable', history)).toEqual(
        generateListeningRound(domain, 'stable', history),
      );
      expect(generateCountingRound(domain, 'stable', history)).toEqual(
        generateCountingRound(domain, 'stable', history),
      );
      expect(generateMemoryRound(domain, 'stable', history)).toEqual(
        generateMemoryRound(domain, 'stable', history),
      );
      expect(generatePuzzleRound(domain, 'stable', history)).toEqual(
        generatePuzzleRound(domain, 'stable', history),
      );
    });

    it('avoids immediate concept reuse while keeping every generator bounded', () => {
      const domain = createInitialDomainProgress();
      domain.level = 3;
      let listeningHistory: string[] = [];
      let countingHistory: string[] = [];
      let memoryHistory: string[] = [];
      let puzzleHistory: string[] = [];
      let previousListening = new Set<string>();
      let previousCountingConcept = '';
      let previousMemory = new Set<string>();
      let previousPuzzle = '';

      for (let index = 0; index < 24; index += 1) {
        const listeningRound = generateListeningRound(domain, 'recent-safe', listeningHistory);
        const listeningIds = new Set(listeningRound.optionIds);
        if (previousListening.size > 0) {
          expect([...listeningIds].some((id) => previousListening.has(id))).toBe(false);
        }
        previousListening = listeningIds;
        listeningHistory = [...listeningHistory, getListeningRoundSignature(listeningRound)].slice(-8);

        const countingRound = generateCountingRound(domain, 'recent-safe', countingHistory);
        if (previousCountingConcept) {
          expect(countingRound.countingConceptId).not.toBe(previousCountingConcept);
        }
        previousCountingConcept = countingRound.countingConceptId;
        countingHistory = [...countingHistory, getCountingRoundSignature(countingRound)].slice(-8);

        const memoryRound = generateMemoryRound(domain, 'recent-safe', memoryHistory);
        const memoryIds = new Set(memoryRound.pairConceptIds);
        if (previousMemory.size > 0) {
          expect([...memoryIds].some((id) => previousMemory.has(id))).toBe(false);
        }
        previousMemory = memoryIds;
        memoryHistory = [...memoryHistory, getMemoryRoundSignature(memoryRound)].slice(-8);

        const puzzleRound = generatePuzzleRound(domain, 'recent-safe', puzzleHistory);
        if (previousPuzzle) {
          expect(puzzleRound.scene.id).not.toBe(previousPuzzle);
        }
        previousPuzzle = puzzleRound.scene.id;
        puzzleHistory = [...puzzleHistory, getPuzzleRoundSignature(puzzleRound)].slice(-8);
      }
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

  describe('syllable train', () => {
    it('produces whole-word V2 rounds with exact locale recordings and images', () => {
      const domain = createInitialDomainProgress();

      for (let index = 0; index < 40; index += 1) {
        const round = generateSyllableTrainRound(domain, `syllable-train-${index}`);
        const concept = requireLearningConcept(round.conceptId);

        expect(round.image).toBe(concept.image);
        expect(round.recordings).toEqual({
          'he-IL': concept.he,
          'en-US': concept.en,
          'en-GB': concept.en,
        });
        expect(round).not.toHaveProperty('firstHe');
        expect(round).not.toHaveProperty('restHe');
        expect(round).not.toHaveProperty('promptHe');
        expect(round.signature).toBe(getSyllableTrainRoundSignature(round));
        expect(round.signature).toBe(round.conceptId);
      }
    });

    it('is deterministic for the same seed and signature history', () => {
      const domain = createInitialDomainProgress();
      const history = ['unrelated-signature'];

      expect(generateSyllableTrainRound(domain, 'stable-train', history)).toEqual(
        generateSyllableTrainRound(domain, 'stable-train', history),
      );
    });

    it('avoids immediate and local repeats deterministically', () => {
      const domain = createInitialDomainProgress();
      let signatures: string[] = [];

      for (let index = 0; index < 24; index += 1) {
        const round = generateSyllableTrainRound(domain, 'repeat-safe-train', signatures);
        expect(signatures).not.toContain(round.signature);
        signatures = [...signatures, round.signature].slice(-SYLLABLE_TRAIN_WORDS.length + 1);
      }
    });

    it('terminates with a deterministic fallback when every word is in history', () => {
      const domain = createInitialDomainProgress();
      const exhaustiveHistory = SYLLABLE_TRAIN_WORDS.map((word) => word.conceptId);

      expect(SYLLABLE_TRAIN_GENERATION_ATTEMPTS).toBeGreaterThan(0);
      const first = generateSyllableTrainRound(domain, 'bounded-train', exhaustiveHistory);
      const second = generateSyllableTrainRound(domain, 'bounded-train', exhaustiveHistory);

      expect(first).toEqual(second);
      expect(exhaustiveHistory).toContain(first.signature);
    });
  });
});
