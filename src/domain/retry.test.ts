import { describe, expect, it } from 'vitest';
import {
  RETRY_EN_MEMORY_REPEATED,
  RETRY_EN_NUMBER_PAIRS_REPEATED,
  RETRY_EN_NUMBER_PAIRS_STANDARD,
  RETRY_EN_STANDARD,
  RETRY_HE_REPEATED,
} from '../content/retry';
import { SessionRetryHistory, classifyRetryAttempt, selectDeterministicLine, selectRetryLine } from './retry';

describe('retry selection', () => {
  it('avoids immediate repetition when alternatives exist', () => {
    const first = selectDeterministicLine(RETRY_EN_STANDARD, 'same-seed');
    const second = selectDeterministicLine(RETRY_EN_STANDARD, 'same-seed', first.id);

    expect(second.id).not.toBe(first.id);
    expect(selectDeterministicLine(RETRY_EN_STANDARD, 'same-seed', first.id)).toEqual(second);
  });

  it('uses session-scoped history keys independently', () => {
    const history = new SessionRetryHistory();

    const first = history.select({ locale: 'en', scope: 'generic', missCount: 1, seed: 'seed', historyKey: 'counting' });
    const second = history.select({ locale: 'en', scope: 'generic', missCount: 1, seed: 'seed', historyKey: 'counting' });
    const separate = history.select({ locale: 'en', scope: 'generic', missCount: 1, seed: 'seed', historyKey: 'memory' });

    expect(second.id).not.toBe(first.id);
    expect(separate.id).toBe(first.id);
    expect(history.getLastId('counting')).toBe(second.id);
    expect(history.getLastId('memory')).toBe(separate.id);
  });

  it('classifies graduated attempt state and richer-tier eligibility', () => {
    expect(classifyRetryAttempt(0)).toEqual({
      missCount: 0,
      attemptNumber: 1,
      band: 'initial',
      tier: 'standard',
      repeatedEffortEligible: false,
      useSubsequentCountingModel: false,
    });
    expect(classifyRetryAttempt(1)).toEqual({
      missCount: 1,
      attemptNumber: 2,
      band: 'first-miss',
      tier: 'standard',
      repeatedEffortEligible: false,
      useSubsequentCountingModel: false,
    });
    expect(classifyRetryAttempt(2)).toEqual({
      missCount: 2,
      attemptNumber: 3,
      band: 'second-miss',
      tier: 'standard',
      repeatedEffortEligible: false,
      useSubsequentCountingModel: true,
    });
    expect(classifyRetryAttempt(3)).toEqual({
      missCount: 3,
      attemptNumber: 4,
      band: 'repeated-miss',
      tier: 'repeated-effort',
      repeatedEffortEligible: true,
      useSubsequentCountingModel: true,
    });
  });

  it('only unlocks the richer repeated-effort bank after repeated misses', () => {
    const secondMiss = selectRetryLine({ locale: 'he', missCount: 2, seed: 'seed' });
    const repeatedMiss = selectRetryLine({ locale: 'he', missCount: 3, seed: 'seed' });

    expect(RETRY_HE_REPEATED.map((line) => line.id)).not.toContain(secondMiss.id);
    expect(RETRY_HE_REPEATED.map((line) => line.id)).toContain(repeatedMiss.id);
  });

  it('uses memory-specific warm search lines', () => {
    const memoryRepeated = selectRetryLine({ locale: 'en', scope: 'memory-search', missCount: 4, seed: 'memory-seed' });

    expect(RETRY_EN_MEMORY_REPEATED.map((line) => line.id)).toContain(memoryRepeated.id);
    expect(memoryRepeated.text.toLowerCase()).toMatch(/find|look/);
  });

  it('selects number-pairs correction from the matching effort tier', () => {
    const firstMiss = selectRetryLine({
      locale: 'en',
      scope: 'number-pairs',
      missCount: 1,
      seed: 'pairs',
    });
    const repeatedMiss = selectRetryLine({
      locale: 'en',
      scope: 'number-pairs',
      missCount: 4,
      seed: 'pairs',
    });

    expect(RETRY_EN_NUMBER_PAIRS_STANDARD.map((line) => line.id)).toContain(firstMiss.id);
    expect(RETRY_EN_NUMBER_PAIRS_REPEATED.map((line) => line.id)).toContain(repeatedMiss.id);
  });
});
