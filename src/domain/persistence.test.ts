import { describe, expect, it } from 'vitest';
import { migrateStoredProgress, serializeProgress } from './persistence';

describe('persistence migration', () => {
  it('returns defaults for invalid data', () => {
    const progress = migrateStoredProgress('nope', { prefersReducedMotion: true, now: 55 });

    expect(progress.version).toBe(2);
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

    expect(JSON.parse(raw).version).toBe(2);
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
});
