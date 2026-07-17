import { describe, expect, it } from 'vitest';
import {
  createInitialCommunicationProgress,
  recordCommunicationRound,
  type CommunicationProgress,
} from '../domain/communicationProgress';
import type { ToddlerSettings } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';
import {
  PEEK_AND_DISCOVER_CONTENT_VERSION,
  buildPeekAndDiscoverRound,
  resolvePeekAndDiscoverLocale,
} from '../content/peekAndDiscover';
import {
  PEEK_AND_DISCOVER_GAG_MS,
  PEEK_AND_DISCOVER_MAX_DURATION_MS,
  PEEK_AND_DISCOVER_MAX_REVEALS,
  PEEK_AND_DISCOVER_REACTION_FALLBACK_MS,
  PEEK_AND_DISCOVER_REDUCED_MOTION_MS,
  PEEK_AND_DISCOVER_REST_MS,
  PEEK_AND_DISCOVER_REVEAL_MS,
  PEEK_AND_DISCOVER_SILENCE_DEMO_MS,
  PEEK_AND_DISCOVER_SILENCE_WAIT_MS,
  PEEK_AND_DISCOVER_TUTORIAL_DEMO_MS,
  createInitialPeekAndDiscoverState,
  reducePeekAndDiscover,
  resolvePeekAndDiscoverMotionDuration,
  type PeekAndDiscoverAction,
  type PeekAndDiscoverLayoutInfo,
  type PeekAndDiscoverPhase,
  type PeekAndDiscoverState,
} from './peekAndDiscoverState';

const settings: ToddlerSettings = {
  childName: 'Sean',
  languageMode: 'bilingual',
  englishVoiceLocale: 'en-US',
  soundLevel: 0.7,
  reducedMotion: false,
  quietMode: false,
};

const layout: PeekAndDiscoverLayoutInfo = {
  orientation: 'portrait',
  width: 900,
  height: 1200,
};

function readyAsset(locale: 'he-IL' | 'en-US' | 'en-GB'): CommunicationAssetReadiness {
  return {
    status: 'ready',
    contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
    locale,
  };
}

function createState(overrides: Partial<PeekAndDiscoverState> = {}): PeekAndDiscoverState {
  const base = createInitialPeekAndDiscoverState({
    sessionId: 'session-1',
    progress: createInitialCommunicationProgress(PEEK_AND_DISCOVER_CONTENT_VERSION),
    settings,
    now: 1_000,
    layout,
  });
  return {
    ...base,
    ...overrides,
  };
}

function makeRound(
  progress: Pick<CommunicationProgress, 'recentContentIds'>,
  roundIndex: number,
  previousCategory: PeekAndDiscoverState['currentRound']['content']['category'] | null,
  englishVoiceLocale: ToddlerSettings['englishVoiceLocale'] = settings.englishVoiceLocale,
) {
  return buildPeekAndDiscoverRound({
    scope: {
      activityId: 'peek-and-discover',
      sessionId: 'session-1',
      roundId: `round-${roundIndex + 1}`,
      stepId: `step-${roundIndex + 1}`,
    },
    progress,
    settings: {
      languageMode: 'bilingual',
      englishVoiceLocale,
    },
    roundIndex,
    previousCategory,
  });
}

function makePhaseState(phase: PeekAndDiscoverPhase): PeekAndDiscoverState {
  const base = createState({
    assetStatus: 'ready',
    phase,
    tutorialDemoActive: false,
    currentRoundCounted: phase === 'reaction' || phase === 'rest' || phase === 'session-stop',
  });

  if (phase === 'reaction') {
    return { ...base, reactionTriggered: false, gagCompleted: false };
  }
  if (phase === 'rest') {
    return {
      ...base,
      reactionTriggered: true,
      gagCompleted: true,
      tokens: {
        ...base.tokens,
        generation: base.tokens.generation + 1,
        timer: { ...base.tokens.timer, rest: base.tokens.timer.rest + 1 },
      },
    };
  }
  if (phase === 'paused') {
    return {
      ...base,
      phase: 'paused',
      pause: {
        resumeTarget: 'ready',
        assetStatus: 'ready',
        fromPhase: 'ready',
      },
    };
  }
  if (phase === 'asset-error') {
    return {
      ...base,
      phase: 'asset-error',
      lastAssetErrorDiagnostic: {
        code: 'content-unavailable',
        issueCode: 'missing-image',
        message: 'This reveal is taking a quiet break.',
        technical: 'Missing installed image.',
      },
    };
  }
  if (phase === 'session-stop') {
    return {
      ...base,
      phase: 'session-stop',
      stopReason: 'max-reveals',
      sessionCompletionRecorded: true,
    };
  }
  return base;
}

