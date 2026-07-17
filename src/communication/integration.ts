import type { ComponentType } from 'react';
import type { CommunicationActivityId } from '../domain/communicationGame';
import type { CommunicationProgress } from '../domain/communicationProgress';
import type { AppProgress, ToddlerSettings } from '../domain/types';
import { COMMUNICATION_SHELF_REGISTRY } from './registry';
import {
  DEFAULT_COMMUNICATION_RELEASE,
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

export interface CommunicationCaregiverItem extends CommunicationCaregiverMetrics {
  activityId: CommunicationActivityId;
  readiness: 'ready' | 'not-ready';
}

export const communicationIntegration: CommunicationIntegrationContract = Object.freeze({
  release: DEFAULT_COMMUNICATION_RELEASE,
  games: Object.freeze({}),
});

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
