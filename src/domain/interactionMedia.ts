import type { SpeechLocale } from './types';

export interface InteractionMediaScope {
  activityId: string;
  sessionId: string;
  roundId: string;
  stepId: string;
}

export type InteractionLocaleLockBoundary = 'session' | 'round' | 'step';

export interface InteractionLocaleLock {
  scope: InteractionMediaScope;
  boundary: InteractionLocaleLockBoundary;
  locale: SpeechLocale;
}

export type InteractionInputSource = 'touch' | 'voice' | 'automatic';

export function interactionScopeKey(scope: InteractionMediaScope): string {
  return [
    scope.activityId,
    scope.sessionId,
    scope.roundId,
    scope.stepId,
  ].join('\u0000');
}

export function sameInteractionScope(
  left: InteractionMediaScope,
  right: InteractionMediaScope,
): boolean {
  return interactionScopeKey(left) === interactionScopeKey(right);
}

export function createInteractionLocaleLock(
  scope: InteractionMediaScope,
  locale: SpeechLocale,
  boundary: InteractionLocaleLockBoundary = 'round',
): InteractionLocaleLock {
  return { scope: { ...scope }, boundary, locale };
}

export function interactionLocaleUnitKey(
  scope: InteractionMediaScope,
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

export function interactionLocaleLockMatches(
  lock: InteractionLocaleLock,
  scope: InteractionMediaScope,
  locale: SpeechLocale,
): boolean {
  return (
    interactionLocaleUnitKey(lock.scope, lock.boundary)
      === interactionLocaleUnitKey(scope, lock.boundary)
    && lock.locale === locale
  );
}
