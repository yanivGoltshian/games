import { describe, expect, it } from 'vitest';
import { createInitialProgress } from '../domain/progression';
import type { SpeechLocale } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';
import {
  buildCommunicationCaregiverItems,
  type CommunicationIntegrationContract,
} from './integration';
import { evaluateCommunicationRelease, type CommunicationReleaseReadiness } from './release';

const EmptyGame = () => null;

function ready(locale: SpeechLocale): CommunicationAssetReadiness {
  return { status: 'ready', contentVersion: 'pack-1', locale };
}

describe('communication integration caregiver surface', () => {
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
