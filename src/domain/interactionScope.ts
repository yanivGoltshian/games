import type { SpeechLocale } from './types';

export interface InteractionScope {
  activityId: string;
  sessionId: string;
  roundId: string;
  stepId: string;
}

export type InteractionLocaleLockBoundary = 'session' | 'round' | 'step';

export interface InteractionLocaleLock {
  scope: InteractionScope;
  boundary: InteractionLocaleLockBoundary;
  locale: SpeechLocale;
}

export type InteractionInputSource = 'touch' | 'voice' | 'automatic';

export function interactionScopeKey(scope: InteractionScope): string {
  return [
    scope.activityId,
    scope.sessionId,
    scope.roundId,
    scope.stepId,
  ].join('\u0000');
}

export function sameInteractionScope(
  left: InteractionScope,
  right: InteractionScope,
): boolean {
  return interactionScopeKey(left) === interactionScopeKey(right);
}

export function createInteractionLocaleLock(
  scope: InteractionScope,
  locale: SpeechLocale,
  boundary: InteractionLocaleLockBoundary = 'round',
): InteractionLocaleLock {
  return { scope: { ...scope }, boundary, locale };
}

export function interactionLocaleUnitKey(
  scope: InteractionScope,
  boundary: InteractionLocaleLockBoundary,
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
  lock: InteractionLocaleLock,
  scope: InteractionScope,
  locale: SpeechLocale,
): boolean {
  return (
    interactionLocaleUnitKey(lock.scope, lock.boundary)
      === interactionLocaleUnitKey(scope, lock.boundary)
    && lock.locale === locale
  );
}