function countProgressAfterOneRound(progress: CommunicationProgress, contentId: string): CommunicationProgress {
  return recordCommunicationRound(progress, PEEK_AND_DISCOVER_CONTENT_VERSION, contentId, 5_000);
}

function assertNoForbiddenKeys(value: unknown): void {
  const banned = ['accuracy', 'correct', 'wrong', 'diagnosis', 'clinical', 'score', 'microphone'];
  const seen = new Set<unknown>();

  const visit = (entry: unknown): void => {
    if (entry === null || typeof entry !== 'object' || seen.has(entry)) {
      return;
    }
    seen.add(entry);
    for (const [key, nested] of Object.entries(entry)) {
      const normalized = key.toLowerCase();
      expect(banned.some((term) => normalized.includes(term))).toBe(false);
      visit(nested);
    }
  };

  visit(value);
}

describe('peek and discover initial state', () => {
  it('starts in tutorial with the selected round checking assets and a four-minute deadline', () => {
    const state = createState();

    expect(state.phase).toBe('tutorial');
    expect(state.assetStatus).toBe('checking');
    expect(state.revealCount).toBe(0);
    expect(state.roundLocale).toBe('he-IL');
    expect(state.sessionDeadlineAt).toBe(1_000 + PEEK_AND_DISCOVER_MAX_DURATION_MS);
    expect(state.tokens.image).toBe(1);
    expect(state.tokens.timer.session).toBe(1);
    expect(state.currentRound.readiness.recordingKeys).toEqual([state.currentRound.exactWord]);
  });

  it('keeps the public timings reasonable and clamps reduced motion to 200ms or less', () => {
    expect(PEEK_AND_DISCOVER_TUTORIAL_DEMO_MS).toBeLessThan(3_000);
    expect(PEEK_AND_DISCOVER_TUTORIAL_DEMO_MS + PEEK_AND_DISCOVER_REVEAL_MS).toBeLessThan(3_000);
    expect(PEEK_AND_DISCOVER_REVEAL_MS).toBeGreaterThan(0);
    expect(PEEK_AND_DISCOVER_SILENCE_WAIT_MS).toBeGreaterThan(
      PEEK_AND_DISCOVER_SILENCE_DEMO_MS,
    );
    expect(PEEK_AND_DISCOVER_SILENCE_DEMO_MS).toBeGreaterThan(0);
    expect(PEEK_AND_DISCOVER_REACTION_FALLBACK_MS).toBeGreaterThan(0);
    expect(PEEK_AND_DISCOVER_GAG_MS).toBeGreaterThan(0);
    expect(PEEK_AND_DISCOVER_REST_MS).toBeGreaterThan(0);
    expect(PEEK_AND_DISCOVER_REDUCED_MOTION_MS).toBeLessThanOrEqual(200);
    expect(resolvePeekAndDiscoverMotionDuration(PEEK_AND_DISCOVER_REVEAL_MS, false)).toBe(
      PEEK_AND_DISCOVER_REVEAL_MS,
    );
    expect(resolvePeekAndDiscoverMotionDuration(PEEK_AND_DISCOVER_REVEAL_MS, true)).toBe(
      PEEK_AND_DISCOVER_REDUCED_MOTION_MS,
    );
  });
});

