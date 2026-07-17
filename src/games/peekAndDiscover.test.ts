import { describe, expect, it } from 'vitest';
import {
  PEEK_AND_DISCOVER_ACTIVITY_ID,
  PEEK_AND_DISCOVER_CONTENT_VERSION,
  PeekAndDiscoverGame,
  createInitialPeekAndDiscoverState,
  createPeekAndDiscoverScope,
  peekAndDiscoverInteractionMediaCoordinator,
  reducePeekAndDiscover,
  resolvePeekAndDiscoverLocale,
} from './peekAndDiscover';

describe('peekAndDiscover barrel', () => {
  it('re-exports the public component, adapter helpers, reducer helpers, and game coordinator singleton', () => {
    expect(PeekAndDiscoverGame).toBeTypeOf('function');
    expect(createPeekAndDiscoverScope('session-1', 0)).toEqual({
      activityId: PEEK_AND_DISCOVER_ACTIVITY_ID,
      sessionId: 'session-1',
      roundId: 'round-1',
      stepId: 'word-1',
    });
    expect(resolvePeekAndDiscoverLocale({ languageMode: 'en', englishVoiceLocale: 'en-GB' }, 4)).toBe('en-GB');
    expect(createInitialPeekAndDiscoverState).toBeTypeOf('function');
    expect(reducePeekAndDiscover).toBeTypeOf('function');
    expect(peekAndDiscoverInteractionMediaCoordinator).toBeDefined();
    expect(PEEK_AND_DISCOVER_CONTENT_VERSION).toBe('peek-and-discover.v1');
  });
});
