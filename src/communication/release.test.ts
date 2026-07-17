import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_ACTIVITY_IDS,
  type CommunicationActivityId,
} from '../domain/communicationGame';
import type { SpeechLocale } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';
import {
  DEFAULT_COMMUNICATION_RELEASE,
  evaluateCommunicationRelease,
  REQUIRED_COMMUNICATION_RELEASE_LOCALES,
  type CommunicationActivityEnablement,
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

function enablement(
  enabledActivityIds: readonly CommunicationActivityId[],
): CommunicationActivityEnablement {
  return Object.fromEntries(
    COMMUNICATION_ACTIVITY_IDS.map((activityId) => [
      activityId,
      enabledActivityIds.includes(activityId),
    ]),
  ) as CommunicationActivityEnablement;
}

function configuration(
  locales: readonly SpeechLocale[],
  enabledActivityIds: readonly CommunicationActivityId[] = COMMUNICATION_ACTIVITY_IDS,
): CommunicationReleaseConfiguration {
  return {
    explicitlyEnabled: enablement(enabledActivityIds),
    readiness: Object.fromEntries(
      COMMUNICATION_ACTIVITY_IDS.map((activityId) => [activityId, readyLocales(locales)]),
    ) as CommunicationReleaseReadiness,
  };
}

function runtimeConfiguration(value: unknown): CommunicationReleaseConfiguration {
  return value as CommunicationReleaseConfiguration;
}

describe('communication release readiness', () => {
  it('defaults every activity flag to false without environment-derived behavior', () => {
    expect(DEFAULT_COMMUNICATION_RELEASE.explicitlyEnabled).toEqual({
      peek: false,
      train: false,
      phone: false,
      story: false,
    });
    expect(evaluateCommunicationRelease(DEFAULT_COMMUNICATION_RELEASE).activities)
      .toEqual(COMMUNICATION_ACTIVITY_IDS.map((activityId) => ({
        activityId,
        explicitlyEnabled: false,
        status: 'not-ready',
      })));
  });

  it('requires all three exact locale packs for every activity', () => {
    expect(REQUIRED_COMMUNICATION_RELEASE_LOCALES).toEqual(['he-IL', 'en-US', 'en-GB']);
    const result = evaluateCommunicationRelease(
      configuration(REQUIRED_COMMUNICATION_RELEASE_LOCALES, ['peek', 'phone']),
    );

    expect(result.requiredLocales).toEqual(['he-IL', 'en-US', 'en-GB']);
    expect(result.activities).toEqual([
      { activityId: 'peek', explicitlyEnabled: true, status: 'ready' },
      { activityId: 'train', explicitlyEnabled: false, status: 'ready' },
      { activityId: 'phone', explicitlyEnabled: true, status: 'ready' },
      { activityId: 'story', explicitlyEnabled: false, status: 'ready' },
    ]);
  });

  it('evaluates missing locale readiness independently per activity', () => {
    const complete = configuration(REQUIRED_COMMUNICATION_RELEASE_LOCALES);
    const result = evaluateCommunicationRelease({
      ...complete,
      readiness: {
        ...complete.readiness,
        phone: readyLocales(['he-IL', 'en-US']),
      },
    });

    expect(result.activities.map(({ activityId, status }) => ({ activityId, status }))).toEqual([
      { activityId: 'peek', status: 'ready' },
      { activityId: 'train', status: 'ready' },
      { activityId: 'phone', status: 'not-ready' },
      { activityId: 'story', status: 'ready' },
    ]);
  });

  it('treats a completely missing activity readiness entry as not ready without throwing', () => {
    const complete = configuration(REQUIRED_COMMUNICATION_RELEASE_LOCALES);
    const malformed = runtimeConfiguration({
      explicitlyEnabled: complete.explicitlyEnabled,
      readiness: {
        peek: complete.readiness.peek,
        train: complete.readiness.train,
        story: complete.readiness.story,
      },
    });

    expect(() => evaluateCommunicationRelease(malformed)).not.toThrow();
    expect(evaluateCommunicationRelease(malformed).activities).toEqual([
      { activityId: 'peek', explicitlyEnabled: true, status: 'ready' },
      { activityId: 'train', explicitlyEnabled: true, status: 'ready' },
      { activityId: 'phone', explicitlyEnabled: true, status: 'not-ready' },
      { activityId: 'story', explicitlyEnabled: true, status: 'ready' },
    ]);
  });

  it('enables only exact true values when enablement entries are omitted or malformed', () => {
    const complete = configuration(REQUIRED_COMMUNICATION_RELEASE_LOCALES);
    const result = evaluateCommunicationRelease(runtimeConfiguration({
      explicitlyEnabled: {
        peek: true,
        phone: 'true',
      },
      readiness: complete.readiness,
    }));

    expect(result.activities.map(({ activityId, explicitlyEnabled }) => ({
      activityId,
      explicitlyEnabled,
    }))).toEqual([
      { activityId: 'peek', explicitlyEnabled: true },
      { activityId: 'train', explicitlyEnabled: false },
      { activityId: 'phone', explicitlyEnabled: false },
      { activityId: 'story', explicitlyEnabled: false },
    ]);
  });

  it.each([
    undefined,
    null,
    { explicitlyEnabled: undefined, readiness: undefined },
    { explicitlyEnabled: true, readiness: 'ready' },
    { explicitlyEnabled: [], readiness: [] },
  ])('fails malformed runtime configuration closed without throwing', (malformed) => {
    expect(() => evaluateCommunicationRelease(runtimeConfiguration(malformed))).not.toThrow();
    expect(evaluateCommunicationRelease(runtimeConfiguration(malformed)).activities)
      .toEqual(COMMUNICATION_ACTIVITY_IDS.map((activityId) => ({
        activityId,
        explicitlyEnabled: false,
        status: 'not-ready',
      })));
  });

  it('ignores inherited and accessor-backed runtime release values', () => {
    const complete = configuration(REQUIRED_COMMUNICATION_RELEASE_LOCALES);
    const explicitlyEnabled = Object.create({ phone: true }) as Record<string, unknown>;
    explicitlyEnabled.peek = true;
    const readiness = Object.create({
      phone: complete.readiness.phone,
    }) as Record<string, unknown>;
    readiness.peek = complete.readiness.peek;
    Object.defineProperty(readiness, 'train', {
      enumerable: true,
      get: () => {
        throw new Error('malformed readiness getter must not run');
      },
    });
    const malformed = runtimeConfiguration({
      explicitlyEnabled,
      readiness,
    });

    expect(() => evaluateCommunicationRelease(malformed)).not.toThrow();
    expect(evaluateCommunicationRelease(malformed).activities).toEqual([
      { activityId: 'peek', explicitlyEnabled: true, status: 'ready' },
      { activityId: 'train', explicitlyEnabled: false, status: 'not-ready' },
      { activityId: 'phone', explicitlyEnabled: false, status: 'not-ready' },
      { activityId: 'story', explicitlyEnabled: false, status: 'not-ready' },
    ]);
  });

  it('rejects readiness whose result locale does not match its exact key', () => {
    const complete = configuration(REQUIRED_COMMUNICATION_RELEASE_LOCALES);
    const result = evaluateCommunicationRelease({
      ...complete,
      readiness: {
        ...complete.readiness,
        peek: {
          ...complete.readiness.peek,
          'en-US': ready('en-GB'),
        },
      },
    });

    expect(result.activities[0]?.status).toBe('not-ready');
  });
});
