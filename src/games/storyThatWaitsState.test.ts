import { describe, expect, it } from 'vitest';
import type { SpeechLocale } from '../domain/types';
import {
  getStoryThatWaitsGenerationToken,
  INITIAL_STORY_THAT_WAITS_STATE,
  reduceStoryThatWaits,
  STORY_THAT_WAITS_GUARD_MS,
  STORY_THAT_WAITS_MAX_OPPORTUNITIES as MAX_OPPORTUNITIES,
  STORY_THAT_WAITS_MISSING_SENTENCE_CODE,
  STORY_THAT_WAITS_PAGE_COUNT,
  STORY_THAT_WAITS_PHASES,
  STORY_THAT_WAITS_SESSION_MAX_MS,
  STORY_THAT_WAITS_TURN1_WINDOW_MS,
  STORY_THAT_WAITS_TURN2_WINDOW_MS,
  type MandatoryNarrationPages,
  type StoryThatWaitsState,
} from './storyThatWaitsState';

const ALL_PAGES_READY: MandatoryNarrationPages = [true, true, true, true];
const LOCKED_LOCALE: SpeechLocale = 'en-US';
const STORY_ID = 'duck-and-ball' as const;

function setElapsed(state: StoryThatWaitsState, deltaMs: number): StoryThatWaitsState {
  return reduceStoryThatWaits(state, {
    type: 'set-elapsed',
    elapsedMs: state.elapsedMs + deltaMs,
  });
}

function requestAndLoadStory(
  locale: SpeechLocale = LOCKED_LOCALE,
  pages: MandatoryNarrationPages = ALL_PAGES_READY,
): StoryThatWaitsState {
  let state = reduceStoryThatWaits(INITIAL_STORY_THAT_WAITS_STATE, {
    type: 'request-story',
    storyId: STORY_ID,
    locale,
  });
  state = reduceStoryThatWaits(state, { type: 'set-readiness', ready: true });
  return reduceStoryThatWaits(state, {
    type: 'story-ready',
    storyId: STORY_ID,
    locale,
    mandatoryNarrationPages: pages,
  });
}

function startTurn1(state: StoryThatWaitsState): StoryThatWaitsState {
  const narrated = reduceStoryThatWaits(state, {
    type: 'narration-completed',
    token: getStoryThatWaitsGenerationToken(state),
    completed: true,
  });
  return setElapsed(narrated, STORY_THAT_WAITS_GUARD_MS);
}

function goToPageTransitionFromTurn1(
  source: 'touch' | 'voice' | 'automatic',
): StoryThatWaitsState {
  let state = startTurn1(requestAndLoadStory());
  if (source === 'touch') {
    state = reduceStoryThatWaits(state, { type: 'touch-advance' });
  } else if (source === 'voice') {
    state = reduceStoryThatWaits(state, {
      type: 'coarse-effort-detected',
      token: getStoryThatWaitsGenerationToken(state),
    });
  } else {
    state = setElapsed(state, STORY_THAT_WAITS_TURN1_WINDOW_MS);
    state = setElapsed(state, STORY_THAT_WAITS_TURN2_WINDOW_MS);
  }
  return reduceStoryThatWaits(state, {
    type: 'page-action-finished',
    token: getStoryThatWaitsGenerationToken(state),
  });
}

function progressResult(state: StoryThatWaitsState) {
  return {
    phase: state.phase,
    readiness: state.readiness,
    storyId: state.storyId,
    locale: state.locale,
    pageIndex: state.pageIndex,
    pageGeneration: state.pageGeneration,
    queuedPageAdvanceIntent: state.queuedPageAdvanceIntent,
    narrationCompleted: state.narrationCompleted,
    assetErrorCode: state.assetErrorCode,
    diagnostic: state.diagnostic,
  };
}

