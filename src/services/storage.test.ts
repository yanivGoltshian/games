import { describe, expect, it } from 'vitest';
import { applyProgressionChoice, applyRoundResult, createInitialProgress, RECENT_RESULT_LIMIT } from '../domain/progression';
import { clearProgress, loadProgress, saveProgress, STORAGE_KEY } from './storage';

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
  it('retains the extended stages through a v29 read-and-save without restoring reset progress', () => {
    const storage = new MemoryStorage();
    const win = { attempts: 8, requiredActions: 3, concepts: ['test'] };
    let progress = applyRoundResult(createInitialProgress(), 'memory', win).progress;
    for (let index = 0; index < RECENT_RESULT_LIMIT; index += 1) {
      progress = applyRoundResult(progress, 'memory', { ...win, success: false }).progress;
      progress = applyRoundResult(progress, 'numberPairs', win).progress;
    }
    saveProgress(progress, storage);
    const legacy = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(legacy.domains.numberPairs.level).toBe(3);
    expect(legacy.domains.numberPairs.highestLevel).toBe(3);
    delete legacy.domains.memory.memoryStageWins;
    legacy.domains.numberPairs.recentResults.forEach((result: { level: number }) => {
      if (result.level > 3) result.level = 1;
    });
    storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const restored = loadProgress(false, storage);
    expect(restored.domains.numberPairs.level).toBe(6);
    expect(restored.domains.numberPairs.highestLevel).toBe(6);
    expect(applyRoundResult(restored, 'memory', win).summary.level).toBe(2);
    expect(applyRoundResult(restored, 'numberPairs', win).summary.level).toBe(7);

    // Both the old reset path (base only) and the new reset path must stay reset.
    storage.removeItem(STORAGE_KEY);
    storage.setItem(STORAGE_KEY, JSON.stringify(createInitialProgress()));
    expect(loadProgress(false, storage).domains.numberPairs.level).toBe(1);
    expect(loadProgress(false, storage).domains.memory.memoryStageWins).toBe(0);
    clearProgress(storage);
    expect(storage.length).toBe(0);
  });

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