describe('peek and discover readiness and tutorial transitions', () => {
  it('makes tutorial interactive when exact assets are ready', () => {
    const state = createState();
    const next = reducePeekAndDiscover(state, {
      type: 'asset-readiness-resolved',
      generationToken: state.tokens.generation,
      imageToken: state.tokens.image,
      readiness: readyAsset(state.roundLocale),
    });

    expect(next.phase).toBe('tutorial');
    expect(next.assetStatus).toBe('ready');
    expect(next.tutorialDemoActive).toBe(true);
    expect(next.lastAssetErrorDiagnostic).toBeNull();
  });

  it('moves to asset-error for missing image, recording, or catalog diagnostics', () => {
    const state = createState();

    const missingImage = reducePeekAndDiscover(state, {
      type: 'asset-readiness-resolved',
      generationToken: state.tokens.generation,
      imageToken: state.tokens.image,
      readiness: {
        status: 'not-ready',
        contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
        locale: state.roundLocale,
        issues: [{
          code: 'missing-image',
          childSafeCode: 'content-unavailable',
          diagnostic: 'Missing installed image.',
          asset: state.currentRound.content.imageUrl,
        }],
      },
    });
    expect(missingImage.phase).toBe('asset-error');
    expect(missingImage.lastAssetErrorDiagnostic).toMatchObject({ issueCode: 'missing-image' });

    const missingRecording = reducePeekAndDiscover(state, {
      type: 'asset-readiness-resolved',
      generationToken: state.tokens.generation,
      imageToken: state.tokens.image,
      readiness: {
        status: 'not-ready',
        contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
        locale: state.roundLocale,
        issues: [{
          code: 'missing-recording',
          childSafeCode: 'content-unavailable',
          diagnostic: 'Missing exact recording.',
          asset: state.currentRound.exactWord,
        }],
      },
    });
    expect(missingRecording.lastAssetErrorDiagnostic).toMatchObject({ issueCode: 'missing-recording' });

    const catalogMissing = reducePeekAndDiscover(state, {
      type: 'asset-readiness-resolved',
      generationToken: state.tokens.generation,
      imageToken: state.tokens.image,
      readiness: {
        status: 'not-ready',
        contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
        locale: state.roundLocale,
        issues: [{
          code: 'catalog-unavailable',
          childSafeCode: 'content-unavailable',
          diagnostic: 'Manifest offline.',
        }],
      },
    });
    expect(catalogMissing.lastAssetErrorDiagnostic).toMatchObject({ issueCode: 'catalog-unavailable' });
  });

  it('ignores stale image callbacks and tutorial timers with the same reference', () => {
    const state = createState();

    expect(reducePeekAndDiscover(state, {
      type: 'asset-readiness-resolved',
      generationToken: state.tokens.generation + 1,
      imageToken: state.tokens.image,
      readiness: readyAsset(state.roundLocale),
    })).toBe(state);
    expect(reducePeekAndDiscover(state, {
      type: 'asset-readiness-resolved',
      generationToken: state.tokens.generation,
      imageToken: state.tokens.image + 1,
      readiness: readyAsset(state.roundLocale),
    })).toBe(state);
    expect(reducePeekAndDiscover(state, {
      type: 'tutorial-demo-finished',
      tutorialToken: state.tokens.timer.tutorial + 1,
    })).toBe(state);
  });

  it('runs one token-safe tutorial demonstration into an automatic reveal', () => {
    const initial = createState();
    const tutorial = reducePeekAndDiscover(initial, {
      type: 'asset-readiness-resolved',
      generationToken: initial.tokens.generation,
      imageToken: initial.tokens.image,
      readiness: readyAsset(initial.roundLocale),
    });
    const stale = reducePeekAndDiscover(tutorial, {
      type: 'tutorial-demo-finished',
      tutorialToken: tutorial.tokens.timer.tutorial + 1,
    });
    expect(stale).toBe(tutorial);

    const revealing = reducePeekAndDiscover(tutorial, {
      type: 'tutorial-demo-finished',
      tutorialToken: tutorial.tokens.timer.tutorial,
    });
    expect(revealing.phase).toBe('revealing');
    expect(revealing.revealSource).toBe('automatic');
    expect(revealing.tutorialInterrupted).toBe(false);
  });

  it('runs one silence mascot demonstration before automatically revealing', () => {
    const ready = createState({
      phase: 'ready',
      assetStatus: 'ready',
      tutorialDemoActive: false,
      silenceDemoActive: false,
      silenceDemoShown: false,
      autoplayBlocked: false,
    });
    const demonstrating = reducePeekAndDiscover(ready, {
      type: 'silence-demo-started',
      silenceToken: ready.tokens.timer.silence,
    });
    expect(demonstrating.silenceDemoActive).toBe(true);
    expect(demonstrating.silenceDemoShown).toBe(true);

    expect(reducePeekAndDiscover(demonstrating, {
      type: 'silence-demo-finished',
      animationToken: demonstrating.tokens.animation + 1,
    })).toBe(demonstrating);
    const revealing = reducePeekAndDiscover(demonstrating, {
      type: 'silence-demo-finished',
      animationToken: demonstrating.tokens.animation,
    });
    expect(revealing.phase).toBe('revealing');
    expect(revealing.revealSource).toBe('automatic');
  });

  it('marks tutorial interruption on child input, keeps tap and pull equivalent, and ignores ten rapid extra taps', () => {
    const tutorial = reducePeekAndDiscover(createState(), {
      type: 'asset-readiness-resolved',
      generationToken: 1,
      imageToken: 1,
      readiness: readyAsset('he-IL'),
    });

    const tap = reducePeekAndDiscover(tutorial, { type: 'start-reveal', source: 'tap' });
    const pull = reducePeekAndDiscover(tutorial, { type: 'start-reveal', source: 'pull' });
    expect(tap).toEqual(pull);
    expect(tap.phase).toBe('revealing');
    expect(tap.tutorialInterrupted).toBe(true);

    let repeated = tap;
    for (let index = 0; index < 10; index += 1) {
      const next = reducePeekAndDiscover(repeated, { type: 'start-reveal', source: 'tap' });
      expect(next).toBe(repeated);
      repeated = next;
    }
  });
});

