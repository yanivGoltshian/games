import { COMMUNICATION_ACTIVITY_IDS, type CommunicationActivityId } from '../domain/communicationGame';
import type { SpeechLocale, ToddlerSettings } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';

export type CommunicationLocaleReadiness = Readonly<
  Partial<Record<SpeechLocale, CommunicationAssetReadiness>>
>;

export type CommunicationReleaseReadiness = Readonly<
  Record<CommunicationActivityId, CommunicationLocaleReadiness>
>;

export interface CommunicationReleaseConfiguration {
  explicitlyEnabled: boolean;
  readiness: CommunicationReleaseReadiness;
}

export interface CommunicationActivityReleaseStatus {
  activityId: CommunicationActivityId;
  status: 'ready' | 'not-ready';
}

export interface CommunicationReleaseEvaluation {
  enabledAndContentReady: boolean;
  requiredLocales: readonly SpeechLocale[];
  activities: readonly CommunicationActivityReleaseStatus[];
}

function emptyReadiness(): CommunicationReleaseReadiness {
  return Object.fromEntries(
    COMMUNICATION_ACTIVITY_IDS.map((activityId) => [activityId, Object.freeze({})]),
  ) as CommunicationReleaseReadiness;
}

export const DEFAULT_COMMUNICATION_RELEASE: CommunicationReleaseConfiguration = Object.freeze({
  explicitlyEnabled: false,
  readiness: Object.freeze(emptyReadiness()),
});

export function requiredCommunicationLocales(
  settings: Pick<ToddlerSettings, 'languageMode' | 'englishVoiceLocale'>,
): readonly SpeechLocale[] {
  if (settings.languageMode === 'he') {
    return ['he-IL'];
  }
  if (settings.languageMode === 'en') {
    return [settings.englishVoiceLocale];
  }
  return ['he-IL', settings.englishVoiceLocale];
}

function exactLocaleIsReady(
  readiness: CommunicationLocaleReadiness,
  locale: SpeechLocale,
): boolean {
  const result = readiness[locale];
  return result?.status === 'ready' && result.locale === locale;
}

export function evaluateCommunicationRelease(
  configuration: CommunicationReleaseConfiguration,
  settings: Pick<ToddlerSettings, 'languageMode' | 'englishVoiceLocale'>,
): CommunicationReleaseEvaluation {
  const requiredLocales = requiredCommunicationLocales(settings);
  const activities = COMMUNICATION_ACTIVITY_IDS.map((activityId) => ({
    activityId,
    status: requiredLocales.every((locale) => (
      exactLocaleIsReady(configuration.readiness[activityId], locale)
    ))
      ? 'ready' as const
      : 'not-ready' as const,
  }));

  return {
    enabledAndContentReady: configuration.explicitlyEnabled
      && activities.every((activity) => activity.status === 'ready'),
    requiredLocales,
    activities,
  };
}
