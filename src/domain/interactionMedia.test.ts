import { describe, expect, it } from 'vitest';
import {
  createInteractionLocaleLock,
  interactionLocaleLockMatches,
  interactionScopeKey,
  sameInteractionScope,
  type InteractionMediaScope,
} from './interactionMedia';

const scope: InteractionMediaScope = {
  activityId: 'counting',
  sessionId: 'session-1',
  roundId: 'round-1',
  stepId: 'step-1',
};

describe('interaction media identity', () => {
  it('keeps scope identity stable across all four dimensions', () => {
    expect(sameInteractionScope(scope, { ...scope })).toBe(true);
    expect(sameInteractionScope(scope, { ...scope, stepId: 'step-2' })).toBe(false);
    expect(interactionScopeKey(scope)).toContain('round-1');
  });

  it('matches locale locks at session, round, and step boundaries', () => {
    const sessionLock = createInteractionLocaleLock(scope, 'he-IL', 'session');
    const roundLock = createInteractionLocaleLock(scope, 'he-IL', 'round');
    const stepLock = createInteractionLocaleLock(scope, 'he-IL', 'step');

    expect(interactionLocaleLockMatches(sessionLock, {
      ...scope,
      roundId: 'round-2',
      stepId: 'step-2',
    }, 'he-IL')).toBe(true);
    expect(interactionLocaleLockMatches(roundLock, {
      ...scope,
      stepId: 'step-2',
    }, 'he-IL')).toBe(true);
    expect(interactionLocaleLockMatches(stepLock, {
      ...scope,
      stepId: 'step-2',
    }, 'he-IL')).toBe(false);
    expect(interactionLocaleLockMatches(roundLock, scope, 'en-US')).toBe(false);
  });
});
