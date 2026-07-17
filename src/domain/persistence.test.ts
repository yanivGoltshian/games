import { describe, expect, it } from 'vitest';
import { applyRoundResult, createInitialProgress, RECENT_RESULT_LIMIT } from './progression';
import { migrateStoredProgress, serializeProgress } from './persistence';

describe('persistence migration', () => {
  it('returns defaults for invalid data', () => {
    const progress = migrateStoredProgress('nope', { prefersReducedMotion: true, now: 55 });

    expect(progress.version).toBe(4);
    expect(progress.settings.reducedMotion).toBe(true);
    expect(progress.totalStars).toBe(0);
  });

  it('migrates legacy preference fields', () => {
    const progress = migrateStoredProgress(
      {
        schemaVersion: 1,
        totalStars: 10,
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
    expect(progress.totalStars).toBe(10);
  });

  it('serializes stable JSON for storage', () => {
    const progress = migrateStoredProgress(null, { now: 88 });
    const raw = serializeProgress(progress);

    expect(JSON.parse(raw).version).toBe(4);
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

    expect(progress.version).toBe(4);
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

  it('migrates version three with all existing domains intact and initializes number pairs', () => {
    const existingDomains = Object.fromEntries(
      ['listening', 'counting', 'sorting', 'puzzle', 'memory'].map((domain, index) => [domain, {
        attempts: index + 2,
        successes: index + 1,
        streak: index,
        level: index % 2 === 0 ? 1 : 2,
        highestLevel: index % 2 === 0 ? 1 : 2,
        completedRounds: index + 1,
        firstAttemptSuccesses: index,
        totalAttempts: index + 3,
        mastery: 0.5 + index * 0.05,
        stars: index + 1,
        lastPracticedAt: 200 + index,
        lastProgressionChoice: index % 2 === 0 ? null : 'next',
        recentResults: [{
          completedAt: 100 + index,
          level: 1,
          success: true,
          firstAttempt: true,
          attempts: 1,
        }],
        concepts: {
          [`concept-${index}`]: {
            attempts: 2,
            successes: 1,
            streak: 1,
            mastery: 0.6,
          },
        },
      }]),
    );
    const progress = migrateStoredProgress({
      version: 3,
      updatedAt: 250,
      totalStars: 99,
      settings: {
        languageMode: 'bilingual',
        englishVoiceLocale: 'en-GB',
        soundLevel: 0.4,
        reducedMotion: true,
        quietMode: true,
      },
      domains: existingDomains,
    }, { now: 999 });

    expect(progress.version).toBe(4);
    expect(progress.updatedAt).toBe(250);
    expect(progress.totalStars).toBe(99);
    expect(progress.settings).toEqual({
      languageMode: 'bilingual',
      englishVoiceLocale: 'en-GB',
      soundLevel: 0.4,
      reducedMotion: true,
      quietMode: true,
    });
    for (const [domain, stored] of Object.entries(existingDomains)) {
      expect(progress.domains[domain as keyof typeof progress.domains]).toEqual(stored);
    }
    expect(progress.domains.numberPairs).toEqual({
      attempts: 0,
      successes: 0,
      streak: 0,
      level: 1,
      highestLevel: 1,
      completedRounds: 0,
      firstAttemptSuccesses: 0,
      totalAttempts: 0,
      mastery: 0,
      stars: 0,
      lastPracticedAt: 0,
      lastProgressionChoice: null,
      recentResults: [],
      concepts: {},
    });
    expect(progress.domains.wordStretch).toEqual(progress.domains.numberPairs);
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
    const reloaded = migrateStoredProgress(JSON.parse(serializeProgress(progress)), { now: 1020 });

    expect(reloaded.domains.sorting.level).toBe(2);
    expect(reloaded.domains.sorting.highestLevel).toBe(2);
    expect(reloaded.domains.sorting.lastProgressionChoice).toBe('next');
    expect(reloaded.domains.sorting.recentResults).toHaveLength(3);
  });

  it('round-trips number-pairs progress', () => {
    let progress = createInitialProgress(false, 1000);
    for (let index = 0; index < 3; index += 1) {
      progress = applyRoundResult(
        progress,
        'numberPairs',
        { attempts: 1, concepts: [`number-${index + 1}`] },
        1001 + index,
      ).progress;
    }

    const reloaded = migrateStoredProgress(JSON.parse(serializeProgress(progress)), { now: 2000 });

    expect(reloaded.version).toBe(4);
    expect(reloaded.totalStars).toBe(3);
    expect(reloaded.domains.numberPairs).toEqual(progress.domains.numberPairs);
    expect(reloaded.domains.numberPairs).toMatchObject({
      attempts: 3,
      successes: 3,
      completedRounds: 3,
      level: 2,
      highestLevel: 2,
      stars: 3,
      lastProgressionChoice: 'next',
    });
    expect(reloaded.domains.numberPairs.recentResults).toHaveLength(3);
  });
});
