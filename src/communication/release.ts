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

type UnknownRecord = Readonly<Record<PropertyKey, unknown>>;

const EMPTY_RUNTIME_RECORD: UnknownRecord = Object.freeze({});

function isRuntimeRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function runtimeRecord(value: unknown): UnknownRecord {
  return isRuntimeRecord(value) ? value : EMPTY_RUNTIME_RECORD;
}

function ownRuntimeValue(record: UnknownRecord, key: PropertyKey): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

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
  readiness: UnknownRecord,
  locale: SpeechLocale,
): boolean {
  const result = runtimeRecord(ownRuntimeValue(readiness, locale));
  return ownRuntimeValue(result, 'status') === 'ready'
    && ownRuntimeValue(result, 'locale') === locale;
}

export function evaluateCommunicationRelease(
  configuration: CommunicationReleaseConfiguration,
): CommunicationReleaseEvaluation {
  const requiredLocales = REQUIRED_COMMUNICATION_RELEASE_LOCALES;
  const runtimeConfiguration = runtimeRecord(configuration);
  const explicitlyEnabledByActivity = runtimeRecord(
    ownRuntimeValue(runtimeConfiguration, 'explicitlyEnabled'),
  );
  const readinessByActivity = runtimeRecord(ownRuntimeValue(runtimeConfiguration, 'readiness'));
  const activities = COMMUNICATION_ACTIVITY_IDS.map((activityId) => ({
    activityId,
    explicitlyEnabled: ownRuntimeValue(explicitlyEnabledByActivity, activityId) === true,
    status: requiredLocales.every((locale) => (
      exactLocaleIsReady(
        runtimeRecord(ownRuntimeValue(readinessByActivity, activityId)),
        locale,
      )
    ))
      ? 'ready' as const
      : 'not-ready' as const,
  }));

  return {
    requiredLocales,
    activities,
  };
}
