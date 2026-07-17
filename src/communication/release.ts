import { COMMUNICATION_ACTIVITY_IDS, type CommunicationActivityId } from '../domain/communicationGame';
import type { SpeechLocale } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';

export type CommunicationLocaleReadiness = Readonly<
  Partial<Record<SpeechLocale, CommunicationAssetReadiness>>
>;

export type CommunicationReleaseReadiness = Readonly<
  Record<CommunicationActivityId, CommunicationLocaleReadiness>
>;

export type CommunicationActivityEnablement = Readonly<
  Record<CommunicationActivityId, boolean>
>;

export interface CommunicationReleaseConfiguration {
  explicitlyEnabled: CommunicationActivityEnablement;
  readiness: CommunicationReleaseReadiness;
}

export interface CommunicationActivityReleaseStatus {
  activityId: CommunicationActivityId;
  explicitlyEnabled: boolean;
  status: 'ready' | 'not-ready';
}

export interface CommunicationReleaseEvaluation {
  requiredLocales: readonly SpeechLocale[];
  activities: readonly CommunicationActivityReleaseStatus[];
}

export const REQUIRED_COMMUNICATION_RELEASE_LOCALES = [
  'he-IL',
  'en-US',
  'en-GB',
] as const satisfies readonly SpeechLocale[];

function emptyReadiness(): CommunicationReleaseReadiness {
  return Object.fromEntries(
    COMMUNICATION_ACTIVITY_IDS.map((activityId) => [activityId, Object.freeze({})]),
  ) as CommunicationReleaseReadiness;
}

function disabledActivities(): CommunicationActivityEnablement {
  return Object.fromEntries(
    COMMUNICATION_ACTIVITY_IDS.map((activityId) => [activityId, false]),
  ) as CommunicationActivityEnablement;
}

export const DEFAULT_COMMUNICATION_RELEASE: CommunicationReleaseConfiguration = Object.freeze({
  explicitlyEnabled: Object.freeze(disabledActivities()),
  readiness: Object.freeze(emptyReadiness()),
});

function exactLocaleIsReady(
  readiness: CommunicationLocaleReadiness,
  locale: SpeechLocale,
): boolean {
  const result = readiness[locale];
  return result?.status === 'ready' && result.locale === locale;
}

export function evaluateCommunicationRelease(
  configuration: CommunicationReleaseConfiguration,
): CommunicationReleaseEvaluation {
  const requiredLocales = REQUIRED_COMMUNICATION_RELEASE_LOCALES;
  const activities = COMMUNICATION_ACTIVITY_IDS.map((activityId) => ({
    activityId,
    explicitlyEnabled: configuration.explicitlyEnabled[activityId],
    status: requiredLocales.every((locale) => (
      exactLocaleIsReady(configuration.readiness[activityId], locale)
    ))
      ? 'ready' as const
      : 'not-ready' as const,
  }));

  return {
    requiredLocales,
    activities,
  };
}
