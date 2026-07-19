import { describe, expect, it } from 'vitest';
import { applyRoundResult, createInitialProgress, RECENT_RESULT_LIMIT } from './progression';
import { migrateStoredProgress, serializeProgress } from './persistence';

describe('persistence migration', () => {
  it('returns defaults for invalid data', () => {
    const progress = migrateStoredProgress('nope', { prefersReducedMotion: true, now: 55 });

    expect(progress.version).toBe(6);
    expect(progress.settings.childName).toBe('שון');
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

    expect(JSON.parse(raw).version).toBe(6);
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

    expect(progress.version).toBe(6);
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

    expect(progress.version).toBe(6);
    expect(progress.updatedAt).toBe(250);
    expect(progress.totalStars).toBe(99);
    expect(progress.settings).toEqual({
      childName: 'שון',
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

    expect(reloaded.version).toBe(6);
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

  it('normalizes and preserves a Unicode child name in current settings', () => {
    const progress = migrateStoredProgress({
      version: 5,
      settings: {
        childName: '  נוֹעָה   לִי  ',
        languageMode: 'en',
        englishVoiceLocale: 'en-GB',
        soundLevel: 0.4,
        reducedMotion: false,
        quietMode: false,
      },
    }, { now: 20 });

    expect(progress.settings.childName).toBe('נוֹעָה לִי');
    expect(progress.settings.languageMode).toBe('en');
  });

  it('drops deleted Train history from old persisted domains', () => {
    const trainHistory = {
      attempts: 4,
      successes: 3,
      streak: 2,
      level: 2,
      highestLevel: 2,
      completedRounds: 3,
      firstAttemptSuccesses: 2,
      totalAttempts: 5,
      mastery: 0.75,
      stars: 3,
      lastPracticedAt: 400,
      lastProgressionChoice: 'next',
      recentResults: [{
        completedAt: 400,
        level: 2,
        success: true,
        firstAttempt: true,
        attempts: 1,
      }],
      concepts: {
        train: { attempts: 3, successes: 3, streak: 2, mastery: 0.9 },
      },
    };
    const progress = migrateStoredProgress({
      version: 5,
      updatedAt: 450,
      totalStars: 3,
      domains: {
        syllableTrain: trainHistory,
      },
    }, { now: 999 });

    expect(progress.version).toBe(6);
    expect(progress.domains).not.toHaveProperty('syllableTrain');
    expect(JSON.stringify(progress)).not.toContain('syllableTrain');
  });

  it('drops deleted communication progress without admitting private fields', () => {
    const progress = migrateStoredProgress({
      version: 6,
      communication: {
        version: 99,
        contentVersion: ' pack-2 ',
        sessionsCompleted: 2.4,
        roundsSeen: 4,
        recentContentIds: ['a', '', 'a', 'b'],
        lastPlayedAt: 120,
        accuracy: 1,
        transcript: 'stored text',
        completionMethod: 'voice',
      },
    }, { now: 200 });

    expect(progress).not.toHaveProperty('communication');
    expect(JSON.stringify(progress)).not.toMatch(/pack-2|stored text|completionMethod/i);
  });

  it('drops deleted activity-scoped communication progress without admitting private fields', () => {
    const progress = migrateStoredProgress({
      version: 6,
      communicationActivities: {
        peek: {
          contentVersion: ' peek-v1 ',
          sessionsCompleted: 2,
          roundsSeen: 3,
          recentContentIds: ['peek-a', 'peek-a', ''],
          lastPlayedAt: 100,
          transcript: 'nope',
        },
        train: {
          contentVersion: ' train-v1 ',
          sessionsCompleted: 1,
          roundsSeen: 4,
          recentContentIds: ['ball'],
          lastPlayedAt: 200,
          completionMethod: 'voice',
        },
        phone: {
          contentVersion: ' phone-v1 ',
          sessionsCompleted: -1,
          roundsSeen: 1,
          recentContentIds: ['phone'],
          lastPlayedAt: 300,
        },
        hidden: {
          contentVersion: 'hidden',
          sessionsCompleted: 99,
        },
      },
    }, { now: 200 });

    expect(progress).not.toHaveProperty('communicationActivities');
    expect(JSON.stringify(progress)).not.toMatch(/peek-v1|train-v1|phone-v1|hidden|transcript|completionMethod/i);
  });
});
