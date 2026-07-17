import { describe, expect, it } from 'vitest';
import { COMMUNICATION_ACTIVITY_IDS } from '../domain/communicationGame';
import type { SpeechLocale } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';
import {
  DEFAULT_COMMUNICATION_RELEASE,
  evaluateCommunicationRelease,
  requiredCommunicationLocales,
  type CommunicationLocaleReadiness,
  type CommunicationReleaseConfiguration,
  type CommunicationReleaseReadiness,
} from './release';

function ready(locale: SpeechLocale): CommunicationAssetReadiness {
  return {
    status: 'ready',
    contentVersion: `pack-${locale}`,
    locale,
  };
}

function readyLocales(locales: readonly SpeechLocale[]): CommunicationLocaleReadiness {
  return Object.fromEntries(locales.map((locale) => [locale, ready(locale)]));
}

function configuration(
  locales: readonly SpeechLocale[],
  explicitlyEnabled = true,
): CommunicationReleaseConfiguration {
  return {
    explicitlyEnabled,
    readiness: Object.fromEntries(
      COMMUNICATION_ACTIVITY_IDS.map((activityId) => [activityId, readyLocales(locales)]),
    ) as CommunicationReleaseReadiness,
  };
}

describe('communication release gate', () => {
  it('is explicitly disabled by default without environment-derived behavior', () => {
    expect(DEFAULT_COMMUNICATION_RELEASE.explicitlyEnabled).toBe(false);
    expect(evaluateCommunicationRelease(
      DEFAULT_COMMUNICATION_RELEASE,
      { languageMode: 'he', englishVoiceLocale: 'en-US' },
    ).enabledAndContentReady).toBe(false);
  });

  it('requires explicit enablement even when every exact-locale pack is ready', () => {
    expect(evaluateCommunicationRelease(
      configuration(['he-IL'], false),
      { languageMode: 'he', englishVoiceLocale: 'en-US' },
    ).enabledAndContentReady).toBe(false);
  });

  it('requires every one of the four packs and exposes no partial release', () => {
    const readiness = {
      ...configuration(['he-IL']).readiness,
      story: {},
    };
    const result = evaluateCommunicationRelease(
      { explicitlyEnabled: true, readiness },
      { languageMode: 'he', englishVoiceLocale: 'en-US' },
    );

    expect(result.enabledAndContentReady).toBe(false);
    expect(result.activities).toEqual([
      { activityId: 'peek', status: 'ready' },
      { activityId: 'train', status: 'ready' },
      { activityId: 'phone', status: 'ready' },
      { activityId: 'story', status: 'not-ready' },
    ]);
  });

  it('checks the selected exact English locale without substituting another locale', () => {
    const usOnly = configuration(['en-US']);
    expect(evaluateCommunicationRelease(
      usOnly,
      { languageMode: 'en', englishVoiceLocale: 'en-US' },
    ).enabledAndContentReady).toBe(true);
    expect(evaluateCommunicationRelease(
      usOnly,
      { languageMode: 'en', englishVoiceLocale: 'en-GB' },
    ).enabledAndContentReady).toBe(false);
  });

  it('requires both exact locales in bilingual mode', () => {
    expect(requiredCommunicationLocales({
      languageMode: 'bilingual',
      englishVoiceLocale: 'en-GB',
    })).toEqual(['he-IL', 'en-GB']);
    expect(evaluateCommunicationRelease(
      configuration(['he-IL', 'en-GB']),
      { languageMode: 'bilingual', englishVoiceLocale: 'en-GB' },
    ).enabledAndContentReady).toBe(true);
    expect(evaluateCommunicationRelease(
      configuration(['he-IL']),
      { languageMode: 'bilingual', englishVoiceLocale: 'en-GB' },
    ).enabledAndContentReady).toBe(false);
  });

  it('rejects a readiness object whose result locale does not match its exact key', () => {
    const mismatch = configuration(['en-US']);
    const readiness = {
      ...mismatch.readiness,
      peek: {
        'en-US': ready('en-GB'),
      },
    };
    expect(evaluateCommunicationRelease(
      { explicitlyEnabled: true, readiness },
      { languageMode: 'en', englishVoiceLocale: 'en-US' },
    ).enabledAndContentReady).toBe(false);
  });
});
