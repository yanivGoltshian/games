import { describe, expect, it } from 'vitest';
import { applyProgressionChoice, applyRoundResult, createInitialProgress, RECENT_RESULT_LIMIT } from './progression';
import { migrateStoredProgress, serializeProgress } from './persistence';

describe('persistence migration', () => {
  it('returns defaults for invalid data', () => {
    const progress = migrateStoredProgress('nope', { prefersReducedMotion: true, now: 55 });

    expect(progress.version).toBe(3);
    expect(progress.settings.reducedMotion).toBe(true);
    expect(progress.totalStars).toBe(0);
  });

  it('migrates legacy preference fields', () => {
    const progress = migrateStoredProgress(
      {
        schemaVersion: 1,
        preferences: {
          language: 'bilingual',
          englishVoice: 'en-GB',
          sound: 0.4,
          motionReduced: true,
          quiet: true,
        },
        stats: {
          listening: {
            level: 2,
            stars: 3,
            concepts: {
              dog: { attempts: 2, successes: 2, streak: 2, mastery: 0.8 },
            },
          },
        },
      },
      { prefersReducedMotion: false, now: 77 },
    );

    expect(progress.settings.languageMode).toBe('bilingual');
    expect(progress.settings.englishVoiceLocale).toBe('en-GB');
    expect(progress.settings.quietMode).toBe(true);
    expect(progress.domains.listening.level).toBe(2);
    expect(progress.totalStars).toBe(3);
  });

  it('serializes stable JSON for storage', () => {
    const progress = migrateStoredProgress(null, { now: 88 });
    const raw = serializeProgress(progress);

    expect(JSON.parse(raw).version).toBe(3);
    expect(JSON.parse(raw).updatedAt).toBe(88);
  });

  it('sanitizes corrupt current-schema values without losing valid settings', () => {
    const progress = migrateStoredProgress({
      version: 2,
      totalStars: -10,
      settings: {
        languageMode: 'en',
        englishVoiceLocale: 'not-a-locale',
        soundLevel: 8,
        reducedMotion: 'yes',
        quietMode: true,
      },
      domains: {
        counting: {
          attempts: 2,
          successes: 99,
          level: 42,
          mastery: -3,
          stars: -1,
          concepts: {
            'count-2': { attempts: 1, successes: 9, streak: 0, mastery: 7 },
          },
        },
      },
    }, { now: 99 });

    expect(progress.settings.languageMode).toBe('en');
    expect(progress.settings.englishVoiceLocale).toBe('en-US');
    expect(progress.settings.soundLevel).toBe(1);
    expect(progress.totalStars).toBe(0);
    expect(progress.domains.counting.successes).toBe(2);
    expect(progress.domains.counting.level).toBe(1);
    expect(progress.domains.counting.mastery).toBe(0);
    expect(progress.domains.counting.concepts['count-2']).toMatchObject({
      attempts: 1,
      successes: 1,
      mastery: 1,
    });
  });

  it('migrates version two domains non-destructively into adaptive progress', () => {
    const progress = migrateStoredProgress({
      version: 2,
      updatedAt: 80,
      totalStars: 7,
      settings: {
        languageMode: 'he',
        englishVoiceLocale: 'en-US',
        soundLevel: 0.7,
        reducedMotion: false,
        quietMode: true,
      },
      domains: {
        puzzle: {
          attempts: 6,
          successes: 5,
          streak: 2,
          level: 2,
          mastery: 0.7,
          stars: 5,
          lastPracticedAt: 70,
          concepts: {
            dog: { attempts: 4, successes: 3, streak: 2, mastery: 0.75 },
          },
        },
      },
    }, { now: 99 });

    expect(progress.version).toBe(3);
    expect(progress.totalStars).toBe(7);
    expect(progress.settings.quietMode).toBe(true);
    expect(progress.domains.puzzle).toMatchObject({
      attempts: 6,
      successes: 5,
      level: 2,
      highestLevel: 2,
      completedRounds: 5,
      totalAttempts: 6,
    });
    expect(progress.domains.puzzle.concepts.dog?.mastery).toBe(0.75);
  });

  it('sanitizes and bounds stored recent history', () => {
    const recentResults = Array.from({ length: RECENT_RESULT_LIMIT + 3 }, (_, index) => ({
      completedAt: index + 1,
      level: 1,
      success: true,
      firstAttempt: true,
      attempts: 1,
    }));
    const progress = migrateStoredProgress({
      version: 3,
      domains: {
        listening: {
          recentResults,
        },
      },
    }, { now: 99 });

    expect(progress.domains.listening.recentResults).toHaveLength(RECENT_RESULT_LIMIT);
    expect(progress.domains.listening.recentResults[0]?.completedAt).toBe(4);
    expect(progress.domains.listening.recentResults.at(-1)?.completedAt).toBe(8);
  });

  it('continues from the chosen level after serialization and reload', () => {
    let progress = createInitialProgress(false, 1000);
    for (let index = 0; index < 3; index += 1) {
      progress = applyRoundResult(
        progress,
        'sorting',
        { attempts: 3, requiredActions: 3, concepts: ['red-circle'] },
        1001 + index,
      ).progress;
    }
    progress = applyProgressionChoice(progress, 'sorting', 'next', 1010).progress;

    const reloaded = migrateStoredProgress(JSON.parse(serializeProgress(progress)), { now: 1020 });

    expect(reloaded.domains.sorting.level).toBe(2);
    expect(reloaded.domains.sorting.highestLevel).toBe(2);
    expect(reloaded.domains.sorting.lastProgressionChoice).toBe('next');
    expect(reloaded.domains.sorting.recentResults).toHaveLength(3);
  });
});
