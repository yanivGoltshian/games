import { describe, expect, it } from 'vitest';
import { requireLearningConcept } from '../content/concepts';
import { wordStretchConceptIdsForLevel } from '../content/wordStretch';
import { createInitialProgress } from '../domain/progression';
import {
  generateWordStretchRound,
  getWordStretchRoundSignature,
} from '../domain/rounds';

describe('word stretch rounds', () => {
  it('only exposes concepts introduced at the active level', () => {
    for (const level of [1, 2, 3] as const) {
      const ids = wordStretchConceptIdsForLevel(level);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every(
        (conceptId) => requireLearningConcept(conceptId).introducedAtLevel <= level,
      )).toBe(true);
    }
    expect(wordStretchConceptIdsForLevel(1).length)
      .toBeLessThan(wordStretchConceptIdsForLevel(3).length);
  });

  it('is deterministic and avoids the latest concept when another is available', () => {
    const domain = createInitialProgress(false, 0).domains.wordStretch;
    const first = generateWordStretchRound(domain, 'stretch-seed');
    const repeated = generateWordStretchRound(domain, 'stretch-seed');
    const next = generateWordStretchRound(domain, 'stretch-seed', [
      getWordStretchRoundSignature(first),
    ]);

    expect(repeated).toEqual(first);
    expect(next.conceptId).not.toBe(first.conceptId);
  });
});
