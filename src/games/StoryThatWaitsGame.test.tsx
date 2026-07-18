// @vitest-environment jsdom

import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialCommunicationProgress } from '../domain/communicationProgress';
import { createInitialSettings } from '../domain/progression';
import type { ToddlerSettings } from '../domain/types';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';
import type {
  InteractionMediaOutcome,
  InteractionMediaRequest,
} from '../services/interactionMediaCoordinator';
import {
  StoryThatWaitsGame,
  type StoryThatWaitsGameProps,
  type StoryThatWaitsMediaCoordinator,
  type StoryThatWaitsMetric,
  type StoryThatWaitsMicrophonePermission,
} from './StoryThatWaitsGame';
import {
  STORY_THAT_WAITS_GUARD_MS,
  STORY_THAT_WAITS_SESSION_MAX_MS,
  STORY_THAT_WAITS_TURN1_WINDOW_MS,
  STORY_THAT_WAITS_TURN2_WINDOW_MS,
} from './storyThatWaitsState';

const mic = vi.hoisted(() => ({
  sample: undefined as undefined | ((level: 0 | 1, deltaMs: number) => void),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('./useMicEffort', () => ({
  useMicEffort: (onSample: (level: 0 | 1, deltaMs: number) => void) => {
    mic.sample = onSample;
    return {
      start: mic.start,
      stop: mic.stop,
      supported: true,
    };
  },
}));

vi.mock('../art/objects', () => ({
  ConceptArt: ({ conceptId, className }: { conceptId: string; className?: string }) => (
    <span className={className} data-testid={`art-${conceptId}`} />
  ),
}));

vi.mock('../art/mascot', () => ({
  PuppyMascotArt: ({ className }: { className?: string }) => (
    <span className={className} data-testid="puppy" />
  ),
}));

interface PendingPlayback {
  request: InteractionMediaRequest;
  resolve: (outcome: InteractionMediaOutcome) => void;
}

interface CoordinatorDouble extends StoryThatWaitsMediaCoordinator {
  unlock: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  notifyInteraction: ReturnType<typeof vi.fn>;
  cancelAll: ReturnType<typeof vi.fn>;
  pending: PendingPlayback[];
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const READY: CommunicationAssetReadiness = {
  status: 'ready',
  contentVersion: 'story-that-waits-v1',
  locale: 'en-US',
};

function createCoordinator(): CoordinatorDouble {
  const pending: PendingPlayback[] = [];
  return {
    pending,
    unlock: vi.fn(),
    play: vi.fn((request: InteractionMediaRequest) => new Promise<InteractionMediaOutcome>((resolve) => {
      pending.push({ request, resolve });
    })),
    notifyInteraction: vi.fn(),
    cancelAll: vi.fn(),
  };
}

function completePlayback(
  coordinator: CoordinatorDouble,
  index = coordinator.pending.length - 1,
  status: InteractionMediaOutcome['status'] = 'completed',
): void {
  const playback = coordinator.pending[index];
  if (!playback) {
    throw new Error(`Missing pending playback at index ${index}.`);
  }
  playback.resolve({
    intentId: playback.request.intentId,
    status,
  });
}

describe('StoryThatWaitsGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  let coordinator: CoordinatorDouble;
  let settings: ToddlerSettings;
  const lifecycleListeners = new Set<(state: 'foreground' | 'background') => void>();
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T18:00:00Z'));
    mic.start.mockReset();
    mic.stop.mockReset();
    mic.start.mockResolvedValue({ status: 'started' });
    mic.sample = undefined;
    lifecycleListeners.clear();
    coordinator = createCoordinator();
    settings = createInitialSettings();
    settings.languageMode = 'en';
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function props(overrides: Partial<StoryThatWaitsGameProps> = {}): StoryThatWaitsGameProps {
    return {
      storyId: 'duck-and-ball',
      locale: 'en-US',
      settings,
      onExit: vi.fn(),
      readinessCheck: vi.fn().mockResolvedValue(READY),
      mediaCoordinator: coordinator,
      queryMicrophonePermission: vi.fn().mockResolvedValue('not-granted'),
      readLifecycle: () => 'foreground',
      subscribeLifecycle: (listener) => {
        lifecycleListeners.add(listener);
        return () => lifecycleListeners.delete(listener);
      },
      sessionId: 'runtime-test-session',
      ...overrides,
    };
  }

  async function renderGame(overrides: Partial<StoryThatWaitsGameProps> = {}): Promise<void> {
    await act(async () => {
      root.render(<StoryThatWaitsGame {...props(overrides)} />);
      await Promise.resolve();
    });
  }

  async function startStory(): Promise<void> {
    const book = container.querySelector<HTMLButtonElement>('.story-book');
    expect(book).not.toBeNull();
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('narrating-page');
    expect(coordinator.play).toHaveBeenCalledTimes(1);
  }

  async function resolveCurrentPlayback(
    status: InteractionMediaOutcome['status'] = 'completed',
  ): Promise<void> {
    await act(async () => {
      completePlayback(coordinator, coordinator.pending.length - 1, status);
      await Promise.resolve();
    });
  }

  async function advance(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  async function advanceInSteps(totalMs: number, stepMs = 100): Promise<void> {
    let elapsed = 0;
    while (elapsed < totalMs) {
      const next = Math.min(stepMs, totalMs - elapsed);
      await advance(next);
      elapsed += next;
    }
  }

  async function advanceCurrentPage(): Promise<void> {
    await resolveCurrentPlayback();
    await advance(STORY_THAT_WAITS_GUARD_MS);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
    });
    await advanceInSteps(520);
    await advanceInSteps(360);
  }

  async function reachTurnOne(
    queryMicrophonePermission: () => Promise<StoryThatWaitsMicrophonePermission>,
    onMetric?: (metric: StoryThatWaitsMetric) => void,
  ): Promise<void> {
    await renderGame({
      queryMicrophonePermission,
      ...(onMetric ? { onMetric } : {}),
    });
    await startStory();
    await resolveCurrentPlayback();
    await advance(STORY_THAT_WAITS_GUARD_MS);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('turn1');
  }

  it('fails closed and identifies one missing exact-locale sentence', async () => {
    const readinessCheck = vi.fn().mockResolvedValue({
      status: 'not-ready',
      contentVersion: 'story-that-waits-v1',
      locale: 'en-US',
      issues: [{
        code: 'missing-recording',
        childSafeCode: 'content-unavailable',
        diagnostic: 'Missing exact en-US recording The duck taps the ball.',
        asset: 'The duck taps the ball.',
      }],
    } satisfies CommunicationAssetReadiness);

    await renderGame({ readinessCheck });

    expect(container.querySelector('.story-unavailable')).not.toBeNull();
    expect(container.textContent).toContain('The story is resting now');
    expect(container.textContent).toContain('Missing exact en-US recording The duck taps the ball.');
    expect(coordinator.play).not.toHaveBeenCalled();
    const requirements = readinessCheck.mock.calls[0]?.[0];
    expect(requirements.recordingKeys).toEqual([
      'The duck sees a ball.',
      'The duck taps the ball.',
      'The ball rolls to the duck.',
      'The duck hugs the ball.',
    ]);
  });

  it('unlocks without cancelling the first mandatory sentence and queues one child touch', async () => {
    await renderGame();

    expect(container.querySelector('.story-book.is-tutorial')).not.toBeNull();
    expect(container.querySelector('.story-book__sentence')?.textContent)
      .toBe('The duck sees a ball.');
    await startStory();

    expect(coordinator.play).toHaveBeenCalledTimes(1);
    const request = coordinator.pending[0]!.request;
    expect(request.audioClass).toBe('mandatory');
    expect(request.segments).toEqual([{
      text: 'The duck sees a ball.',
      recordedText: 'The duck sees a ball.',
      locale: 'en-US',
    }]);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
    });
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('narrating-page');
    expect(coordinator.unlock).toHaveBeenCalledOnce();
    expect(coordinator.notifyInteraction).not.toHaveBeenCalled();
    expect(coordinator.play).toHaveBeenCalledOnce();

    await resolveCurrentPlayback();
    expect(container.querySelector('.story-unavailable')).toBeNull();
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('guard');
  });

  it('visibly renders the approved pointed Hebrew sentence while lookup text stays unpointed', async () => {
    settings.languageMode = 'he';
    await renderGame({
      locale: 'he-IL',
      readinessCheck: vi.fn().mockResolvedValue({
        status: 'ready',
        contentVersion: 'story-that-waits-v1',
        locale: 'he-IL',
      } satisfies CommunicationAssetReadiness),
    });

    expect(container.querySelector('.story-book__sentence')?.textContent)
      .toBe('בַּרְוָז רוֹאֶה כַּדּוּר.');
    expect(container.querySelector('.story-book')?.getAttribute('aria-label'))
      .toBe('בַּרְוָז וְכַדּוּר, עַמּוּד 1 מִתּוֹךְ 4. בַּרְוָז רוֹאֶה כַּדּוּר.');
    expect(coordinator.pending[0]?.request.segments?.[0]?.recordedText)
      .toBe('ברווז רואה כדור.');
  });

  it.each(['cancelled', 'errored', 'unavailable'] as const)(
    'fails closed when mandatory narration settles as %s outside lifecycle cancellation',
    async (status) => {
      await renderGame();
      await startStory();

      await resolveCurrentPlayback(status);

      expect(container.querySelector('.story-unavailable')).not.toBeNull();
      expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('asset-error');
    },
  );

  it('opens only at the 400ms guard and consumes the coalesced narration touch', async () => {
    await renderGame();
    await startStory();
    await act(async () => {
      const book = container.querySelector<HTMLButtonElement>('.story-book')!;
      book.click();
      book.click();
      completePlayback(coordinator);
      await Promise.resolve();
    });

    await advance(399);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('guard');
    await advance(1);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('page-action');
  });

  it('uses a second visual-only window and never starts the microphone twice', async () => {
    await renderGame({
      queryMicrophonePermission: vi.fn().mockResolvedValue('granted'),
    });
    await startStory();
    await resolveCurrentPlayback();
    await advance(STORY_THAT_WAITS_GUARD_MS);

    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('turn1');
    expect(mic.start).toHaveBeenCalledTimes(1);
    await advance(STORY_THAT_WAITS_TURN1_WINDOW_MS);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('turn2');
    await advance(STORY_THAT_WAITS_TURN2_WINDOW_MS);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('page-action');
    expect(mic.start).toHaveBeenCalledTimes(1);
  });

  it('renders the same action and progression for touch, effort, and silence', async () => {
    async function reachAction(source: 'touch' | 'effort' | 'silence'): Promise<string> {
      await renderGame({
        queryMicrophonePermission: vi.fn().mockResolvedValue(
          source === 'effort' ? 'granted' : 'not-granted',
        ),
      });
      await startStory();
      await resolveCurrentPlayback();
      await advance(STORY_THAT_WAITS_GUARD_MS);
      if (source === 'touch') {
        await act(async () => {
          container.querySelector<HTMLButtonElement>('.story-book')!.click();
        });
      } else if (source === 'effort') {
        await act(async () => {
          mic.sample?.(1, 16);
        });
      } else {
        await advance(STORY_THAT_WAITS_TURN1_WINDOW_MS);
        await advance(STORY_THAT_WAITS_TURN2_WINDOW_MS);
      }
      const surface = container.querySelector('.story-that-waits')!;
      const result = `${surface.getAttribute('data-phase')}:${surface.getAttribute('data-page')}:${surface.getAttribute('data-action')}`;
      await act(async () => root.unmount());
      container.remove();
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
      coordinator = createCoordinator();
      return result;
    }

    expect(await reachAction('touch')).toBe('page-action:1:see');
    expect(await reachAction('effort')).toBe('page-action:1:see');
    expect(await reachAction('silence')).toBe('page-action:1:see');
  });

  it('coalesces rapid taps without skipping a page', async () => {
    await renderGame();
    await startStory();
    await act(async () => {
      const book = container.querySelector<HTMLButtonElement>('.story-book')!;
      book.click();
      book.click();
      book.click();
      completePlayback(coordinator);
      await Promise.resolve();
    });
    await advance(STORY_THAT_WAITS_GUARD_MS);
    await act(async () => {
      const book = container.querySelector<HTMLButtonElement>('.story-book')!;
      book.click();
      book.click();
      book.click();
    });
    await advance(520);
    await advance(360);

    expect(container.querySelector('.story-that-waits')?.getAttribute('data-page')).toBe('2');
    expect(coordinator.play).toHaveBeenCalledTimes(2);
  });

  it('never prompts when microphone permission is denied and ignores a late start result', async () => {
    const permission = vi.fn().mockResolvedValue('not-granted');
    await renderGame({ queryMicrophonePermission: permission });
    await startStory();
    await resolveCurrentPlayback();
    await advance(STORY_THAT_WAITS_GUARD_MS);
    expect(permission).toHaveBeenCalledTimes(1);
    expect(mic.start).not.toHaveBeenCalled();

    let resolveStart: ((value: { status: 'permission-denied' }) => void) | undefined;
    mic.start.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStart = resolve;
    }));
    await act(async () => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    coordinator = createCoordinator();
    await renderGame({
      queryMicrophonePermission: vi.fn().mockResolvedValue('granted'),
    });
    await startStory();
    await resolveCurrentPlayback();
    await advance(STORY_THAT_WAITS_GUARD_MS);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
      resolveStart?.({ status: 'permission-denied' });
      await Promise.resolve();
    });
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('page-action');
  });

  it('keeps microphone permission query failures nonblocking', async () => {
    await renderGame({
      queryMicrophonePermission: vi.fn().mockRejectedValue(new Error('Permissions API unavailable')),
    });
    await startStory();
    await resolveCurrentPlayback();
    await advance(STORY_THAT_WAITS_GUARD_MS);

    expect(container.querySelector('.story-unavailable')).toBeNull();
    expect(container.querySelector('.story-diagnostic')?.textContent).toContain('Permissions API unavailable');
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('turn1');
    await advance(STORY_THAT_WAITS_TURN1_WINDOW_MS);
    await advance(STORY_THAT_WAITS_TURN2_WINDOW_MS);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('page-action');
  });

  it('reports one live microphone permission rejection and keeps the turn fail-safe', async () => {
    const permission = createDeferred<StoryThatWaitsMicrophonePermission>();
    const metrics: StoryThatWaitsMetric[] = [];
    await reachTurnOne(() => permission.promise, (metric) => metrics.push(metric));

    await act(async () => {
      permission.reject(new Error('Permissions API unavailable'));
      await Promise.resolve();
    });

    expect(container.querySelector('.story-diagnostic')?.textContent).toContain(
      'Permissions API unavailable',
    );
    expect(metrics.filter(
      (metric) => metric.name === 'media-error'
        && metric.code === 'microphone-permission-query-failed',
    )).toHaveLength(1);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('turn1');
  });

  it('ignores a microphone permission rejection after the opportunity phase changes', async () => {
    const permission = createDeferred<StoryThatWaitsMicrophonePermission>();
    const metrics: StoryThatWaitsMetric[] = [];
    await reachTurnOne(() => permission.promise, (metric) => metrics.push(metric));

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
      permission.reject(new Error('stale phase rejection'));
      await Promise.resolve();
    });

    expect(container.querySelector('.story-diagnostic')).toBeNull();
    expect(metrics.some(
      (metric) => metric.name === 'media-error'
        && metric.code === 'microphone-permission-query-failed',
    )).toBe(false);
  });

  it('ignores a microphone permission rejection after page generation changes', async () => {
    const permission = createDeferred<StoryThatWaitsMicrophonePermission>();
    const metrics: StoryThatWaitsMetric[] = [];
    await reachTurnOne(() => permission.promise, (metric) => metrics.push(metric));

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
    });
    await advance(520);
    await advance(360);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-page')).toBe('2');
    await act(async () => {
      permission.reject(new Error('stale generation rejection'));
      await Promise.resolve();
    });

    expect(container.querySelector('.story-diagnostic')).toBeNull();
    expect(metrics.some(
      (metric) => metric.name === 'media-error'
        && metric.code === 'microphone-permission-query-failed',
    )).toBe(false);
  });

  it('ignores a microphone permission rejection after lifecycle cancellation', async () => {
    const permission = createDeferred<StoryThatWaitsMicrophonePermission>();
    const metrics: StoryThatWaitsMetric[] = [];
    await reachTurnOne(() => permission.promise, (metric) => metrics.push(metric));

    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('background'));
      permission.reject(new Error('stale lifecycle rejection'));
      await Promise.resolve();
    });

    expect(container.querySelector('.story-diagnostic')).toBeNull();
    expect(metrics.some(
      (metric) => metric.name === 'media-error'
        && metric.code === 'microphone-permission-query-failed',
    )).toBe(false);
  });

  it('ignores a replaced microphone permission query rejection', async () => {
    const firstPermission = createDeferred<StoryThatWaitsMicrophonePermission>();
    const secondPermission = createDeferred<StoryThatWaitsMicrophonePermission>();
    const metrics: StoryThatWaitsMetric[] = [];
    const initialProps = props({
      queryMicrophonePermission: () => firstPermission.promise,
      onMetric: (metric) => metrics.push(metric),
    });
    await act(async () => {
      root.render(<StoryThatWaitsGame {...initialProps} />);
      await Promise.resolve();
    });
    await startStory();
    await resolveCurrentPlayback();
    await advance(STORY_THAT_WAITS_GUARD_MS);

    await act(async () => {
      root.render(
        <StoryThatWaitsGame
          {...initialProps}
          queryMicrophonePermission={() => secondPermission.promise}
        />,
      );
      await Promise.resolve();
    });
    await act(async () => {
      firstPermission.reject(new Error('stale retry rejection'));
      secondPermission.resolve('not-granted');
      await Promise.resolve();
    });

    expect(container.querySelector('.story-diagnostic')).toBeNull();
    expect(metrics.some(
      (metric) => metric.name === 'media-error'
        && metric.code === 'microphone-permission-query-failed',
    )).toBe(false);
  });

  it('ignores a microphone permission rejection after unmount', async () => {
    const permission = createDeferred<StoryThatWaitsMicrophonePermission>();
    const metrics: StoryThatWaitsMetric[] = [];
    await reachTurnOne(() => permission.promise, (metric) => metrics.push(metric));

    await act(async () => root.unmount());
    await act(async () => {
      permission.reject(new Error('stale unmount rejection'));
      await Promise.resolve();
    });

    expect(metrics.some(
      (metric) => metric.name === 'media-error'
        && metric.code === 'microphone-permission-query-failed',
    )).toBe(false);
    container.remove();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  it('keeps the automatic tutorial under three seconds and lets one touch take control', async () => {
    await renderGame();
    expect(container.querySelector('.story-book.is-tutorial')).not.toBeNull();
    await advance(2_399);
    expect(container.querySelector('.story-book.is-tutorial')).not.toBeNull();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
    });

    expect(container.querySelector('.story-book.is-tutorial')).toBeNull();
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('narrating-page');
    expect(coordinator.play).toHaveBeenCalledTimes(1);
  });

  it('anchors the tutorial duration across narration and guard phases', async () => {
    await renderGame();
    await advance(2_200);
    expect(container.querySelector('.story-book.is-tutorial')).not.toBeNull();
    await resolveCurrentPlayback();
    await advance(199);
    expect(container.querySelector('.story-book.is-tutorial')).not.toBeNull();
    await advance(1);
    expect(container.querySelector('.story-book.is-tutorial')).toBeNull();
  });

  it('does not auto-start when mounted in the background', async () => {
    await renderGame({ readLifecycle: () => 'background' });
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('paused');
    expect(coordinator.play).not.toHaveBeenCalled();

    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('foreground'));
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
      await Promise.resolve();
    });

    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('narrating-page');
    expect(coordinator.play).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'mounts and resolves while backgrounded',
      initialLifecycle: 'background' as const,
      lifecycleBeforeReadiness: [] as Array<'foreground' | 'background'>,
    },
    {
      name: 'mounts backgrounded and foregrounds before readiness',
      initialLifecycle: 'background' as const,
      lifecycleBeforeReadiness: ['foreground'] as Array<'foreground' | 'background'>,
    },
    {
      name: 'backgrounds and foregrounds before delayed readiness',
      initialLifecycle: 'foreground' as const,
      lifecycleBeforeReadiness: ['background', 'foreground'] as Array<
        'foreground' | 'background'
      >,
    },
  ])(
    'requires one fresh start gesture when it $name',
    async ({ initialLifecycle, lifecycleBeforeReadiness }) => {
      const readiness = createDeferred<CommunicationAssetReadiness>();
      let lifecycle: 'foreground' | 'background' = initialLifecycle;
      await renderGame({
        readinessCheck: () => readiness.promise,
        readLifecycle: () => lifecycle,
      });

      for (const nextLifecycle of lifecycleBeforeReadiness) {
        lifecycle = nextLifecycle;
        await act(async () => {
          lifecycleListeners.forEach((listener) => listener(nextLifecycle));
        });
      }
      await act(async () => {
        readiness.resolve(READY);
        await Promise.resolve();
      });
      expect(coordinator.play).not.toHaveBeenCalled();

      if (lifecycle === 'background') {
        lifecycle = 'foreground';
        await act(async () => {
          lifecycleListeners.forEach((listener) => listener('foreground'));
        });
      }
      expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('paused');

      await act(async () => {
        const book = container.querySelector<HTMLButtonElement>('.story-book')!;
        book.click();
        book.click();
        book.click();
        await Promise.resolve();
      });

      expect(coordinator.unlock).toHaveBeenCalledTimes(1);
      expect(coordinator.play).toHaveBeenCalledTimes(1);
      expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe(
        'narrating-page',
      );
    },
  );

  it('keeps normal foreground delayed readiness automatic', async () => {
    const readiness = createDeferred<CommunicationAssetReadiness>();
    await renderGame({ readinessCheck: () => readiness.promise });
    expect(coordinator.play).not.toHaveBeenCalled();

    await act(async () => {
      readiness.resolve(READY);
      await Promise.resolve();
    });

    expect(coordinator.play).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe(
      'narrating-page',
    );
  });

  it('ignores stale readiness after a newer readiness generation starts', async () => {
    const firstReadiness = createDeferred<CommunicationAssetReadiness>();
    const secondReadiness = createDeferred<CommunicationAssetReadiness>();
    const initialProps = props({ readinessCheck: () => firstReadiness.promise });
    await act(async () => {
      root.render(<StoryThatWaitsGame {...initialProps} />);
      await Promise.resolve();
    });
    await act(async () => {
      root.render(
        <StoryThatWaitsGame
          {...initialProps}
          readinessCheck={() => secondReadiness.promise}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      firstReadiness.resolve(READY);
      await Promise.resolve();
    });
    expect(coordinator.play).not.toHaveBeenCalled();

    await act(async () => {
      secondReadiness.resolve(READY);
      await Promise.resolve();
    });
    expect(coordinator.play).toHaveBeenCalledTimes(1);
  });

  it('ignores stale delayed readiness after unmount', async () => {
    const readiness = createDeferred<CommunicationAssetReadiness>();
    await renderGame({ readinessCheck: () => readiness.promise });

    await act(async () => root.unmount());
    await act(async () => {
      readiness.resolve(READY);
      await Promise.resolve();
    });

    expect(coordinator.play).not.toHaveBeenCalled();
    container.remove();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  it('replays interrupted narration from the beginning before consuming a fresh queued touch', async () => {
    await renderGame();
    await startStory();
    expect(coordinator.play).toHaveBeenCalledTimes(1);

    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('background'));
      completePlayback(coordinator, 0, 'cancelled');
      await Promise.resolve();
    });
    expect(coordinator.cancelAll).toHaveBeenCalledWith('background');
    expect(mic.stop).toHaveBeenCalled();
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('paused');
    expect(container.querySelector('.story-unavailable')).toBeNull();

    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('foreground'));
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(coordinator.play).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-page')).toBe('1');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
      await Promise.resolve();
    });
    expect(coordinator.unlock).toHaveBeenCalledOnce();
    expect(coordinator.play).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('narrating-page');
    await advance(2_000);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('narrating-page');

    await act(async () => {
      completePlayback(coordinator, 1);
      await Promise.resolve();
    });
    await advance(STORY_THAT_WAITS_GUARD_MS - 1);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('guard');
    await advance(1);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('page-action');
    expect(coordinator.play).toHaveBeenCalledTimes(2);
  });

  it('holds a post-narration resumed guard during explicit replay and surfaces replay errors', async () => {
    await renderGame();
    await startStory();
    await resolveCurrentPlayback();
    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('background'));
    });
    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('foreground'));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.rail-button--replay')!.click();
      await Promise.resolve();
    });

    expect(coordinator.play).toHaveBeenCalledTimes(2);
    await advance(1_000);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('guard');
    await resolveCurrentPlayback('errored');
    expect(container.querySelector('.story-unavailable')).not.toBeNull();
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('asset-error');
    expect(container.querySelector('.story-diagnostic')?.textContent).toContain(
      'Mandatory replay did not complete for page-1.',
    );
    await advance(20_000);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('asset-error');
    expect(coordinator.play).toHaveBeenCalledTimes(2);
  });

  it('disables explicit replay while paused mandatory narration is incomplete', async () => {
    await renderGame();
    await startStory();
    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('background'));
    });
    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('foreground'));
    });

    const replay = container.querySelector<HTMLButtonElement>('.rail-button--replay')!;
    expect(replay.disabled).toBe(true);
    await act(async () => {
      replay.click();
      await Promise.resolve();
    });

    expect(coordinator.play).toHaveBeenCalledOnce();
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('paused');
  });

  it('does not let a stale replay callback clear a newer replay guard', async () => {
    await renderGame();
    await startStory();
    await resolveCurrentPlayback();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.rail-button--replay')!.click();
      await Promise.resolve();
    });
    expect(coordinator.play).toHaveBeenCalledTimes(2);

    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('background'));
    });
    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('foreground'));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.rail-button--replay')!.click();
      await Promise.resolve();
    });
    expect(coordinator.play).toHaveBeenCalledTimes(3);

    await act(async () => {
      completePlayback(coordinator, 1, 'cancelled');
      await Promise.resolve();
    });
    expect(container.querySelector<HTMLButtonElement>('.rail-button--replay')?.getAttribute('aria-pressed')).toBe('true');
    await advance(1_000);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('guard');

    await act(async () => {
      completePlayback(coordinator, 2);
      await Promise.resolve();
    });
    expect(container.querySelector<HTMLButtonElement>('.rail-button--replay')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('disables replay once an opportunity or page action can advance the story', async () => {
    await renderGame();
    await startStory();
    await resolveCurrentPlayback();
    await advance(STORY_THAT_WAITS_GUARD_MS);

    const replay = container.querySelector<HTMLButtonElement>('.rail-button--replay')!;
    expect(replay.disabled).toBe(true);
    await act(async () => {
      replay.click();
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
    });
    expect(coordinator.play).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('page-action');
    expect(replay.disabled).toBe(true);
  });

  it('keeps replay disabled when backgrounding an ending story', async () => {
    await renderGame();
    await startStory();
    for (let page = 1; page <= 4; page += 1) {
      await advanceCurrentPage();
    }
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('ending');

    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('background'));
    });

    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('paused');
    expect(container.querySelector<HTMLButtonElement>('.rail-button--replay')?.disabled).toBe(true);
  });

  it('preserves page and locked locale through layout and prop changes', async () => {
    const baseProps = props();
    await act(async () => {
      root.render(<StoryThatWaitsGame {...baseProps} />);
      await Promise.resolve();
    });
    await startStory();

    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('orientationchange'));
    await act(async () => {
      root.render(<StoryThatWaitsGame {...baseProps} locale="he-IL" />);
    });

    const surface = container.querySelector('.story-that-waits');
    expect(surface?.getAttribute('data-page')).toBe('1');
    expect(surface?.getAttribute('data-locale')).toBe('en-US');
    expect(coordinator.pending[0]!.request.segments?.[0]?.locale).toBe('en-US');
  });

  it('stops after page four, closes the book, persists nonclinical progress, and starts no second story', async () => {
    const progressUpdates = vi.fn();
    const metrics: StoryThatWaitsMetric[] = [];
    await renderGame({
      initialProgress: createInitialCommunicationProgress(),
      onProgressChange: progressUpdates,
      onMetric: (metric) => metrics.push(metric),
    });
    await startStory();

    for (let page = 1; page <= 4; page += 1) {
      await advanceCurrentPage();
    }
    await advance(1_100);

    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('rest');
    expect(container.querySelector('.story-book.is-closed')).not.toBeNull();
    expect(coordinator.play).toHaveBeenCalledTimes(4);
    await advance(20_000);
    expect(coordinator.play).toHaveBeenCalledTimes(4);

    const finalProgress = progressUpdates.mock.calls.at(-1)?.[0];
    expect(finalProgress.roundsSeen).toBe(4);
    expect(finalProgress.sessionsCompleted).toBe(1);
    expect(finalProgress.recentContentIds).toEqual([
      'duck-and-ball:page-1',
      'duck-and-ball:page-2',
      'duck-and-ball:page-3',
      'duck-and-ball:page-4',
    ]);
    expect(metrics.filter((metric) => metric.name === 'page-reached')).toHaveLength(4);
  });

  it('enforces the 2.5-minute bound even while mandatory media is pending', async () => {
    const metrics: StoryThatWaitsMetric[] = [];
    const progressUpdates = vi.fn();
    await renderGame({
      initialProgress: createInitialCommunicationProgress(),
      onProgressChange: progressUpdates,
      onMetric: (metric) => metrics.push(metric),
    });
    await startStory();

    await advance(STORY_THAT_WAITS_SESSION_MAX_MS);
    await advance(0);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('rest');
    const elapsed = metrics.find((metric) => metric.name === 'elapsed-time');
    expect(elapsed?.elapsedMs).toBeLessThanOrEqual(STORY_THAT_WAITS_SESSION_MAX_MS);
    expect(progressUpdates.mock.calls.at(-1)?.[0].sessionsCompleted).toBe(0);
  });

  it('provides reduced-motion state, large semantic controls, and visible sentence text', async () => {
    settings.reducedMotion = true;
    await renderGame();
    await startStory();

    const shell = container.querySelector('.story-that-waits-shell');
    const book = container.querySelector<HTMLButtonElement>('.story-book');
    expect(shell?.classList.contains('reduced-motion')).toBe(true);
    expect(book?.tagName).toBe('BUTTON');
    expect(book?.getAttribute('aria-label')).toContain('page 1 of 4');
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-reduced-motion')).toBe('true');
    expect(book?.textContent).toContain('The duck sees a ball.');
  });

  it('ignores stale narration completion after pause and waits for the fresh replay', async () => {
    await renderGame();
    await startStory();
    const stalePlayback = coordinator.pending[0]!;
    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('background'));
    });
    await act(async () => {
      lifecycleListeners.forEach((listener) => listener('foreground'));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.story-book')!.click();
      stalePlayback.resolve({ intentId: stalePlayback.request.intentId, status: 'completed' });
      await Promise.resolve();
    });

    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('narrating-page');
    expect(coordinator.play).toHaveBeenCalledTimes(2);

    await act(async () => {
      completePlayback(coordinator, 1);
      await Promise.resolve();
    });
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('guard');
    await advance(STORY_THAT_WAITS_GUARD_MS - 1);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('guard');
    await advance(1);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('page-action');
  });

  it('starts one mandatory playback under StrictMode and coalesces rapid first-touch intent', async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <StoryThatWaitsGame {...props()} />
        </StrictMode>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(coordinator.play).toHaveBeenCalledOnce();
    await act(async () => {
      const book = container.querySelector<HTMLButtonElement>('.story-book')!;
      book.click();
      book.click();
      book.click();
    });
    expect(coordinator.play).toHaveBeenCalledOnce();
    expect(coordinator.notifyInteraction).not.toHaveBeenCalled();

    await resolveCurrentPlayback();
    await advance(STORY_THAT_WAITS_GUARD_MS);
    expect(container.querySelector('.story-that-waits')?.getAttribute('data-phase')).toBe('page-action');
  });

  it('emits only the approved nonclinical metric allowlist', async () => {
    const metrics: StoryThatWaitsMetric[] = [];
    await renderGame({ onMetric: (metric) => metrics.push(metric) });
    await startStory();
    await resolveCurrentPlayback('errored');
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.rail-button--home')!.click();
    });

    const allowlist = new Set([
      'story-reached',
      'page-reached',
      'elapsed-time',
      'exit',
      'media-error',
    ]);
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((metric) => allowlist.has(metric.name))).toBe(true);
    expect(JSON.stringify(metrics)).not.toMatch(/participation|completionMethod|voice|touch/u);
  });
});
