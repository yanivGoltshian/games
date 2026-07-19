import { createElement, type ComponentType } from 'react';
import {
  PeekAndDiscoverGame,
  PEEK_AND_DISCOVER_INSTALLED_CONTENT,
} from '../games/peekAndDiscover';
import { TOY_PHONE_CONTENT_VERSION } from '../content/toyPhone';
import type { CommunicationActivityId } from '../domain/communicationGame';
import {
  createInitialCommunicationProgress,
  type CommunicationProgress,
} from '../domain/communicationProgress';
import type {
  AppProgress,
  CommunicationActivityProgressMap,
  DomainProgress,
  ProgressUpdateSummary,
  ToddlerSettings,
} from '../domain/types';
import type { SpeechStatus } from '../services/speech';
import { ToyPhoneGame } from '../games/ToyPhoneGame';
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
  overallStars: number;
  mediaReady: boolean;
  speechStatus: SpeechStatus;
  progress: CommunicationProgress;
  fallbackDomainProgress: DomainProgress;
  onProgressChange: (progress: CommunicationProgress) => void;
  onCompleteFallbackRound: () => ProgressUpdateSummary;
  onBackToShelf: () => void;
  onHome: () => void;
}

export type CommunicationCaregiverMetrics = Pick<
  CommunicationProgress,
  'lastPlayedAt' | 'sessionsCompleted'
>;

export interface CommunicationGameRegistration {
  component: ComponentType<CommunicationGameHostProps>;
  legacyContentVersion?: string;
  selectProgress?: (progress: AppProgress) => CommunicationProgress;
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

const PHONE_RELEASE_READINESS = Object.freeze({
  'he-IL': Object.freeze({
    status: 'ready',
    contentVersion: TOY_PHONE_CONTENT_VERSION,
    locale: 'he-IL',
  }),
  'en-US': Object.freeze({
    status: 'ready',
    contentVersion: TOY_PHONE_CONTENT_VERSION,
    locale: 'en-US',
  }),
  'en-GB': Object.freeze({
    status: 'ready',
    contentVersion: TOY_PHONE_CONTENT_VERSION,
    locale: 'en-GB',
  }),
} satisfies CommunicationLocaleReadiness);

const PROGRESSIVE_COMMUNICATION_RELEASE: CommunicationReleaseConfiguration = Object.freeze({
  explicitlyEnabled: Object.freeze({
    peek: true,
    phone: true,
  }),
  readiness: Object.freeze({
    peek: PEEK_RELEASE_READINESS,
    phone: PHONE_RELEASE_READINESS,
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

function ToyPhoneCommunicationGame({
  settings,
  overallStars,
  mediaReady,
  speechStatus,
  fallbackDomainProgress,
  onBackToShelf,
}: CommunicationGameHostProps) {
  return createElement(ToyPhoneGame, {
    domainProgress: fallbackDomainProgress,
    settings,
    overallStars,
    mediaReady,
    speechStatus,
    onBack: onBackToShelf,
    onCompleteRound: () => ({
      starsEarned: 0,
      leveledUp: false,
      milestone: false,
      level: fallbackDomainProgress.level,
      mastery: fallbackDomainProgress.mastery,
      firstAttempt: true,
      recommendation: null,
    }),
  });
}

function selectCommunicationActivityProgress(
  progress: AppProgress,
  activityId: CommunicationActivityId,
  contentVersion: string,
): CommunicationProgress {
  const activityProgress = progress.communicationActivities?.[activityId];
  if (activityProgress) {
    return activityProgress;
  }
  if (progress.communication.contentVersion === contentVersion) {
    return progress.communication;
  }
  return createInitialCommunicationProgress(contentVersion);
}

export function seedLegacyCommunicationActivities(
  progress: AppProgress,
  integration: CommunicationIntegrationContract,
): CommunicationActivityProgressMap {
  const activities: CommunicationActivityProgressMap = {
    ...progress.communicationActivities,
  };
  const contentVersion = progress.communication.contentVersion;
  if (!contentVersion) {
    return activities;
  }

  for (const activityId of Object.keys(integration.games) as CommunicationActivityId[]) {
    const registration = integration.games[activityId];
    if (
      registration?.legacyContentVersion === contentVersion
      && activities[activityId] === undefined
    ) {
      activities[activityId] = progress.communication;
    }
  }
  return activities;
}

export const communicationIntegration: CommunicationIntegrationContract = Object.freeze({
  release: PROGRESSIVE_COMMUNICATION_RELEASE,
  games: Object.freeze({
    peek: Object.freeze({
      component: PeekCommunicationGame,
      legacyContentVersion: PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
      selectProgress: (progress: AppProgress) => selectCommunicationActivityProgress(
        progress,
        'peek',
        PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
      ),
      selectCaregiverMetrics: (progress: AppProgress) => ({
        lastPlayedAt: selectCommunicationActivityProgress(
          progress,
          'peek',
          PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
        ).lastPlayedAt,
        sessionsCompleted: selectCommunicationActivityProgress(
          progress,
          'peek',
          PEEK_AND_DISCOVER_INSTALLED_CONTENT.contentVersion,
        ).sessionsCompleted,
      }),
    }),
    phone: Object.freeze({
      component: ToyPhoneCommunicationGame,
      selectProgress: (progress: AppProgress) => selectCommunicationActivityProgress(
        progress,
        'phone',
        TOY_PHONE_CONTENT_VERSION,
      ),
      selectCaregiverMetrics: () => ({
        lastPlayedAt: 0,
        sessionsCompleted: 0,
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
  return COMMUNICATION_SHELF_REGISTRY.filter((entry) => (
    integration.games[entry.activityId]?.component !== undefined
    && evaluation.activities.some((activity) => (
      activity.activityId === entry.activityId
      && activity.explicitlyEnabled
      && activity.status === 'ready'
    ))
  )).map((entry) => {
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
