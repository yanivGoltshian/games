import { describe, expect, it } from 'vitest';
import {
  RECENT_COMMUNICATION_CONTENT_LIMIT,
  createInitialCommunicationProgress,
  recordCommunicationRound,
  recordCommunicationSessionCompleted,
} from './communicationProgress';

describe('communication progress', () => {
  it('records only nonclinical session and content history', () => {
    const initial = createInitialCommunicationProgress();
    const afterRound = recordCommunicationRound(initial, 'pack-1', 'phone-ring', 100);
    const completed = recordCommunicationSessionCompleted(afterRound, 'pack-1', 120);

    expect(completed).toEqual({
      version: 1,
      contentVersion: 'pack-1',
      sessionsCompleted: 1,
      roundsSeen: 1,
      recentContentIds: ['phone-ring'],
      lastPlayedAt: 120,
    });
    expect(Object.keys(completed).sort()).toEqual([
      'contentVersion',
      'lastPlayedAt',
      'recentContentIds',
      'roundsSeen',
      'sessionsCompleted',
      'version',
    ]);
  });

  it('bounds and de-duplicates recent content identifiers', () => {
    let progress = createInitialCommunicationProgress('pack-1');
    for (let index = 0; index <= RECENT_COMMUNICATION_CONTENT_LIMIT; index += 1) {
      progress = recordCommunicationRound(progress, 'pack-1', `content-${index}`, index);
    }
    progress = recordCommunicationRound(progress, 'pack-1', 'content-4', 99);

    expect(progress.roundsSeen).toBe(RECENT_COMMUNICATION_CONTENT_LIMIT + 2);
    expect(progress.recentContentIds).toHaveLength(RECENT_COMMUNICATION_CONTENT_LIMIT);
    expect(progress.recentContentIds.at(-1)).toBe('content-4');
    expect(progress.recentContentIds.filter((id) => id === 'content-4')).toHaveLength(1);
  });

  it('starts clean history when the installed content version changes', () => {
    const previous = recordCommunicationRound(
      createInitialCommunicationProgress(),
      'pack-1',
      'story-1',
      10,
    );
    const current = recordCommunicationSessionCompleted(previous, 'pack-2', 20);

    expect(current).toEqual({
      version: 1,
      contentVersion: 'pack-2',
      sessionsCompleted: 1,
      roundsSeen: 0,
      recentContentIds: [],
      lastPlayedAt: 20,
    });
  });
});
