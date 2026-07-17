import { createElement, type ComponentType } from 'react';
import {
  PeekAndDiscoverGame,
  PEEK_AND_DISCOVER_INSTALLED_CONTENT,
} from '../games/peekAndDiscover';
import type { CommunicationActivityId } from '../domain/communicationGame';
import type { CommunicationProgress } from '../domain/communicationProgress';
import type { AppProgress, ToddlerSettings } from '../domain/types';
import { COMMUNICATION_SHELF_REGISTRY } from './registry';
import {
  evaluateCommunicationRelease,
  type CommunicationLocaleReadiness,
  type CommunicationReleaseConfiguration,
  type CommunicationReleaseEvaluation,
} from './release';

export interface CommunicationGameHostProps {
  activityId: CommunicationActivityId;
  settings: ToddlerSettings;
  progress: CommunicationProgress;
  onProgressChange: (progress: CommunicationProgress) => void;
  onBackToShelf: () => void;
  onHome: () => void;
}

export type CommunicationCaregiverMetrics = Pick<
  CommunicationProgress,
  'lastPlayedAt' | 'sessionsCompleted'
>;

export interface CommunicationGameRegistration {
  component: ComponentType<CommunicationGameHostProps>;
  selectCaregiverMetrics?: (progress: AppProgress) => CommunicationCaregiverMetrics;
}

export interface CommunicationIntegrationContract {
  release: CommunicationReleaseConfiguration;
  games: Readonly<Partial<Record<CommunicationActivityId, CommunicationGameRegistration>>>;
}

export interface CommunicationPublicAvailability {
  available: boolean;
  publicActivityIds: readonly CommunicationActivityId[];
  release: CommunicationReleaseEvaluation;
  activities: readonly CommunicationActivityPublicStatus[];
}

export interface CommunicationActivityPublicStatus {
  activityId: CommunicationActivityId;
  publiclyAvailable: boolean;
  explicitlyEnabled: boolean;
  componentRegistered: boolean;
  contentReady: boolean;
}

export interface CommunicationCaregiverItem extends CommunicationCaregiverMetrics {
  activityId: CommunicationActivityId;
  readiness: 'ready' | 'not-ready';
}

const PEEK_RELEASE_READINESS = Object.freeze({
  'he-IL': Object.freeze({
    status: 'ready',
    contentVersion: PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
    locale: 'he-IL',
  }),
  'en-US': Object.freeze({
    status: 'ready',
    contentVersion: PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
    locale: 'en-US',
  }),
  'en-GB': Object.freeze({
    status: 'ready',
    contentVersion: PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
    locale: 'en-GB',
  }),
} satisfies CommunicationLocaleReadiness);

const PROGRESSIVE_COMMUNICATION_RELEASE: CommunicationReleaseConfiguration = Object.freeze({
  explicitlyEnabled: Object.freeze({
    peek: true,
    train: false,
    phone: false,
    story: false,
  }),
  readiness: Object.freeze({
    peek: PEEK_RELEASE_READINESS,
    train: Object.freeze({}),
    phone: Object.freeze({}),
    story: Object.freeze({}),
  }),
});

function PeekCommunicationGame({
  settings,
  progress,
  onProgressChange,
  onBackToShelf,
}: CommunicationGameHostProps) {
  return createElement(PeekAndDiscoverGame, {
    settings,
    communicationProgress: progress,
    onProgressChange,
    onAssetError: () => undefined,
    onSessionStop: () => undefined,
    onBack: onBackToShelf,
  });
}

export const communicationIntegration: CommunicationIntegrationContract = Object.freeze({
  release: PROGRESSIVE_COMMUNICATION_RELEASE,
  games: Object.freeze({
    peek: Object.freeze({
      component: PeekCommunicationGame,
      selectCaregiverMetrics: (progress: AppProgress) => ({
        lastPlayedAt: progress.communication.lastPlayedAt,
        sessionsCompleted: progress.communication.sessionsCompleted,
      }),
    }),
  }),
});

export function evaluateCommunicationPublicAvailability(
  integration: CommunicationIntegrationContract,
): CommunicationPublicAvailability {
  const release = evaluateCommunicationRelease(integration.release);
  const activities = COMMUNICATION_SHELF_REGISTRY.map(({ activityId }) => {
    const releaseStatus = release.activities.find((activity) => (
      activity.activityId === activityId
    ));
    const explicitlyEnabled = releaseStatus?.explicitlyEnabled ?? false;
    const contentReady = releaseStatus?.status === 'ready';
    const componentRegistered = integration.games[activityId]?.component !== undefined;
    return {
      activityId,
      publiclyAvailable: explicitlyEnabled && contentReady && componentRegistered,
      explicitlyEnabled,
      componentRegistered,
      contentReady,
    };
  });
  const publicActivityIds = activities
    .filter((activity) => activity.publiclyAvailable)
    .map((activity) => activity.activityId);

  return {
    available: publicActivityIds.length > 0,
    publicActivityIds,
    release,
    activities,
  };
}

export function buildCommunicationCaregiverItems(
  integration: CommunicationIntegrationContract,
  progress: AppProgress,
  evaluation: CommunicationReleaseEvaluation,
): readonly CommunicationCaregiverItem[] {
  return COMMUNICATION_SHELF_REGISTRY.map((entry) => {
    const metrics = integration.games[entry.activityId]?.selectCaregiverMetrics?.(progress) ?? {
      lastPlayedAt: 0,
      sessionsCompleted: 0,
    };
    const readiness = evaluation.activities.find((activity) => (
      activity.activityId === entry.activityId
    ))?.status ?? 'not-ready';

    return {
      activityId: entry.activityId,
      lastPlayedAt: metrics.lastPlayedAt,
      sessionsCompleted: metrics.sessionsCompleted,
      readiness,
    };
  });
}
