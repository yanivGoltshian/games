import { getRetryBank, type RetryLine, type RetryLocale, type RetryScope, type RetryTier } from '../content/retry';
import { hashSeed } from './rng';

export type RetryAttemptBand = 'initial' | 'first-miss' | 'second-miss' | 'repeated-miss';

export interface RetryAttemptState {
  missCount: number;
  attemptNumber: number;
  band: RetryAttemptBand;
  tier: RetryTier;
  repeatedEffortEligible: boolean;
  useSubsequentCountingModel: boolean;
}

export interface RetrySelectionOptions {
  locale: RetryLocale;
  missCount: number;
  seed: string | number;
  scope?: RetryScope;
  previousId?: string;
}

export interface RetryHistorySelectionOptions extends Omit<RetrySelectionOptions, 'previousId'> {
  historyKey?: string;
}

function normalizeMissCount(missCount: number): number {
  if (!Number.isFinite(missCount)) {
    return 0;
  }

  return Math.max(0, Math.floor(missCount));
}

export function classifyRetryAttempt(missCount: number): RetryAttemptState {
  const normalizedMissCount = normalizeMissCount(missCount);
  if (normalizedMissCount === 0) {
    return {
      missCount: 0,
      attemptNumber: 1,
      band: 'initial',
      tier: 'standard',
      repeatedEffortEligible: false,
      useSubsequentCountingModel: false,
    };
  }

  if (normalizedMissCount === 1) {
    return {
      missCount: 1,
      attemptNumber: 2,
      band: 'first-miss',
      tier: 'standard',
      repeatedEffortEligible: false,
      useSubsequentCountingModel: false,
    };
  }

  if (normalizedMissCount === 2) {
    return {
      missCount: 2,
      attemptNumber: 3,
      band: 'second-miss',
      tier: 'standard',
      repeatedEffortEligible: false,
      useSubsequentCountingModel: true,
    };
  }

  return {
    missCount: normalizedMissCount,
    attemptNumber: normalizedMissCount + 1,
    band: 'repeated-miss',
    tier: 'repeated-effort',
    repeatedEffortEligible: true,
    useSubsequentCountingModel: true,
  };
}

export function selectDeterministicLine<T extends { id: string }>(
  lines: readonly T[],
  seed: string | number,
  previousId?: string,
): T {
  if (lines.length === 0) {
    throw new Error('Cannot select from an empty line bank.');
  }

  const available = previousId && lines.length > 1 ? lines.filter((line) => line.id !== previousId) : [...lines];
  const index = hashSeed(seed) % available.length;
  return available[index]!;
}

export function selectRetryLine({ locale, missCount, seed, scope = 'generic', previousId }: RetrySelectionOptions): RetryLine {
  const state = classifyRetryAttempt(missCount);
  const bank = getRetryBank(locale, scope, state.tier);
  return selectDeterministicLine(bank, `${locale}:${scope}:${state.tier}:${seed}`, previousId);
}

export class SessionRetryHistory {
  private readonly previousIds = new Map<string, string>();

  select(options: RetryHistorySelectionOptions): RetryLine {
    const { historyKey: explicitHistoryKey, ...selectionOptions } = options;
    const historyKey = explicitHistoryKey ?? `${selectionOptions.locale}:${selectionOptions.scope ?? 'generic'}`;
    const previousId = this.previousIds.get(historyKey);
    const line = previousId
      ? selectRetryLine({ ...selectionOptions, previousId })
      : selectRetryLine(selectionOptions);
    this.previousIds.set(historyKey, line.id);
    return line;
  }

  getLastId(historyKey: string): string | undefined {
    return this.previousIds.get(historyKey);
  }

  clear(historyKey?: string): void {
    if (historyKey) {
      this.previousIds.delete(historyKey);
      return;
    }

    this.previousIds.clear();
  }
}