describe('peek and discover reveal and mandatory model transitions', () => {
  it('transitions reveal animation into mandatory-model and issues one audio token', () => {
    const revealing = reducePeekAndDiscover(
      reducePeekAndDiscover(
        reducePeekAndDiscover(createState(), {
          type: 'asset-readiness-resolved',
          generationToken: 1,
          imageToken: 1,
          readiness: readyAsset('he-IL'),
        }),
        { type: 'start-reveal', source: 'tap' },
      ),
      { type: 'tutorial-demo-finished', tutorialToken: 99 },
    );

    const next = reducePeekAndDiscover(revealing, {
      type: 'reveal-animation-finished',
      animationToken: revealing.tokens.animation,
    });

    expect(next.phase).toBe('mandatory-model');
    expect(next.tokens.audio).toBe(revealing.tokens.audio + 1);
  });

  it('returns to a stable ready state on cancelled or replaced mandatory audio', () => {
    const mandatory = reducePeekAndDiscover(
      reducePeekAndDiscover(
        reducePeekAndDiscover(createState(), {
          type: 'asset-readiness-resolved',
          generationToken: 1,
          imageToken: 1,
          readiness: readyAsset('he-IL'),
        }),
        { type: 'start-reveal', source: 'tap' },
      ),
      { type: 'reveal-animation-finished', animationToken: 1 },
    );

    const cancelled = reducePeekAndDiscover(mandatory, {
      type: 'mandatory-audio-finished',
      audioToken: mandatory.tokens.audio,
      outcome: 'cancelled',
    });
    expect(cancelled.phase).toBe('ready');
    expect(cancelled.currentRound).toBe(mandatory.currentRound);
    expect(cancelled.assetStatus).toBe('ready');

    const replaced = reducePeekAndDiscover(mandatory, {
      type: 'mandatory-audio-finished',
      audioToken: mandatory.tokens.audio,
      outcome: 'replaced',
    });
    expect(replaced).toEqual(cancelled);
  });

  it('moves mandatory audio errors and unavailable playback into asset-error', () => {
    const mandatory = reducePeekAndDiscover(
      reducePeekAndDiscover(
        reducePeekAndDiscover(createState(), {
          type: 'asset-readiness-resolved',
          generationToken: 1,
          imageToken: 1,
          readiness: readyAsset('he-IL'),
        }),
        { type: 'start-reveal', source: 'tap' },
      ),
      { type: 'reveal-animation-finished', animationToken: 1 },
    );

    const errored = reducePeekAndDiscover(mandatory, {
      type: 'mandatory-audio-finished',
      audioToken: mandatory.tokens.audio,
      outcome: 'errored',
    });
    expect(errored.phase).toBe('asset-error');
    expect(errored.lastAssetErrorDiagnostic).toMatchObject({ issueCode: 'playback-errored' });

    const unavailable = reducePeekAndDiscover(mandatory, {
      type: 'mandatory-audio-finished',
      audioToken: mandatory.tokens.audio,
      outcome: 'unavailable',
    });
    expect(unavailable.lastAssetErrorDiagnostic).toMatchObject({ issueCode: 'playback-unavailable' });
  });

  it('counts a true playback completion exactly once, increments reveal count once, and ignores repeats', () => {
    const mandatory = reducePeekAndDiscover(
      reducePeekAndDiscover(
        reducePeekAndDiscover(createState(), {
          type: 'asset-readiness-resolved',
          generationToken: 1,
          imageToken: 1,
          readiness: readyAsset('he-IL'),
        }),
        { type: 'start-reveal', source: 'tap' },
      ),
      { type: 'reveal-animation-finished', animationToken: 1 },
    );

    const next = reducePeekAndDiscover(mandatory, {
      type: 'mandatory-audio-finished',
      audioToken: mandatory.tokens.audio,
      outcome: 'completed',
      now: 5_000,
    });

    expect(next.phase).toBe('reaction');
    expect(next.revealCount).toBe(1);
    expect(next.progress.roundsSeen).toBe(1);
    expect(next.progress.recentContentIds.at(-1)).toBe(mandatory.currentRound.content.id);
    expect(next.currentRoundCounted).toBe(true);

    expect(reducePeekAndDiscover(next, {
      type: 'mandatory-audio-finished',
      audioToken: mandatory.tokens.audio,
      outcome: 'completed',
      now: 5_100,
    })).toBe(next);
  });
});

