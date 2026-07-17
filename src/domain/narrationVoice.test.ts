import { describe, expect, it } from 'vitest';
import { migrateStoredProgress } from './persistence';
import { createInitialSettings } from './progression';
import {
  NARRATION_VOICE_PROFILES,
  englishNarrationVoiceForSettings,
} from './narrationVoice';

describe('narration voice defaults', () => {
  it('selects the approved US child voice for a fresh install', () => {
    const settings = createInitialSettings();

    expect(settings.englishVoiceLocale).toBe('en-US');
    expect(englishNarrationVoiceForSettings(settings)).toMatchObject({
      azureName: 'en-US-AnaNeural',
      classification: 'child',
    });
  });

  it('selects the approved child voice when migrating settings without a voice choice', () => {
    const migrated = migrateStoredProgress({
      version: 4,
      settings: {
        languageMode: 'bilingual',
        soundLevel: 0.5,
        reducedMotion: false,
        quietMode: false,
      },
    });

    expect(migrated.settings.englishVoiceLocale).toBe('en-US');
    expect(englishNarrationVoiceForSettings(migrated.settings)).toMatchObject({
      azureName: 'en-US-AnaNeural',
      classification: 'child',
    });
  });

  it('preserves an explicit UK child-voice choice during migration', () => {
    const migrated = migrateStoredProgress({
      version: 4,
      settings: {
        englishVoiceLocale: 'en-GB',
      },
    });

    expect(migrated.settings.englishVoiceLocale).toBe('en-GB');
    expect(englishNarrationVoiceForSettings(migrated.settings)).toMatchObject({
      azureName: 'en-GB-MaisieNeural',
      classification: 'child',
    });
  });

  it('describes the approved Hebrew voice accurately as an adult voice', () => {
    expect(NARRATION_VOICE_PROFILES['he-IL']).toMatchObject({
      azureName: 'he-IL-HilaNeural',
      classification: 'adult',
    });
  });
});
