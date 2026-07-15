import { describe, expect, it } from 'vitest';
import { applyRoundResult, buildPracticeWeights, createInitialProgress } from './progression';

describe('progression', () => {
  it('levels up after repeated successful rounds', () => {
    let progress = createInitialProgress(false, 1000);

    for (let index = 0; index < 3; index += 1) {
      progress = applyRoundResult(progress, 'listening', { attempts: 1, concepts: ['dog'] }, 1001 + index).progress;
    }

    expect(progress.domains.listening.level).toBe(2);
    expect(progress.totalStars).toBeGreaterThanOrEqual(4);
    expect(progress.domains.listening.concepts.dog?.mastery).toBeGreaterThan(0.7);
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

  it('marks level-ups and small success streaks as milestones', () => {
    let progress = createInitialProgress(false, 1000);
    let thirdSummary;

    for (let index = 0; index < 3; index += 1) {
      const update = applyRoundResult(progress, 'listening', { attempts: 1, concepts: ['dog'] }, 1001 + index);
      progress = update.progress;
      thirdSummary = update.summary;
    }

    expect(thirdSummary?.leveledUp).toBe(true);
    expect(thirdSummary?.milestone).toBe(true);

    const fourthSummary = applyRoundResult(
      progress,
      'listening',
      { attempts: 1, concepts: ['dog'] },
      1004,
    ).summary;
    expect(fourthSummary.leveledUp).toBe(false);
    expect(fourthSummary.milestone).toBe(true);
  });
});