describe('peek and discover reaction, six reveals, and rest', () => {
  it('triggers reaction only once from touch or bounded timer and validates stale timer callbacks', () => {
    const reaction = reducePeekAndDiscover(
      reducePeekAndDiscover(
        reducePeekAndDiscover(
          reducePeekAndDiscover(createState(), {
            type: 'asset-readiness-resolved',
            generationToken: 1,
            imageToken: 1,
            readiness: readyAsset('he-IL'),
          }),
          { type: 'start-reveal', source: 'tap' },
        ),
        { type: 'reveal-animation-finished', animationToken: 1 },
      ),
      { type: 'mandatory-audio-finished', audioToken: 1, outcome: 'completed', now: 5_000 },
    );

    expect(reducePeekAndDiscover(reaction, {
      type: 'trigger-reaction',
      source: 'automatic',
      reactionToken: reaction.tokens.timer.reaction + 1,
    })).toBe(reaction);

    const autoTriggered = reducePeekAndDiscover(reaction, {
      type: 'trigger-reaction',
      source: 'automatic',
      reactionToken: reaction.tokens.timer.reaction,
    });
    expect(autoTriggered.reactionTriggered).toBe(true);
    expect(autoTriggered.reactionSource).toBe('automatic');

    expect(reducePeekAndDiscover(autoTriggered, {
      type: 'trigger-reaction',
      source: 'touch',
    })).toBe(autoTriggered);
  });

  it('finishes reaction into rest with a fresh generation token and accepts a built next round', () => {
    const reaction = reducePeekAndDiscover(
      reducePeekAndDiscover(
        reducePeekAndDiscover(
          reducePeekAndDiscover(createState(), {
            type: 'asset-readiness-resolved',
            generationToken: 1,
            imageToken: 1,
            readiness: readyAsset('he-IL'),
          }),
          { type: 'start-reveal', source: 'tap' },
        ),
        { type: 'reveal-animation-finished', animationToken: 1 },
      ),
      { type: 'mandatory-audio-finished', audioToken: 1, outcome: 'completed', now: 5_000 },
    );
    const triggered = reducePeekAndDiscover(reaction, {
      type: 'trigger-reaction',
      source: 'touch',
    });
    const rest = reducePeekAndDiscover(triggered, {
      type: 'reaction-animation-finished',
      animationToken: triggered.tokens.animation,
      now: 6_000,
    });

    expect(rest.phase).toBe('rest');
    expect(rest.gagCompleted).toBe(true);

    const nextRound = makeRound(rest.progress, rest.revealCount, rest.currentRound.content.category, 'en-GB');
    const ready = reducePeekAndDiscover(rest, {
      type: 'rest-finished',
      restToken: rest.tokens.timer.rest,
      generationToken: rest.tokens.generation,
      nextRound,
    });

    expect(ready.phase).toBe('ready');
    expect(ready.currentRound).toBe(nextRound);
    expect(ready.roundLocale).toBe(resolvePeekAndDiscoverLocale({
      languageMode: 'bilingual',
      englishVoiceLocale: 'en-GB',
    }, rest.revealCount));
    expect(ready.assetStatus).toBe('checking');
    expect(ready.revealCount).toBe(1);
    expect(ready.currentRoundCounted).toBe(false);

    const nextRoundReady = reducePeekAndDiscover(ready, {
      type: 'asset-readiness-resolved',
      generationToken: ready.tokens.generation,
      imageToken: ready.tokens.image,
      readiness: readyAsset(ready.roundLocale),
    });
    expect(nextRoundReady.tutorialInterrupted).toBe(true);
    expect(nextRoundReady.autoplayBlocked).toBe(false);
    expect(reducePeekAndDiscover(nextRoundReady, {
      type: 'silence-demo-started',
      silenceToken: nextRoundReady.tokens.timer.silence,
    }).silenceDemoActive).toBe(true);
  });

  it('rejects stale rest timer and generation callbacks with the same reference', () => {
    const rest = makePhaseState('rest');
    const nextRound = makeRound(rest.progress, rest.revealCount, rest.currentRound.content.category, 'en-GB');

    expect(reducePeekAndDiscover(rest, {
      type: 'rest-finished',
      restToken: rest.tokens.timer.rest + 1,
      generationToken: rest.tokens.generation,
      nextRound,
    })).toBe(rest);
    expect(reducePeekAndDiscover(rest, {
      type: 'rest-finished',
      restToken: rest.tokens.timer.rest,
      generationToken: rest.tokens.generation + 1,
      nextRound,
    })).toBe(rest);
  });

  it('waits until after the sixth reaction gag before entering session-stop and records completion once', () => {
    const almostDone = createState({
      phase: 'mandatory-model',
      assetStatus: 'ready',
      tutorialDemoActive: false,
      revealCount: PEEK_AND_DISCOVER_MAX_REVEALS - 1,
      progress: countProgressAfterOneRound(
        createInitialCommunicationProgress(PEEK_AND_DISCOVER_CONTENT_VERSION),
        'ball',
      ),
      tokens: {
        ...createState().tokens,
        audio: 7,
      },
    });

    const reaction = reducePeekAndDiscover(almostDone, {
      type: 'mandatory-audio-finished',
      audioToken: almostDone.tokens.audio,
      outcome: 'completed',
      now: 10_000,
    });
    expect(reaction.phase).toBe('reaction');
    expect(reaction.revealCount).toBe(PEEK_AND_DISCOVER_MAX_REVEALS);
    expect(reaction.pendingStopReason).toBe('max-reveals');
    expect(reaction.phase).not.toBe('session-stop');

    const triggered = reducePeekAndDiscover(reaction, {
      type: 'trigger-reaction',
      source: 'touch',
    });
    const stopped = reducePeekAndDiscover(triggered, {
      type: 'reaction-animation-finished',
      animationToken: triggered.tokens.animation,
      now: 11_000,
    });

    expect(stopped.phase).toBe('session-stop');
    expect(stopped.stopReason).toBe('max-reveals');
    expect(stopped.sessionCompletionRecorded).toBe(true);
    expect(stopped.progress.sessionsCompleted).toBe(1);

    expect(reducePeekAndDiscover(stopped, {
      type: 'session-expired',
      sessionToken: stopped.tokens.timer.session,
      now: 12_000,
    })).toBe(stopped);
  });
});

