import { describe, expect, it } from 'vitest';
import { createInitialProgress } from '../domain/progression';
import type { SpeechLocale } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';
import {
  buildCommunicationCaregiverItems,
  evaluateCommunicationPublicAvailability,
  type CommunicationIntegrationContract,
} from './integration';
import {
  evaluateCommunicationRelease,
  type CommunicationReleaseConfiguration,
  type CommunicationReleaseReadiness,
} from './release';

const EmptyGame = () => null;

function ready(locale: SpeechLocale): CommunicationAssetReadiness {
  return { status: 'ready', contentVersion: 'pack-1', locale };
}

const activityIds = ['peek', 'train', 'phone', 'story'] as const;

function readyRelease(): CommunicationReleaseConfiguration {
  return {
    explicitlyEnabled: true,
    readiness: Object.fromEntries(
      activityIds.map((activityId) => [activityId, { 'he-IL': ready('he-IL') }]),
    ) as CommunicationReleaseReadiness,
  };
}

describe('communication integration caregiver surface', () => {
  it.each([
    [0, ['peek', 'train', 'phone', 'story']],
    [1, ['train', 'phone', 'story']],
    [3, ['story']],
    [4, []],
  ] as const)(
    'requires all four registered components for public availability with %i registrations',
    (registrationCount, missingGameActivityIds) => {
      const release = readyRelease();
      const games = Object.fromEntries(
        activityIds.slice(0, registrationCount).map((activityId) => [
          activityId,
          { component: EmptyGame },
        ]),
      ) as CommunicationIntegrationContract['games'];
      const progress = createInitialProgress(false, 1);
      const result = evaluateCommunicationPublicAvailability(
        { release, games },
        progress.settings,
      );

      expect(result.available).toBe(registrationCount === 4);
      expect(result.release.enabledAndContentReady).toBe(true);
      expect(result.missingGameActivityIds).toEqual(missingGameActivityIds);
    },
  );

  it('returns only fixed-order caregiver-safe readiness and permitted metrics', () => {
    const readiness = {
      peek: { 'he-IL': ready('he-IL') },
      train: { 'he-IL': ready('he-IL') },
      phone: { 'he-IL': ready('he-IL') },
      story: { 'he-IL': ready('he-IL') },
    } satisfies CommunicationReleaseReadiness;
    const integration: CommunicationIntegrationContract = {
      release: { explicitlyEnabled: true, readiness },
      games: {
        phone: {
          component: EmptyGame,
          selectCaregiverMetrics: () => ({
            lastPlayedAt: 123,
            sessionsCompleted: 4,
          }),
        },
      },
    };
    const progress = createInitialProgress(false, 1);
    const items = buildCommunicationCaregiverItems(
      integration,
      progress,
      evaluateCommunicationRelease(integration.release, progress.settings),
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
