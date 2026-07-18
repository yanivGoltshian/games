import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_ACTIVITY_IDS,
  type CommunicationActivityId,
} from '../domain/communicationGame';
import { createInitialCommunicationProgress } from '../domain/communicationProgress';
import { createInitialProgress } from '../domain/progression';
import type { SpeechLocale } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';
import { PEEK_AND_DISCOVER_INSTALLED_CONTENT } from '../games/peekAndDiscover';
import {
  WORD_TRAIN_CONTENT_VERSION,
  WORD_TRAIN_INSTALLED_CONTENT,
} from '../content/syllableTrain';
import { INITIAL_WORD_TRAIN_METRICS } from '../games/wordTrainMetrics';
import {
  applyWordTrainCommunicationMetrics,
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
  it('publishes only the production Peek and Train doors with exact installed locale readiness', () => {
    const result = evaluateCommunicationPublicAvailability(communicationIntegration);

    expect(communicationIntegration.release.explicitlyEnabled).toEqual({
      peek: true,
      train: true,
      phone: false,
      story: false,
    });
    expect(Object.keys(communicationIntegration.games)).toEqual(['peek', 'train']);
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
    expect(communicationIntegration.release.readiness.train).toEqual({
      'he-IL': {
        status: 'ready',
        contentVersion: WORD_TRAIN_INSTALLED_CONTENT.contentVersion,
        locale: 'he-IL',
      },
      'en-US': {
        status: 'ready',
        contentVersion: WORD_TRAIN_INSTALLED_CONTENT.contentVersion,
        locale: 'en-US',
      },
      'en-GB': {
        status: 'ready',
        contentVersion: WORD_TRAIN_INSTALLED_CONTENT.contentVersion,
        locale: 'en-GB',
      },
    });
    expect(result.available).toBe(true);
    expect(result.publicActivityIds).toEqual(['peek', 'train']);
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
        publiclyAvailable: true,
        explicitlyEnabled: true,
        componentRegistered: true,
        contentReady: true,
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
    const readiness = Object.fromEntries(
      Object.entries(release.readiness).filter(([activityId]) => activityId !== 'phone'),
    ) as Partial<CommunicationReleaseReadiness>;
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

  it('uses legacy matching communication progress for the released Train item', () => {
    const progress = {
      ...createInitialProgress(false, 1),
      communication: {
        version: 1 as const,
        contentVersion: 'word-train-v2',
        sessionsCompleted: 3,
        roundsSeen: 6,
        recentContentIds: ['ball', 'apple'],
        lastPlayedAt: 456,
      },
    };
    const items = buildCommunicationCaregiverItems(
      communicationIntegration,
      progress,
      evaluateCommunicationRelease(communicationIntegration.release),
    );

    expect(items.find((item) => item.activityId === 'train')).toEqual({
      activityId: 'train',
      lastPlayedAt: 456,
      sessionsCompleted: 3,
      readiness: 'ready',
    });
  });

  it('keeps Peek and Train caregiver metrics scoped to their own progress', () => {
    const progress = {
      ...createInitialProgress(false, 1),
      communicationActivities: {
        peek: {
          version: 1 as const,
          contentVersion: PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
          sessionsCompleted: 2,
          roundsSeen: 4,
          recentContentIds: ['peek-ball'],
          lastPlayedAt: 111,
        },
        train: {
          version: 1 as const,
          contentVersion: WORD_TRAIN_CONTENT_VERSION,
          sessionsCompleted: 3,
          roundsSeen: 6,
          recentContentIds: ['ball', 'apple'],
          lastPlayedAt: 222,
        },
      },
    };
    const items = buildCommunicationCaregiverItems(
      communicationIntegration,
      progress,
      evaluateCommunicationRelease(communicationIntegration.release),
    );

    expect(items.find((item) => item.activityId === 'peek')).toEqual({
      activityId: 'peek',
      lastPlayedAt: 111,
      sessionsCompleted: 2,
      readiness: 'ready',
    });
    expect(items.find((item) => item.activityId === 'train')).toEqual({
      activityId: 'train',
      lastPlayedAt: 222,
      sessionsCompleted: 3,
      readiness: 'ready',
    });
  });

  it('does not fall back to another activity when legacy content versions differ', () => {
    const progress = {
      ...createInitialProgress(false, 1),
      communication: {
        version: 1 as const,
        contentVersion: PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
        sessionsCompleted: 2,
        roundsSeen: 4,
        recentContentIds: ['peek-ball'],
        lastPlayedAt: 111,
      },
    };
    const items = buildCommunicationCaregiverItems(
      communicationIntegration,
      progress,
      evaluateCommunicationRelease(communicationIntegration.release),
    );

    expect(items.find((item) => item.activityId === 'peek')).toMatchObject({
      lastPlayedAt: 111,
      sessionsCompleted: 2,
    });
    expect(items.find((item) => item.activityId === 'train')).toMatchObject({
      lastPlayedAt: 0,
      sessionsCompleted: 0,
    });
  });

  it('recovers Train communication progress when content ids arrive after trainsSeen', () => {
    let result = applyWordTrainCommunicationMetrics(
      createInitialCommunicationProgress(null),
      { sessions: 0, trainsSeen: 0, contentIds: [] },
      {
        ...INITIAL_WORD_TRAIN_METRICS,
        trainsSeen: 1,
        recentContentIds: [],
      },
      100,
    );

    expect(result.progress).toMatchObject({
      contentVersion: null,
      roundsSeen: 0,
      recentContentIds: [],
      lastPlayedAt: 0,
    });
    expect(result.persisted).toEqual({ sessions: 0, trainsSeen: 0, contentIds: [] });

    result = applyWordTrainCommunicationMetrics(
      result.progress,
      result.persisted,
      {
        ...INITIAL_WORD_TRAIN_METRICS,
        trainsSeen: 1,
        recentContentIds: ['ball'],
      },
      101,
    );

    expect(result.progress).toMatchObject({
      contentVersion: WORD_TRAIN_CONTENT_VERSION,
      roundsSeen: 1,
      recentContentIds: ['ball'],
      lastPlayedAt: 101,
    });
    expect(result.persisted).toEqual({ sessions: 0, trainsSeen: 1, contentIds: ['ball'] });

    result = applyWordTrainCommunicationMetrics(
      result.progress,
      result.persisted,
      {
        ...INITIAL_WORD_TRAIN_METRICS,
        trainsSeen: 2,
        recentContentIds: ['ball'],
      },
      102,
    );

    expect(result.progress).toMatchObject({
      roundsSeen: 1,
      recentContentIds: ['ball'],
      lastPlayedAt: 101,
    });
    expect(result.persisted).toEqual({ sessions: 0, trainsSeen: 1, contentIds: ['ball'] });

    result = applyWordTrainCommunicationMetrics(
      result.progress,
      result.persisted,
      {
        ...INITIAL_WORD_TRAIN_METRICS,
        trainsSeen: 2,
        recentContentIds: ['ball', 'apple'],
      },
      103,
    );

    expect(result.progress).toMatchObject({
      roundsSeen: 2,
      recentContentIds: ['ball', 'apple'],
      lastPlayedAt: 103,
    });
    expect(result.persisted).toEqual({
      sessions: 0,
      trainsSeen: 2,
      contentIds: ['ball', 'apple'],
    });
  });

  it('counts a repeated Train concept in a later session as a new communication round', () => {
    const priorProgress = createInitialCommunicationProgress(WORD_TRAIN_CONTENT_VERSION);
    const withPriorBall = applyWordTrainCommunicationMetrics(
      priorProgress,
      { sessions: 0, trainsSeen: 0, contentIds: [] },
      {
        ...INITIAL_WORD_TRAIN_METRICS,
        trainsSeen: 1,
        recentContentIds: ['ball'],
      },
      100,
    ).progress;

    const nextSession = applyWordTrainCommunicationMetrics(
      withPriorBall,
      { sessions: 0, trainsSeen: 0, contentIds: [] },
      {
        ...INITIAL_WORD_TRAIN_METRICS,
        trainsSeen: 1,
        recentContentIds: ['ball'],
      },
      200,
    );

    expect(nextSession.progress).toMatchObject({
      contentVersion: WORD_TRAIN_CONTENT_VERSION,
      roundsSeen: 2,
      recentContentIds: ['ball'],
      lastPlayedAt: 200,
    });
    expect(nextSession.persisted).toEqual({
      sessions: 0,
      trainsSeen: 1,
      contentIds: ['ball'],
    });
  });
});
