import { migrateStoredProgress, serializeProgress } from '../domain/persistence';
import type { AppProgress } from '../domain/types';

export const STORAGE_KEY = 'sean-learning-adventure-progress';

export function loadProgress(prefersReducedMotion = false, storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): AppProgress {
  if (!storage) {
    return migrateStoredProgress(null, { prefersReducedMotion });
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    return migrateStoredProgress(raw ? JSON.parse(raw) : null, { prefersReducedMotion });
  } catch {
    return migrateStoredProgress(null, { prefersReducedMotion });
  }
}

export function saveProgress(progress: AppProgress, storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): void {
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, serializeProgress(progress));
}

export function clearProgress(storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): void {
  storage?.removeItem(STORAGE_KEY);
}
