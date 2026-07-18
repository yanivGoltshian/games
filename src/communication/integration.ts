import { createElement, useCallback, useRef, type ComponentType } from 'react';
import {
  PeekAndDiscoverGame,
  PEEK_AND_DISCOVER_INSTALLED_CONTENT,
} from '../games/peekAndDiscover';
import {
  WORD_TRAIN_CONTENT_VERSION,
  WORD_TRAIN_INSTALLED_CONTENT,
} from '../content/syllableTrain';
import type { CommunicationActivityId } from '../domain/communicationGame';
import {
  recordCommunicationRound,
  recordCommunicationSessionCompleted,
  type CommunicationProgress,
} from '../domain/communicationProgress';
import type {
  AppProgress,
  DomainProgress,
  ProgressUpdateSummary,
  RecordedRound,
  ToddlerSettings,
} from '../domain/types';
import type { SpeechStatus } from '../services/speech';
import { SyllableTrainGame } from '../games/SyllableTrainGame';
import type { WordTrainMetrics } from '../games/wordTrainMetrics';
import { COMMUNICATION_SHELF_REGISTRY } from './registry';
import {
  evaluateCommunicationRelease,
  type CommunicationLocaleReadiness,
  type CommunicationReleaseConfiguration,
  type CommunicationReleaseEvaluation,
} from './release';

interface PersistedWordTrainMetricCounts {
  sessions: number;
  trainsSeen: number;
}

export function applyWordTrainCommunicationMetrics(
  progress: CommunicationProgress,
  persisted: Readonly<PersistedWordTrainMetricCounts>,
  metrics: Readonly<WordTrainMetrics>,
  playedAt = Date.now(),
): {
  progress: CommunicationProgress;
  persisted: PersistedWordTrainMetricCounts;
} {
  let nextProgress = progress;
  let persistedTrainsSeen = persisted.trainsSeen;
  const newTrainCount = Math.max(0, metrics.trainsSeen - persisted.trainsSeen);
  const newContentIds = metrics.recentContentIds.slice(-newTrainCount);
  for (const contentId of newContentIds) {
    if (
      nextProgress.contentVersion === WORD_TRAIN_CONTENT_VERSION
      && nextProgress.recentContentIds.includes(contentId)
    ) {
      continue;
    }
    nextProgress = recordCommunicationRound(
      nextProgress,
      WORD_TRAIN_CONTENT_VERSION,
      contentId,
      playedAt,
    );
    persistedTrainsSeen += 1;
  }

  const newSessionCount = Math.max(0, metrics.sessions - persisted.sessions);
  for (let index = 0; index < newSessionCount; index += 1) {
    nextProgress = recordCommunicationSessionCompleted(
      nextProgress,
      WORD_TRAIN_CONTENT_VERSION,
      playedAt,
    );
  }

  return {
    progress: nextProgress,
    persisted: {
      sessions: Math.max(persisted.sessions, metrics.sessions),
      trainsSeen: persistedTrainsSeen,
    },
  };
}

export interface CommunicationGameHostProps {
  activityId: CommunicationActivityId;
  settings: ToddlerSettings;
  overallStars: number;
  mediaReady: boolean;
  speechStatus: SpeechStatus;
  progress: CommunicationProgress;
  syllableTrainDomainProgress: DomainProgress;
  onProgressChange: (progress: CommunicationProgress) => void;
  onCompleteSyllableTrainRound: (round: RecordedRound) => ProgressUpdateSummary;
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

const TRAIN_RELEASE_READINESS = Object.freeze({
  'he-IL': Object.freeze({
    status: 'ready',
    contentVersion: WORD_TRAIN_INSTALLED_CONTENT.contentVersion,
    locale: 'he-IL',
  }),
  'en-US': Object.freeze({
    status: 'ready',
    contentVersion: WORD_TRAIN_INSTALLED_CONTENT.contentVersion,
    locale: 'en-US',
  }),
  'en-GB': Object.freeze({
    status: 'ready',
    contentVersion: WORD_TRAIN_INSTALLED_CONTENT.contentVersion,
    locale: 'en-GB',
  }),
} satisfies CommunicationLocaleReadiness);

const PROGRESSIVE_COMMUNICATION_RELEASE: CommunicationReleaseConfiguration = Object.freeze({
  explicitlyEnabled: Object.freeze({
    peek: true,
    train: true,
    phone: false,
    story: false,
  }),
  readiness: Object.freeze({
    peek: PEEK_RELEASE_READINESS,
    train: TRAIN_RELEASE_READINESS,
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

function TrainCommunicationGame({
  settings,
  overallStars,
  mediaReady,
  speechStatus,
  progress,
  syllableTrainDomainProgress,
  onCompleteSyllableTrainRound,
  onProgressChange,
  onBackToShelf,
}: CommunicationGameHostProps) {
  const latestProgressRef = useRef(progress);
  latestProgressRef.current = progress;
  const persistedMetricsRef = useRef({
    sessions: 0,
    trainsSeen: 0,
  });
  const handleCommunicationMetrics = useCallback((metrics: Readonly<WordTrainMetrics>): void => {
    const result = applyWordTrainCommunicationMetrics(
      latestProgressRef.current,
      persistedMetricsRef.current,
      metrics,
    );
    persistedMetricsRef.current = result.persisted;
    if (result.progress !== latestProgressRef.current) {
      latestProgressRef.current = result.progress;
      onProgressChange(result.progress);
    }
  }, [onProgressChange]);

  return createElement(SyllableTrainGame, {
    domainProgress: syllableTrainDomainProgress,
    settings,
    overallStars,
    mediaReady,
    speechStatus,
    onBack: onBackToShelf,
    onCompleteRound: onCompleteSyllableTrainRound,
    onCommunicationMetrics: handleCommunicationMetrics,
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
    train: Object.freeze({
      component: TrainCommunicationGame,
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