describe('peek and discover background, foreground, and expiry', () => {
  it('pauses incomplete phases to a ready resume target, invalidates async work, and foregrounds without autoplay', () => {
    const revealing = createState({ phase: 'revealing', assetStatus: 'ready', tutorialDemoActive: false });
    const paused = reducePeekAndDiscover(revealing, { type: 'backgrounded' });

    expect(paused.phase).toBe('paused');
    expect(paused.pause.resumeTarget).toBe('ready');
    expect(paused.tokens.animation).toBe(revealing.tokens.animation + 1);
    expect(paused.tokens.audio).toBe(revealing.tokens.audio + 1);
    expect(paused.tokens.image).toBe(revealing.tokens.image + 1);

    expect(reducePeekAndDiscover(paused, {
      type: 'reveal-animation-finished',
      animationToken: revealing.tokens.animation,
    })).toBe(paused);
    expect(reducePeekAndDiscover(paused, {
      type: 'mandatory-audio-finished',
      audioToken: revealing.tokens.audio,
      outcome: 'completed',
    })).toBe(paused);

    const resumed = reducePeekAndDiscover(paused, { type: 'foregrounded' });
    expect(resumed.phase).toBe('ready');
    expect(resumed.currentRound).toBe(revealing.currentRound);
    expect(resumed.revealCount).toBe(revealing.revealCount);
    expect(resumed.tutorialDemoActive).toBe(false);
  });

  it('preserves foreground autoplay blocking when late readiness settles', () => {
    const checking = createState();
    const paused = reducePeekAndDiscover(checking, { type: 'backgrounded' });
    const resumed = reducePeekAndDiscover(paused, { type: 'foregrounded' });

    expect(resumed.phase).toBe('ready');
    expect(resumed.assetStatus).toBe('checking');
    expect(resumed.autoplayBlocked).toBe(true);

    const ready = reducePeekAndDiscover(resumed, {
      type: 'asset-readiness-resolved',
      generationToken: resumed.tokens.generation,
      imageToken: resumed.tokens.image,
      readiness: readyAsset(resumed.roundLocale),
    });
    expect(ready.assetStatus).toBe('ready');
    expect(ready.autoplayBlocked).toBe(true);
    expect(reducePeekAndDiscover(ready, {
      type: 'silence-demo-started',
      silenceToken: ready.tokens.timer.silence,
    })).toBe(ready);

    const touched = reducePeekAndDiscover(ready, { type: 'start-reveal', source: 'tap' });
    expect(touched.phase).toBe('revealing');
    expect(touched.autoplayBlocked).toBe(false);
  });

  it('pauses reaction and rest to a reaction resume target and preserves gag state', () => {
    const reaction = createState({
      phase: 'reaction',
      assetStatus: 'ready',
      tutorialDemoActive: false,
      reactionTriggered: true,
      gagCompleted: true,
    });
    const pausedReaction = reducePeekAndDiscover(reaction, { type: 'backgrounded' });
    expect(pausedReaction.pause.resumeTarget).toBe('reaction');
    expect(pausedReaction.gagCompleted).toBe(true);

    const resumedReaction = reducePeekAndDiscover(pausedReaction, { type: 'foregrounded' });
    expect(resumedReaction.phase).toBe('reaction');
    expect(resumedReaction.gagCompleted).toBe(true);

    const rest = makePhaseState('rest');
    const pausedRest = reducePeekAndDiscover(rest, { type: 'backgrounded' });
    expect(pausedRest.pause.resumeTarget).toBe('reaction');
    expect(reducePeekAndDiscover(pausedRest, {
      type: 'rest-finished',
      restToken: rest.tokens.timer.rest,
      generationToken: rest.tokens.generation,
      nextRound: makeRound(rest.progress, rest.revealCount, rest.currentRound.content.category, 'en-GB'),
    })).toBe(pausedRest);
  });

  it('expires calmly after four minutes from every active phase and records completion only once', () => {
    const activePhases: PeekAndDiscoverPhase[] = [
      'tutorial',
      'ready',
      'revealing',
      'mandatory-model',
      'reaction',
      'rest',
      'paused',
    ];

    for (const phase of activePhases) {
      const source = makePhaseState(phase);
      const stopped = reducePeekAndDiscover(source, {
        type: 'session-expired',
        sessionToken: source.tokens.timer.session,
        now: source.sessionDeadlineAt,
      });
      expect(stopped.phase, phase).toBe('session-stop');
      expect(stopped.stopReason, phase).toBe('time-elapsed');
      expect(stopped.progress.sessionsCompleted, phase).toBe(1);
      expect(reducePeekAndDiscover(stopped, {
        type: 'session-expired',
        sessionToken: stopped.tokens.timer.session,
        now: stopped.sessionDeadlineAt,
      }), phase).toBe(stopped);
    }
  });
});

