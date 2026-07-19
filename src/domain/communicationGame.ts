import type { SpeechLocale } from './types';

export const MAX_COMMUNICATION_OPPORTUNITIES = 2;
export const COMMUNICATION_ACTIVITY_IDS = ['peek', 'phone'] as const;

export type CommunicationActivityId = (typeof COMMUNICATION_ACTIVITY_IDS)[number];

export interface CommunicationGameScope {
  activityId: string;
  sessionId: string;
  roundId: string;
  stepId: string;
}

export type CommunicationLocaleLockBoundary = 'session' | 'round' | 'step';

export interface CommunicationLocaleLock {
  scope: CommunicationGameScope;
  boundary: CommunicationLocaleLockBoundary;
  locale: SpeechLocale;
}

export type CommunicationInputSource = 'touch' | 'voice' | 'automatic';

export function isCommunicationActivityId(value: string): value is CommunicationActivityId {
  return COMMUNICATION_ACTIVITY_IDS.some((activityId) => activityId === value);
}

export function communicationScopeKey(scope: CommunicationGameScope): string {
  return [
    scope.activityId,
    scope.sessionId,
    scope.roundId,
    scope.stepId,
  ].join('\u0000');
}

export function sameCommunicationScope(
  left: CommunicationGameScope,
  right: CommunicationGameScope,
): boolean {
  return communicationScopeKey(left) === communicationScopeKey(right);
}

export function createCommunicationLocaleLock(
  scope: CommunicationGameScope,
  locale: SpeechLocale,
  boundary: CommunicationLocaleLockBoundary = 'round',
): CommunicationLocaleLock {
  return { scope: { ...scope }, boundary, locale };
}

export function communicationLocaleUnitKey(
  scope: CommunicationGameScope,
  boundary: CommunicationLocaleLockBoundary,
): string {
  const parts = [scope.activityId, scope.sessionId];
  if (boundary === 'round' || boundary === 'step') {
    parts.push(scope.roundId);
  }
  if (boundary === 'step') {
    parts.push(scope.stepId);
  }
  return parts.join('\u0000');
}

export function localeLockMatches(
  lock: CommunicationLocaleLock,
  scope: CommunicationGameScope,
  locale: SpeechLocale,
): boolean {
  return (
    communicationLocaleUnitKey(lock.scope, lock.boundary)
      === communicationLocaleUnitKey(scope, lock.boundary)
    && lock.locale === locale
  );
}

export function communicationOpportunityLimit(requested = MAX_COMMUNICATION_OPPORTUNITIES): 0 | 1 | 2 {
  if (!Number.isFinite(requested) || requested <= 0) {
    return 0;
  }
  return requested < MAX_COMMUNICATION_OPPORTUNITIES ? 1 : MAX_COMMUNICATION_OPPORTUNITIES;
}
