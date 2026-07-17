import { describe, expect, it } from 'vitest';
import {
  MAX_COMMUNICATION_OPPORTUNITIES,
  communicationOpportunityLimit,
  communicationLocaleUnitKey,
  communicationScopeKey,
  createCommunicationLocaleLock,
  localeLockMatches,
  sameCommunicationScope,
  type CommunicationGameScope,
} from './communicationGame';

const scope: CommunicationGameScope = {
  activityId: 'peek',
  sessionId: 'session-1',
  roundId: 'round-1',
  stepId: 'step-1',
};

describe('communication game contracts', () => {
  it('locks one exact locale to one natural interaction scope', () => {
    const lock = createCommunicationLocaleLock(scope, 'he-IL');

    expect(localeLockMatches(lock, scope, 'he-IL')).toBe(true);
    expect(localeLockMatches(lock, scope, 'en-US')).toBe(false);
    expect(localeLockMatches(lock, { ...scope, roundId: 'round-2' }, 'he-IL')).toBe(false);
    expect(localeLockMatches(lock, { ...scope, stepId: 'step-2' }, 'he-IL')).toBe(true);
    expect(lock.boundary).toBe('round');
  });

  it('supports explicit session, round, and step locale boundaries', () => {
    const nextStep = { ...scope, stepId: 'step-2' };
    const nextRound = { ...scope, roundId: 'round-2', stepId: 'step-1' };

    expect(localeLockMatches(
      createCommunicationLocaleLock(scope, 'he-IL', 'session'),
      nextRound,
      'he-IL',
    )).toBe(true);
    expect(localeLockMatches(
      createCommunicationLocaleLock(scope, 'he-IL', 'step'),
      nextStep,
      'he-IL',
    )).toBe(false);
    expect(communicationLocaleUnitKey(scope, 'round')).toContain('round-1');
  });

  it('compares every scope identity boundary', () => {
    expect(sameCommunicationScope(scope, { ...scope })).toBe(true);
    expect(sameCommunicationScope(scope, { ...scope, stepId: 'step-2' })).toBe(false);
    expect(communicationScopeKey(scope)).toContain('round-1');
  });

  it('caps opportunities at two while allowing fewer', () => {
    expect(MAX_COMMUNICATION_OPPORTUNITIES).toBe(2);
    expect(communicationOpportunityLimit()).toBe(2);
    expect(communicationOpportunityLimit(1)).toBe(1);
    expect(communicationOpportunityLimit(0)).toBe(0);
    expect(communicationOpportunityLimit(20)).toBe(2);
  });
});
