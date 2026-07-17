import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_ACTIVITY_IDS,
  type CommunicationActivityId,
} from '../domain/communicationGame';
import { createInitialProgress } from '../domain/progression';
import type { SpeechLocale } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';
import { PEEK_AND_DISCOVER_INSTALLED_CONTENT } from '../games/peekAndDiscover';
import {
  buildCommunicationCaregiverItems,
  communicationIntegration,
  evaluateCommunicationPublicAvailability,
  type CommunicationIntegrationContract,
} from './integration';
import {
  evaluateCommunicationRelease,
  REQUIRED_COMMUNICATION_RELEASE_LOCALES,
  type CommunicationActivityEnablement,
  type CommunicationReleaseConfiguration,
  type CommunicationReleaseReadiness,
} from './release';

const EmptyGame = () => null;

function ready(locale: SpeechLocale): CommunicationAssetReadiness {
  return { status: 'ready', contentVersion: 'pack-1', locale };
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

function readyRelease(
  enabledActivityIds: readonly CommunicationActivityId[],
  readinessPatch: Partial<CommunicationReleaseReadiness> = {},
): CommunicationReleaseConfiguration {
  const readyForRelease = Object.fromEntries(
    REQUIRED_COMMUNICATION_RELEASE_LOCALES.map((locale) => [locale, ready(locale)]),
  );
  return {
    explicitlyEnabled: enablement(enabledActivityIds),
    readiness: {
      ...Object.fromEntries(
        COMMUNICATION_ACTIVITY_IDS.map((activityId) => [activityId, readyForRelease]),
      ) as CommunicationReleaseReadiness,
      ...readinessPatch,
    },
  };
}

function integration(
  enabledActivityIds: readonly CommunicationActivityId[],
  registeredActivityIds: readonly CommunicationActivityId[],
  readinessPatch: Partial<CommunicationReleaseReadiness> = {},
): CommunicationIntegrationContract {
  return {
    release: readyRelease(enabledActivityIds, readinessPatch),
    games: Object.fromEntries(
      registeredActivityIds.map((activityId) => [activityId, { component: EmptyGame }]),
    ) as CommunicationIntegrationContract['games'],
  };
}

describe('communication integration selectors', () => {
  it('publishes only the production Peek door with exact installed locale readiness', () => {
    const result = evaluateCommunicationPublicAvailability(communicationIntegration);

    expect(communicationIntegration.release.explicitlyEnabled).toEqual({
      peek: true,
      train: false,
      phone: false,
      story: false,
    });
    expect(Object.keys(communicationIntegration.games)).toEqual(['peek']);
    expect(communicationIntegration.release.readiness.peek).toEqual({
      'he-IL': {
        status: 'ready',
        contentVersion: PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
        locale: 'he-IL',
      },
      'en-US': {
        status: 'ready',
        contentVersion: PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
        locale: 'en-US',
      },
      'en-GB': {
        status: 'ready',
        contentVersion: PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
        locale: 'en-GB',
      },
    });
    expect(result.available).toBe(true);
    expect(result.publicActivityIds).toEqual(['peek']);
    expect(result.activities).toEqual([
      {
        activityId: 'peek',
        publiclyAvailable: true,
        explicitlyEnabled: true,
        componentRegistered: true,
        contentReady: true,
      },
      {
        activityId: 'train',
        publiclyAvailable: false,
        explicitlyEnabled: false,
        componentRegistered: false,
        contentReady: false,
      },
      {
        activityId: 'phone',
        publiclyAvailable: false,
        explicitlyEnabled: false,
        componentRegistered: false,
        contentReady: false,
      },
      {
        activityId: 'story',
        publiclyAvailable: false,
        explicitlyEnabled: false,
        componentRegistered: false,
        contentReady: false,
      },
    ]);
  });

  it.each([
    [['story'], ['story']],
    [['phone', 'peek'], ['peek', 'phone']],
    [COMMUNICATION_ACTIVITY_IDS, COMMUNICATION_ACTIVITY_IDS],
  ] as const)(
    'publishes enabled, registered, ready activities in fixed registry order',
    (enabledActivityIds, expectedPublicActivityIds) => {
      const result = evaluateCommunicationPublicAvailability(
        integration(enabledActivityIds, COMMUNICATION_ACTIVITY_IDS),
      );

      expect(result.available).toBe(true);
      expect(result.publicActivityIds).toEqual(expectedPublicActivityIds);
    },
  );

  it('keeps ready and registered activities private when their own flags are false', () => {
    const result = evaluateCommunicationPublicAvailability(
      integration([], COMMUNICATION_ACTIVITY_IDS),
    );

    expect(result.available).toBe(false);
    expect(result.publicActivityIds).toEqual([]);
    expect(result.activities.every((activity) => !activity.publiclyAvailable)).toBe(true);
  });

  it('fails only the affected activity closed for a missing component', () => {
    const result = evaluateCommunicationPublicAvailability(
      integration(['peek', 'phone'], ['peek']),
    );

    expect(result.available).toBe(true);
    expect(result.publicActivityIds).toEqual(['peek']);
    expect(result.activities.find(({ activityId }) => activityId === 'phone')).toMatchObject({
      publiclyAvailable: false,
      explicitlyEnabled: true,
      componentRegistered: false,
      contentReady: true,
    });
  });

  it('fails only the affected activity closed for any missing exact locale pack', () => {
    const result = evaluateCommunicationPublicAvailability(
      integration(['peek', 'phone'], ['peek', 'phone'], {
        phone: {
          'he-IL': ready('he-IL'),
          'en-US': ready('en-US'),
        },
      }),
    );

    expect(result.publicActivityIds).toEqual(['peek']);
    expect(result.activities.find(({ activityId }) => activityId === 'phone')).toMatchObject({
      publiclyAvailable: false,
      contentReady: false,
    });
  });

  it('fails an activity closed instead of throwing when its readiness map is omitted', () => {
    const release = readyRelease(['peek', 'phone']);
    const readiness: Partial<CommunicationReleaseReadiness> = {
      ...release.readiness,
    };
    delete readiness.phone;
    const result = evaluateCommunicationPublicAvailability({
      release: {
        ...release,
        readiness: readiness as CommunicationReleaseReadiness,
      },
      games: {
        peek: { component: EmptyGame },
        phone: { component: EmptyGame },
      },
    });

    expect(result.publicActivityIds).toEqual(['peek']);
    expect(result.activities.find(({ activityId }) => activityId === 'phone')).toMatchObject({
      publiclyAvailable: false,
      explicitlyEnabled: true,
      componentRegistered: true,
      contentReady: false,
    });
  });

  it('keeps a valid activity public when another enabled activity has malformed readiness', () => {
    const contract = integration(['peek', 'phone'], ['peek', 'phone']);
    const malformed = {
      ...contract,
      release: {
        ...contract.release,
        readiness: {
          peek: contract.release.readiness.peek,
          train: contract.release.readiness.train,
          phone: undefined,
          story: contract.release.readiness.story,
        },
      },
    } as unknown as CommunicationIntegrationContract;

    expect(() => evaluateCommunicationPublicAvailability(malformed)).not.toThrow();
    const result = evaluateCommunicationPublicAvailability(malformed);
    expect(result.available).toBe(true);
    expect(result.publicActivityIds).toEqual(['peek']);
    expect(result.activities.find(({ activityId }) => activityId === 'phone')).toMatchObject({
      publiclyAvailable: false,
      explicitlyEnabled: true,
      componentRegistered: true,
      contentReady: false,
    });
  });

  it('returns only fixed-order caregiver-safe readiness and permitted metrics', () => {
    const contract = integration(['phone'], ['phone']);
    contract.games.phone!.selectCaregiverMetrics = () => ({
      lastPlayedAt: 123,
      sessionsCompleted: 4,
    });
    const progress = createInitialProgress(false, 1);
    const items = buildCommunicationCaregiverItems(
      contract,
      progress,
      evaluateCommunicationRelease(contract.release),
    );

    expect(items.map((item) => item.activityId)).toEqual(['peek', 'train', 'phone', 'story']);
    expect(items[2]).toEqual({
      activityId: 'phone',
      lastPlayedAt: 123,
      sessionsCompleted: 4,
      readiness: 'ready',
    });
    expect(Object.keys(items[2]!)).toEqual([
      'activityId',
      'lastPlayedAt',
      'sessionsCompleted',
      'readiness',
    ]);
    expect(JSON.stringify(items)).not.toMatch(/url|asset|recording|transcript|accuracy|completion/i);
  });
});
