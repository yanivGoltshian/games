import { describe, expect, it } from 'vitest';
import {
  appendWordTrainContentId,
  INITIAL_WORD_TRAIN_METRICS,
} from './wordTrainMetrics';

describe('Word Train communication metrics', () => {
  it('contains only the nonclinical allowlist and never stores input method', () => {
    expect(Object.keys(INITIAL_WORD_TRAIN_METRICS).sort()).toEqual([
      'dragCancellations',
      'mediaErrors',
      'performanceTimings',
      'recentContentIds',
      'sessions',
      'trainsConnected',
      'trainsSeen',
    ]);
    expect(Object.keys(INITIAL_WORD_TRAIN_METRICS.performanceTimings).sort()).toEqual([
      'latestConnectionMs',
      'latestModelPlaybackMs',
      'sessionElapsedMs',
    ]);

    const serialized = JSON.stringify(INITIAL_WORD_TRAIN_METRICS).toLowerCase();
    for (const forbidden of [
      'attempt',
      'correct',
      'master',
      'accuracy',
      'articulation',
      'star',
      'voice',
      'touch',
      'automatic',
      'method',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('keeps recent content bounded and deduplicated', () => {
    expect(appendWordTrainContentId(['ball', 'cat'], 'ball', 3))
      .toEqual(['cat', 'ball']);
    expect(appendWordTrainContentId(['ball', 'cat', 'dog'], 'shoe', 3))
      .toEqual(['cat', 'dog', 'shoe']);
  });
});
