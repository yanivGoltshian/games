import { describe, expect, it } from 'vitest';
import {
  applyProgressionChoice,
  applyRoundResult,
  buildPracticeWeights,
  createInitialProgress,
  recommendLevelAdvance,
  RECENT_RESULT_LIMIT,
} from './progression';
import { DOMAIN_KEYS } from './types';

describe('progression', () => {
  it('keeps number pairs as the sixth domain and silly alien as the last', () => {
    expect(DOMAIN_KEYS).toEqual([
      'listening',
      'counting',
      'sorting',
      'puzzle',
      'memory',
      'numberPairs',
      'sillyAlien',
    ]);
  });

  it('automatically applies a recommendation after three strong recent rounds', () => {
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

    expect(third.progress.domains.listening.level).toBe(2);
    expect(third.progress.domains.listening.highestLevel).toBe(2);
    expect(third.progress.domains.listening.lastProgressionChoice).toBe('next');
    expect(third.summary.recommendation).toEqual({ currentLevel: 1, nextLevel: 2 });
    expect(third.summary.leveledUp).toBe(true);
    expect(third.summary.level).toBe(2);
    expect(third.summary.milestone).toBe(true);
  });

  it('lets replay preserve an automatically accepted advancement', () => {
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
    expect(replay.domain.level).toBe(2);
    expect(replay.domain.highestLevel).toBe(2);
    expect(replay.domain.lastProgressionChoice).toBe('replay');

    const sameLevelRound = applyRoundResult(
      replay.progress,
      'counting',
      { attempts: 1, concepts: ['count-2'] },
      1020,
    );
    expect(sameLevelRound.summary.recommendation).toBeNull();
    expect(sameLevelRound.summary.leveledUp).toBe(false);
    expect(sameLevelRound.progress.domains.counting.level).toBe(2);
  });

  it('retains explicit next-level choice compatibility for eligible stored progress', () => {
    const progress = createInitialProgress(false, 1000);
    const domain = progress.domains.memory;
    domain.mastery = 0.9;
    domain.recentResults = Array.from({ length: 3 }, (_, index) => ({
      completedAt: 1001 + index,
      level: 1 as const,
      success: true,
      firstAttempt: true,
      attempts: 1,
    }));

    const next = applyProgressionChoice(progress, 'memory', 'next', 1010);

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

  it('automatically applies adaptive behavior for all seven domains', () => {
    for (const domain of DOMAIN_KEYS) {
      let progress = createInitialProgress(false, 1000);
      const roundsToAdvance = domain === 'puzzle' ? 2 : 3;
      let lastUpdate: ReturnType<typeof applyRoundResult> | undefined;
      for (let index = 0; index < roundsToAdvance; index += 1) {
        lastUpdate = applyRoundResult(
          progress,
          domain,
          {
            attempts: domain === 'sorting' || domain === 'puzzle' || domain === 'memory' ? 3 : 1,
            requiredActions: domain === 'sorting' || domain === 'puzzle' || domain === 'memory' ? 3 : 1,
            concepts: [`${domain}-concept`],
          },
          1001 + index,
        );
        progress = lastUpdate.progress;
      }

      expect(lastUpdate!.summary.leveledUp, domain).toBe(true);
      expect(progress.domains[domain].level, domain).toBe(2);
      expect(progress.domains[domain].highestLevel, domain).toBe(2);
      expect(progress.domains[domain].completedRounds, domain).toBe(roundsToAdvance);
      expect(progress.domains[domain].firstAttemptSuccesses, domain).toBe(roundsToAdvance);
      expect(progress.domains[domain].lastProgressionChoice, domain).toBe('next');
    }
  });

  describe('puzzle level-one clean streak', () => {
    it('advances on the second consecutive clean completion', () => {
      let progress = createInitialProgress(false, 1000);
      const first = applyRoundResult(
        progress,
        'puzzle',
        { attempts: 2, requiredActions: 2, concepts: ['scene'] },
        1001,
      );
      progress = first.progress;
      const second = applyRoundResult(
        progress,
        'puzzle',
        { attempts: 2, requiredActions: 2, concepts: ['scene'] },
        1002,
      );

      expect(first.summary.recommendation).toBeNull();
      expect(first.progress.domains.puzzle.level).toBe(1);
      expect(second.summary.recommendation).toEqual({ currentLevel: 1, nextLevel: 2 });
      expect(second.summary.leveledUp).toBe(true);
      expect(second.progress.domains.puzzle.level).toBe(2);
    });

    it('requires two new clean completions after a retry breaks the streak', () => {
      let progress = createInitialProgress(false, 1000);
      progress = applyRoundResult(
        progress,
        'puzzle',
        { attempts: 2, requiredActions: 2, concepts: ['scene'] },
        1001,
      ).progress;
      const retry = applyRoundResult(
        progress,
        'puzzle',
        { attempts: 3, requiredActions: 2, concepts: ['scene'] },
        1002,
      );
      const firstNewClean = applyRoundResult(
        retry.progress,
        'puzzle',
        { attempts: 2, requiredActions: 2, concepts: ['scene'] },
        1003,
      );
      const secondNewClean = applyRoundResult(
        firstNewClean.progress,
        'puzzle',
        { attempts: 2, requiredActions: 2, concepts: ['scene'] },
        1004,
      );

      expect(retry.summary.leveledUp).toBe(false);
      expect(firstNewClean.summary.leveledUp).toBe(false);
      expect(firstNewClean.progress.domains.puzzle.level).toBe(1);
      expect(secondNewClean.summary.leveledUp).toBe(true);
      expect(secondNewClean.progress.domains.puzzle.level).toBe(2);
    });

    it('retains the mastery threshold and normal level-two rules', () => {
      const lowMastery = createInitialProgress(false, 1000).domains.puzzle;
      lowMastery.mastery = 0.41;
      lowMastery.recentResults = [1001, 1002].map((completedAt) => ({
        completedAt,
        level: 1 as const,
        success: true,
        firstAttempt: true,
        attempts: 1,
      }));
      expect(recommendLevelAdvance(lowMastery, 'puzzle')).toBeNull();

      let progress = createInitialProgress(false, 1000);
      for (let index = 0; index < 2; index += 1) {
        progress = applyRoundResult(
          progress,
          'puzzle',
          { attempts: 2, requiredActions: 2, concepts: ['scene'] },
          1010 + index,
        ).progress;
      }
      for (let index = 0; index < 2; index += 1) {
        const update = applyRoundResult(
          progress,
          'puzzle',
          { attempts: 4, requiredActions: 4, concepts: ['scene'] },
          1020 + index,
        );
        expect(update.summary.leveledUp).toBe(false);
        progress = update.progress;
      }
      const thirdAtLevelTwo = applyRoundResult(
        progress,
        'puzzle',
        { attempts: 4, requiredActions: 4, concepts: ['scene'] },
        1022,
      );

      expect(thirdAtLevelTwo.summary.leveledUp).toBe(true);
      expect(thirdAtLevelTwo.progress.domains.puzzle.level).toBe(3);
    });
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
