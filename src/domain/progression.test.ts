import { describe, expect, it } from 'vitest';
import {
  applyProgressionChoice,
  applyRoundResult,
  buildPracticeWeights,
  createInitialProgress,
  RECENT_RESULT_LIMIT,
} from './progression';
import { DOMAIN_KEYS } from './types';

describe('progression', () => {
  it('recommends a next level only after three strong recent rounds', () => {
    let progress = createInitialProgress(false, 1000);

    for (let index = 0; index < 2; index += 1) {
      const update = applyRoundResult(
        progress,
        'listening',
        { attempts: 1, concepts: ['dog'] },
        1001 + index,
      );
      progress = update.progress;
      expect(update.summary.recommendation).toBeNull();
      expect(update.summary.leveledUp).toBe(false);
      expect(progress.domains.listening.level).toBe(1);
    }

    const third = applyRoundResult(
      progress,
      'listening',
      { attempts: 1, concepts: ['dog'] },
      1003,
    );

    expect(third.progress.domains.listening.level).toBe(1);
    expect(third.summary.recommendation).toEqual({ currentLevel: 1, nextLevel: 2 });
    expect(third.summary.milestone).toBe(true);
  });

  it('accepts or replays a recommendation without automatic difficulty changes', () => {
    let progress = createInitialProgress(false, 1000);
    for (let index = 0; index < 3; index += 1) {
      progress = applyRoundResult(
        progress,
        'counting',
        { attempts: 1, concepts: ['count-2'] },
        1001 + index,
      ).progress;
    }

    const replay = applyProgressionChoice(progress, 'counting', 'replay', 1010);
    expect(replay.accepted).toBe(true);
    expect(replay.domain.level).toBe(1);
    expect(replay.domain.highestLevel).toBe(1);
    expect(replay.domain.lastProgressionChoice).toBe('replay');

    const next = applyProgressionChoice(replay.progress, 'counting', 'next', 1020);
    expect(next.accepted).toBe(true);
    expect(next.domain.level).toBe(2);
    expect(next.domain.highestLevel).toBe(2);
    expect(next.domain.lastProgressionChoice).toBe('next');
  });

  it('does not recommend advancement after retries or a single success', () => {
    let progress = createInitialProgress(false, 1000);
    progress = applyRoundResult(
      progress,
      'listening',
      { attempts: 1, requiredActions: 1, concepts: ['dog'] },
      1001,
    ).progress;
    progress = applyRoundResult(
      progress,
      'listening',
      { attempts: 3, requiredActions: 1, concepts: ['dog'] },
      1002,
    ).progress;
    const update = applyRoundResult(
      progress,
      'listening',
      { attempts: 1, requiredActions: 1, concepts: ['dog'] },
      1003,
    );

    expect(update.summary.recommendation).toBeNull();
    expect(update.progress.domains.listening.level).toBe(1);
    expect(update.progress.domains.listening.streak).toBe(1);
    expect(update.progress.domains.listening.totalAttempts).toBe(5);
    expect(update.progress.domains.listening.firstAttemptSuccesses).toBe(2);
  });

  it('keeps recent result history bounded', () => {
    let progress = createInitialProgress(false, 1000);

    for (let index = 0; index < RECENT_RESULT_LIMIT + 4; index += 1) {
      progress = applyRoundResult(
        progress,
        'memory',
        { attempts: 2, requiredActions: 2, concepts: ['dog', 'cat'] },
        1001 + index,
      ).progress;
    }

    const history = progress.domains.memory.recentResults;
    expect(history).toHaveLength(RECENT_RESULT_LIMIT);
    expect(history[0]?.completedAt).toBe(1005);
    expect(history.at(-1)?.completedAt).toBe(1009);
  });

  it('persists the same adaptive behavior for all five games', () => {
    for (const domain of DOMAIN_KEYS) {
      let progress = createInitialProgress(false, 1000);
      for (let index = 0; index < 3; index += 1) {
        progress = applyRoundResult(
          progress,
          domain,
          {
            attempts: domain === 'sorting' || domain === 'puzzle' || domain === 'memory' ? 3 : 1,
            requiredActions: domain === 'sorting' || domain === 'puzzle' || domain === 'memory' ? 3 : 1,
            concepts: [`${domain}-concept`],
          },
          1001 + index,
        ).progress;
      }

      const next = applyProgressionChoice(progress, domain, 'next', 1010);
      expect(next.accepted, domain).toBe(true);
      expect(next.domain.level, domain).toBe(2);
      expect(next.domain.completedRounds, domain).toBe(3);
      expect(next.domain.firstAttemptSuccesses, domain).toBe(3);
    }
  });

  it('prioritizes weaker concepts with heavier weights', () => {
    const progress = createInitialProgress(false, 1000);
    progress.domains.memory.concepts.duck = { attempts: 4, successes: 4, streak: 4, mastery: 0.95 };
    progress.domains.memory.concepts.ball = { attempts: 1, successes: 0, streak: 0, mastery: 0.1 };

    const weights = buildPracticeWeights(progress.domains.memory, ['duck', 'ball']);

    expect(weights.ball!).toBeGreaterThan(weights.duck!);
  });

  it('records retries as additional concept practice without blocking positive completion', () => {
    const initial = createInitialProgress(false, 1000);
    const efficient = applyRoundResult(initial, 'listening', {
      attempts: 1,
      requiredActions: 1,
      concepts: ['dog'],
    }).progress;
    const retried = applyRoundResult(initial, 'listening', {
      attempts: 3,
      requiredActions: 1,
      concepts: ['dog'],
    }).progress;

    expect(retried.totalStars).toBe(1);
    expect(retried.domains.listening.concepts.dog?.attempts).toBe(3);
    expect(retried.domains.listening.concepts.dog?.mastery).toBeLessThan(
      efficient.domains.listening.concepts.dog!.mastery,
    );
    expect(retried.domains.listening.streak).toBe(0);
  });
});