describe('peek and discover layout, reduced motion, legality, and field shape', () => {
  it('updates only layout while preserving round, locale, and reveal count', () => {
    const state = createState({ assetStatus: 'ready', tutorialDemoActive: false, phase: 'ready' });
    const nextLayout: PeekAndDiscoverLayoutInfo = {
      orientation: 'landscape',
      width: 1200,
      height: 800,
    };
    const updated = reducePeekAndDiscover(state, {
      type: 'update-layout',
      layout: nextLayout,
    });

    expect(updated.layout).toEqual(nextLayout);
    expect(updated.currentRound).toBe(state.currentRound);
    expect(updated.roundLocale).toBe(state.roundLocale);
    expect(updated.revealCount).toBe(state.revealCount);
    expect(reducePeekAndDiscover(updated, { type: 'update-layout', layout: nextLayout })).toBe(updated);
  });

  it('updates only reduced motion when that setting changes', () => {
    const state = createState({ assetStatus: 'ready', phase: 'ready', tutorialDemoActive: false });
    const updated = reducePeekAndDiscover(state, {
      type: 'set-reduced-motion',
      value: true,
    });

    expect(updated.reducedMotion).toBe(true);
    expect(updated.currentRound).toBe(state.currentRound);
    expect(updated.revealCount).toBe(state.revealCount);
    expect(reducePeekAndDiscover(updated, {
      type: 'set-reduced-motion',
      value: true,
    })).toBe(updated);
  });

  it('returns the same reference for illegal actions across the transition table', () => {
    const tables: Array<readonly [PeekAndDiscoverPhase, PeekAndDiscoverAction]> = [
      ['tutorial', { type: 'reaction-animation-finished', animationToken: 1 }],
      ['ready', { type: 'mandatory-audio-finished', audioToken: 1, outcome: 'completed' }],
      ['revealing', { type: 'rest-finished', restToken: 1, generationToken: 1, nextRound: makeRound(createInitialCommunicationProgress(PEEK_AND_DISCOVER_CONTENT_VERSION), 1, null) }],
      ['mandatory-model', { type: 'trigger-reaction', source: 'touch' }],
      ['reaction', { type: 'start-reveal', source: 'tap' }],
      ['rest', { type: 'trigger-reaction', source: 'touch' }],
      ['paused', { type: 'start-reveal', source: 'tap' }],
      ['asset-error', { type: 'foregrounded' }],
      ['session-stop', { type: 'backgrounded' }],
    ];

    for (const [phase, action] of tables) {
      const state = makePhaseState(phase);
      expect(reducePeekAndDiscover(state, action), `${phase}:${action.type}`).toBe(state);
    }
  });

  it('contains no banned correctness, score, diagnosis, clinical, or microphone field names', () => {
    const state = createState();
    assertNoForbiddenKeys(state);
    assertNoForbiddenKeys(state.progress);
  });
});
