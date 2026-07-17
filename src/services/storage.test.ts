import { describe, expect, it } from 'vitest';
import { applyProgressionChoice, applyRoundResult, createInitialProgress } from '../domain/progression';
import { loadProgress, saveProgress, STORAGE_KEY } from './storage';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('progress storage', () => {
  it('persists adaptive progress and resumes the selected level', () => {
    const storage = new MemoryStorage();
    let progress = createInitialProgress(false, 1000);
    for (let index = 0; index < 3; index += 1) {
      progress = applyRoundResult(
        progress,
        'puzzle',
        { attempts: 2, requiredActions: 2, concepts: ['dog'] },
        1001 + index,
      ).progress;
    }
    progress = applyProgressionChoice(progress, 'puzzle', 'next', 1010).progress;
    progress.settings.childName = '李 小龙';

    saveProgress(progress, storage);
    const reloaded = loadProgress(false, storage);

    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(reloaded.domains.puzzle.level).toBe(2);
    expect(reloaded.domains.puzzle.completedRounds).toBe(3);
    expect(reloaded.domains.puzzle.firstAttemptSuccesses).toBe(3);
    expect(reloaded.domains.puzzle.totalAttempts).toBe(6);
    expect(reloaded.settings.childName).toBe('李 小龙');
  });
});