function advanceOnePageByTouch(state: StoryThatWaitsState): StoryThatWaitsState {
  let next = startTurn1(state);
  next = reduceStoryThatWaits(next, { type: 'touch-advance' });
  next = reduceStoryThatWaits(next, {
    type: 'page-action-finished',
    token: getStoryThatWaitsGenerationToken(next),
  });
  next = reduceStoryThatWaits(next, {
    type: 'page-transition-finished',
    token: getStoryThatWaitsGenerationToken(next),
  });
  return next;
}

describe('storyThatWaitsState', () => {
  it('exports the exact phase list', () => {
    expect(STORY_THAT_WAITS_PHASES).toEqual([
      'tutorial',
      'loading-story',
      'narrating-page',
      'guard',
      'turn1',
      'turn2',
      'page-action',
      'page-transition',
      'ending',
      'rest',
      'paused',
      'asset-error',
    ]);
  });

  it('starts only after readiness and only from tutorial/loading', () => {
    const loading = reduceStoryThatWaits(INITIAL_STORY_THAT_WAITS_STATE, {
      type: 'request-story',
      storyId: STORY_ID,
      locale: LOCKED_LOCALE,
    });
    expect(loading.phase).toBe('loading-story');

    const notReady = reduceStoryThatWaits(loading, {
      type: 'story-ready',
      storyId: STORY_ID,
      locale: LOCKED_LOCALE,
      mandatoryNarrationPages: ALL_PAGES_READY,
    });
    expect(notReady).toBe(loading);

    const started = reduceStoryThatWaits(
      reduceStoryThatWaits(loading, { type: 'set-readiness', ready: true }),
      {
        type: 'story-ready',
        storyId: STORY_ID,
        locale: LOCKED_LOCALE,
        mandatoryNarrationPages: ALL_PAGES_READY,
      },
    );
    expect(started.phase).toBe('narrating-page');

    const rejectedRestart = reduceStoryThatWaits(startTurn1(started), {
      type: 'request-story',
      storyId: STORY_ID,
      locale: 'he-IL',
    });
    expect(rejectedRestart.phase).toBe('turn1');
    expect(rejectedRestart.locale).toBe(LOCKED_LOCALE);
  });

  it('keeps the locale locked for the full story session', () => {
    const loading = reduceStoryThatWaits(INITIAL_STORY_THAT_WAITS_STATE, {
      type: 'request-story',
      storyId: STORY_ID,
      locale: 'he-IL',
    });
    const stillLoading = reduceStoryThatWaits(loading, {
      type: 'request-story',
      storyId: STORY_ID,
      locale: 'en-US',
    });
    expect(stillLoading).toBe(loading);

    const ready = reduceStoryThatWaits(loading, { type: 'set-readiness', ready: true });
    const wrongLocaleReady = reduceStoryThatWaits(ready, {
      type: 'story-ready',
      storyId: STORY_ID,
      locale: 'en-US',
      mandatoryNarrationPages: ALL_PAGES_READY,
    });
    expect(wrongLocaleReady).toBe(ready);

    const started = reduceStoryThatWaits(ready, {
      type: 'story-ready',
      storyId: STORY_ID,
      locale: 'he-IL',
      mandatoryNarrationPages: ALL_PAGES_READY,
    });
    const paused = reduceStoryThatWaits(startTurn1(started), { type: 'pause' });
    const resumed = reduceStoryThatWaits(paused, { type: 'resume-after-pause' });

    expect(started.locale).toBe('he-IL');
    expect(paused.locale).toBe('he-IL');
    expect(resumed.locale).toBe('he-IL');
  });

  it('supports tutorial interruption without losing the session identity', () => {
    const turn1 = startTurn1(requestAndLoadStory());
    const interrupted = reduceStoryThatWaits(turn1, { type: 'interrupt-to-tutorial' });

    expect(interrupted.phase).toBe('tutorial');
    expect(interrupted.storyId).toBe(STORY_ID);
    expect(interrupted.locale).toBe(LOCKED_LOCALE);
    expect(interrupted.pageIndex).toBe(0);
    expect(interrupted.diagnostic).toContain('Tutorial');
  });

  it('requires mandatory narration and coalesces touch during narration', () => {
    const started = requestAndLoadStory();
    const queued = reduceStoryThatWaits(started, { type: 'touch-advance' });
    const queuedAgain = reduceStoryThatWaits(queued, { type: 'touch-advance' });

    expect(queued.phase).toBe('narrating-page');
    expect(queued.queuedPageAdvanceIntent).toBe(true);
    expect(queuedAgain).toBe(queued);

    const incomplete = reduceStoryThatWaits(queued, {
      type: 'narration-completed',
      token: getStoryThatWaitsGenerationToken(queued),
      completed: false,
    });
    expect(incomplete).toBe(queued);

    const guard = reduceStoryThatWaits(queued, {
      type: 'narration-completed',
      token: getStoryThatWaitsGenerationToken(queued),
      completed: true,
    });
    expect(guard.phase).toBe('guard');
    expect(guard.queuedPageAdvanceIntent).toBe(true);
  });

  it('treats 399ms as insufficient and 400ms as the guard opening point', () => {
    const started = requestAndLoadStory();
    const guard = reduceStoryThatWaits(started, {
      type: 'narration-completed',
      token: getStoryThatWaitsGenerationToken(started),
      completed: true,
    });
    const tooSoon = setElapsed(guard, STORY_THAT_WAITS_GUARD_MS - 1);
    const opened = setElapsed(tooSoon, 1);

    expect(tooSoon.phase).toBe('guard');
    expect(opened.phase).toBe('turn1');
  });

  it('caps opportunity windows at two and makes turn2 auto-complete visually', () => {
    const turn1 = startTurn1(requestAndLoadStory());
    const turn2 = setElapsed(turn1, STORY_THAT_WAITS_TURN1_WINDOW_MS);
    const action = setElapsed(turn2, STORY_THAT_WAITS_TURN2_WINDOW_MS);

    expect(turn1.phase).toBe('turn1');
    expect(turn1.opportunityCount).toBe(1);
    expect(turn2.phase).toBe('turn2');
    expect(turn2.opportunityCount).toBe(MAX_OPPORTUNITIES);
    expect(action.phase).toBe('page-action');
    expect(action.opportunityCount).toBe(MAX_OPPORTUNITIES);
  });

  it('routes touch, coarse effort, and timeout through the same action and transition phases', () => {
    const touch = goToPageTransitionFromTurn1('touch');
    const voice = goToPageTransitionFromTurn1('voice');
    const automatic = goToPageTransitionFromTurn1('automatic');

    expect(touch.phase).toBe('page-transition');
    expect(progressResult(voice)).toEqual(progressResult(touch));
    expect(progressResult(automatic)).toEqual(progressResult(touch));
    expect('actionSource' in touch).toBe(false);
  });

  it('never skips a page when taps arrive rapidly', () => {
    let state = requestAndLoadStory();
    state = reduceStoryThatWaits(state, { type: 'touch-advance' });
    state = reduceStoryThatWaits(state, { type: 'touch-advance' });
    state = reduceStoryThatWaits(state, {
      type: 'narration-completed',
      token: getStoryThatWaitsGenerationToken(state),
      completed: true,
    });
    state = setElapsed(state, STORY_THAT_WAITS_GUARD_MS);
    const pageAction = state;

    state = reduceStoryThatWaits(state, { type: 'touch-advance' });
    expect(state).toBe(pageAction);

    state = reduceStoryThatWaits(state, {
      type: 'page-action-finished',
      token: getStoryThatWaitsGenerationToken(state),
    });
    const pageTransition = state;
    state = reduceStoryThatWaits(state, { type: 'touch-advance' });
    expect(state).toBe(pageTransition);

    state = reduceStoryThatWaits(state, {
      type: 'page-transition-finished',
      token: getStoryThatWaitsGenerationToken(state),
    });
    expect(state.pageIndex).toBe(1);
  });

  it('handles microphone denial and ignores a late mic callback', () => {
    const turn1 = startTurn1(requestAndLoadStory());
    const turnToken = getStoryThatWaitsGenerationToken(turn1);
    let state = reduceStoryThatWaits(turn1, {
      type: 'microphone-denied',
      token: turnToken,
    });

    expect(state.phase).toBe('page-action');

    state = reduceStoryThatWaits(state, {
      type: 'page-action-finished',
      token: getStoryThatWaitsGenerationToken(state),
    });
    state = reduceStoryThatWaits(state, {
      type: 'page-transition-finished',
      token: getStoryThatWaitsGenerationToken(state),
    });
    const lateVoice = reduceStoryThatWaits(state, {
      type: 'coarse-effort-detected',
      token: turnToken,
    });
    expect(lateVoice).toBe(state);
  });

  it('pauses from active states, ignores foreground autoplay, and resumes silently on the same page', () => {
    const turn1 = startTurn1(requestAndLoadStory());
    const paused = reduceStoryThatWaits(turn1, { type: 'pause' });
    const foregrounded = reduceStoryThatWaits(paused, { type: 'foregrounded' });
    const resumed = reduceStoryThatWaits(paused, { type: 'resume-after-pause' });

    expect(paused.phase).toBe('paused');
    expect(paused.pausedResumeTarget).toBe('turn1');
    expect(paused.pageIndex).toBe(0);
    expect(paused.locale).toBe(LOCKED_LOCALE);
    expect(foregrounded).toBe(paused);
    expect(resumed.phase).toBe('guard');
    expect(resumed.pageIndex).toBe(0);
    expect(resumed.narrationCompleted).toBe(true);
  });

  it('ignores elapsed deadline callbacks that race with pause', () => {
    const paused = reduceStoryThatWaits(requestAndLoadStory(), { type: 'pause' });
    const raced = reduceStoryThatWaits(paused, {
      type: 'set-elapsed',
      elapsedMs: STORY_THAT_WAITS_SESSION_MAX_MS,
    });

    expect(raced).toBe(paused);
    expect(raced.phase).toBe('paused');
  });

  it('treats orientation and layout changes as pure no-ops', () => {
    const state = startTurn1(requestAndLoadStory());
    expect(reduceStoryThatWaits(state, { type: 'orientation-changed' })).toBe(state);
    expect(reduceStoryThatWaits(state, { type: 'layout-changed' })).toBe(state);
  });

  it('blocks the story when even one mandatory sentence is missing', () => {
    const blocked = requestAndLoadStory(LOCKED_LOCALE, [true, false, true, true]);

    expect(blocked.phase).toBe('asset-error');
    expect(blocked.assetErrorCode).toBe(STORY_THAT_WAITS_MISSING_SENTENCE_CODE);
    expect(blocked.pageIndex).toBe(1);
    expect(blocked.diagnostic).toContain('page 2');
  });

  it('reaches ending after page four and then rests, and also respects the 2.5 minute session stop', () => {
    let state = requestAndLoadStory();
    for (let page = 0; page < STORY_THAT_WAITS_PAGE_COUNT - 1; page += 1) {
      state = advanceOnePageByTouch(state);
    }

    state = startTurn1(state);
    state = reduceStoryThatWaits(state, { type: 'touch-advance' });
    state = reduceStoryThatWaits(state, {
      type: 'page-action-finished',
      token: getStoryThatWaitsGenerationToken(state),
    });
    state = reduceStoryThatWaits(state, {
      type: 'page-transition-finished',
      token: getStoryThatWaitsGenerationToken(state),
    });
    expect(state.phase).toBe('ending');

    const rested = reduceStoryThatWaits(state, {
      type: 'ending-finished',
      token: getStoryThatWaitsGenerationToken(state),
    });
    expect(rested.phase).toBe('rest');

    const timedOut = reduceStoryThatWaits(startTurn1(requestAndLoadStory()), {
      type: 'set-elapsed',
      elapsedMs: STORY_THAT_WAITS_SESSION_MAX_MS,
    });
    expect(timedOut.phase).toBe('ending');
    expect(STORY_THAT_WAITS_SESSION_MAX_MS).toBeLessThanOrEqual(150000);
  });

  it('never auto-starts a second story from rest', () => {
    let rest = requestAndLoadStory();
    for (let page = 0; page < STORY_THAT_WAITS_PAGE_COUNT - 1; page += 1) {
      rest = advanceOnePageByTouch(rest);
    }
    rest = startTurn1(rest);
    rest = reduceStoryThatWaits(rest, { type: 'touch-advance' });
    rest = reduceStoryThatWaits(rest, {
      type: 'page-action-finished',
      token: getStoryThatWaitsGenerationToken(rest),
    });
    rest = reduceStoryThatWaits(rest, {
      type: 'page-transition-finished',
      token: getStoryThatWaitsGenerationToken(rest),
    });
    rest = reduceStoryThatWaits(rest, {
      type: 'ending-finished',
      token: getStoryThatWaitsGenerationToken(rest),
    });

    const attemptedRestart = reduceStoryThatWaits(rest, {
      type: 'request-story',
      storyId: STORY_ID,
      locale: 'he-IL',
    });
    expect(attemptedRestart).toBe(rest);
  });

  it('ignores stale callbacks with mismatched generation tokens', () => {
    const started = requestAndLoadStory();
    const staleNarration = {
      ...getStoryThatWaitsGenerationToken(started),
      stepGeneration: getStoryThatWaitsGenerationToken(started).stepGeneration + 1,
    };
    expect(
      reduceStoryThatWaits(started, {
        type: 'narration-completed',
        token: staleNarration,
        completed: true,
      }),
    ).toBe(started);

    const turn1 = startTurn1(started);
    const stalePage = {
      ...getStoryThatWaitsGenerationToken(turn1),
      pageGeneration: getStoryThatWaitsGenerationToken(turn1).pageGeneration + 1,
    };
    expect(
      reduceStoryThatWaits(turn1, {
        type: 'coarse-effort-detected',
        token: stalePage,
      }),
    ).toBe(turn1);
  });

  it('makes mandatory media failure terminal for the current story', () => {
    const started = requestAndLoadStory();
    const failed = reduceStoryThatWaits(started, {
      type: 'mandatory-media-failed',
      diagnostic: 'Mandatory narration failed.',
    });

    expect(failed.phase).toBe('asset-error');
    expect(failed.assetErrorCode).toBe('mandatory-media-error');
    expect(failed.diagnostic).toBe('Mandatory narration failed.');
    expect(setElapsed(failed, STORY_THAT_WAITS_SESSION_MAX_MS)).toEqual(failed);
    expect(reduceStoryThatWaits(failed, { type: 'touch-advance' })).toBe(failed);
  });

  it('uses same-reference no-ops for repeated or irrelevant events', () => {
    expect(
      reduceStoryThatWaits(INITIAL_STORY_THAT_WAITS_STATE, {
        type: 'set-readiness',
        ready: false,
      }),
    ).toBe(INITIAL_STORY_THAT_WAITS_STATE);

    const loading = reduceStoryThatWaits(INITIAL_STORY_THAT_WAITS_STATE, {
      type: 'request-story',
      storyId: STORY_ID,
      locale: LOCKED_LOCALE,
    });
    expect(
      reduceStoryThatWaits(loading, {
        type: 'request-story',
        storyId: STORY_ID,
        locale: LOCKED_LOCALE,
      }),
    ).toBe(loading);

    const paused = reduceStoryThatWaits(startTurn1(requestAndLoadStory()), { type: 'pause' });
    expect(reduceStoryThatWaits(paused, { type: 'foregrounded' })).toBe(paused);
  });
});
