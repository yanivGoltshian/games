import { migrateStoredProgress, serializeProgress } from '../domain/persistence';
import { getDomainMaxLevel, getMemoryStageWins, STANDARD_MAX_LEVEL } from '../domain/progression';
import type { AppProgress } from '../domain/types';

export const STORAGE_KEY = 'sean-learning-adventure-progress';
const PAIR_STAGES_KEY = `${STORAGE_KEY}:pair-stages:v1`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function restorePairStages(progress: AppProgress, stored: unknown): void {
  if (!isRecord(stored)) return;
  const { memory, numberPairs } = progress.domains;
  const savedMemory = stored.memory;
  if (isRecord(savedMemory) && savedMemory.level === memory.level && memory.attempts > 0
    && typeof savedMemory.attempts === 'number' && memory.attempts >= savedMemory.attempts
    && (savedMemory.wins === 0 || savedMemory.wins === 1)) {
    memory.memoryStageWins = savedMemory.wins === 1 || getMemoryStageWins(memory) === 1 ? 1 : 0;
  }
  const savedNumbers = stored.numberPairs;
  if (isRecord(savedNumbers) && numberPairs.attempts > 0
    && typeof savedNumbers.attempts === 'number' && numberPairs.attempts >= savedNumbers.attempts) {
    const level = savedNumbers.level;
    if (typeof level === 'number' && Number.isInteger(level) && level > numberPairs.level
      && level <= getDomainMaxLevel('numberPairs')) {
      numberPairs.level = level as typeof numberPairs.level;
      numberPairs.highestLevel = Math.max(numberPairs.highestLevel, level) as typeof numberPairs.highestLevel;
    }
  }
}

export function loadProgress(prefersReducedMotion = false, storage?: Storage | null): AppProgress {
  try {
    if (storage === undefined && typeof window !== 'undefined') storage = window.localStorage;
    if (!storage) return migrateStoredProgress(null, { prefersReducedMotion });
    const raw = storage.getItem(STORAGE_KEY);
    const progress = migrateStoredProgress(raw ? JSON.parse(raw) : null, { prefersReducedMotion });
    try {
      const pairStages = storage.getItem(PAIR_STAGES_KEY);
      if (pairStages) restorePairStages(progress, JSON.parse(pairStages));
    } catch {
      // The independent checkpoint is optional; the base record remains usable.
    }
    return progress;
  } catch {
    return migrateStoredProgress(null, { prefersReducedMotion });
  }
}

export function saveProgress(progress: AppProgress, storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): void {
  if (!storage) {
    return;
  }

  const { memory, numberPairs } = progress.domains;
  // Keep the new stages outside the shared record so a v29 tab can't discard
  // them when it reads and immediately rewrites the older schema.
  storage.setItem(PAIR_STAGES_KEY, JSON.stringify({
    memory: { level: memory.level, attempts: memory.attempts, wins: getMemoryStageWins(memory) },
    numberPairs: { level: numberPairs.level, attempts: numberPairs.attempts },
  }));
  const compatible: AppProgress = numberPairs.level > STANDARD_MAX_LEVEL
    ? {
        ...progress,
        domains: {
          ...progress.domains,
          numberPairs: { ...numberPairs, level: STANDARD_MAX_LEVEL, highestLevel: STANDARD_MAX_LEVEL },
        },
      }
    : progress;
  storage.setItem(STORAGE_KEY, serializeProgress(compatible));
}

export function clearProgress(storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): void {
  storage?.removeItem(STORAGE_KEY);
  storage?.removeItem(PAIR_STAGES_KEY);
}
