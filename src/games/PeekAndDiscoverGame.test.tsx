// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialCommunicationProgress } from '../domain/communicationProgress';
import type { CommunicationGameScope } from '../domain/communicationGame';
import { learningConcepts } from '../content/concepts';
import type { CommunicationAssetReadiness } from '../services/communicationAssetReadiness';
import type {
  InteractionCancellationReason,
  InteractionMediaOutcome,
  InteractionMediaRequest,
} from '../services/interactionMediaCoordinator';
import type { RecordedSpeechBackend } from '../services/recordedSpeech';
import {
  PeekAndDiscoverGame,
  PeekAndDiscoverRecordedSpeechBackend,
  type PeekAndDiscoverAmbientCoordinator,
  type PeekAndDiscoverAssetErrorEvent,
  type PeekAndDiscoverGameCoordinator,
  type PeekAndDiscoverGameDependencies,
  type PeekAndDiscoverSessionStopEvent,
} from './PeekAndDiscoverGame';
import {
  PEEK_AND_DISCOVER_CONTENT_VERSION,
  PEEK_AND_DISCOVER_GAG_MS,
  PEEK_AND_DISCOVER_MAX_DURATION_MS,
  PEEK_AND_DISCOVER_REDUCED_MOTION_MS,
  PEEK_AND_DISCOVER_REST_MS,
  PEEK_AND_DISCOVER_REVEAL_MS,
  PEEK_AND_DISCOVER_SILENCE_DEMO_MS,
  PEEK_AND_DISCOVER_SILENCE_WAIT_MS,
} from './peekAndDiscover';
import type { ToddlerSettings } from '../domain/types';

const cssSource = readFileSync(join(process.cwd(), 'src/games/PeekAndDiscoverGame.css'), 'utf8');
const knownImageUrls = new Set<string>(learningConcepts.map((concept) => concept.image));

interface Deferred<Value> {
  promise: Promise<Value>;
  resolve: (value: Value) => void;
  settled: boolean;
}

function deferred<Value>(): Deferred<Value> {
  let resolvePromise!: (value: Value) => void;
  const handle: Deferred<Value> = {
    settled: false,
    promise: new Promise<Value>((resolve) => {
      resolvePromise = (value) => {
        handle.settled = true;
        resolve(value);
      };
    }),
    resolve: (value) => {
      resolvePromise(value);
    },
  };
  return handle;
}

class FakeGameCoordinator implements PeekAndDiscoverGameCoordinator {
  readonly calls: InteractionMediaRequest[] = [];
  readonly outcomes: Array<Deferred<InteractionMediaOutcome>> = [];
  readonly play = vi.fn((request: InteractionMediaRequest) => {
    this.calls.push(request);
    const handle = deferred<InteractionMediaOutcome>();
    this.outcomes.push(handle);
    if (this.autoStatus !== null) {
      const status = this.autoStatus;
      queueMicrotask(() => {
        if (!handle.settled) {
          handle.resolve({ intentId: request.intentId, status });
        }
      });
    }
    return handle.promise;
  });
  readonly cancelAll = vi.fn((reason: 'exit' | 'background' = 'exit') => {
    const status = 'cancelled';
    for (let index = 0; index < this.outcomes.length; index += 1) {
      const outcome = this.outcomes[index];
      const request = this.calls[index];
      if (outcome && request && !outcome.settled) {
        outcome.resolve({ intentId: request.intentId, status });
      }
    }
    return reason;
  });
  readonly notifyInteraction = vi.fn((
    scope: CommunicationGameScope,
    reason: InteractionCancellationReason,
  ) => {
    if (!this.settleOnNotify) {
      return;
    }
    for (let index = 0; index < this.outcomes.length; index += 1) {
      const outcome = this.outcomes[index];
      const request = this.calls[index];
      if (
        outcome
        && request
        && !outcome.settled
        && request.scope.activityId === scope.activityId
        && request.scope.sessionId === scope.sessionId
      ) {
        outcome.resolve({
          intentId: request.intentId,
          status: reason === 'exit' || reason === 'background' ? 'cancelled' : 'replaced',
        });
      }
    }
  });

  constructor(
    private readonly autoStatus: InteractionMediaOutcome['status'] | null = null,
    private readonly settleOnNotify = true,
  ) {}

  resolve(index: number, status: InteractionMediaOutcome['status'] = 'completed'): void {
    const outcome = this.outcomes[index];
    const request = this.calls[index];
    if (outcome && request && !outcome.settled) {
      outcome.resolve({ intentId: request.intentId, status });
    }
  }
}

const defaultSettings: ToddlerSettings = {
  childName: 'Sean',
  languageMode: 'bilingual',
  englishVoiceLocale: 'en-US',
  soundLevel: 0.7,
  reducedMotion: false,
  quietMode: false,
};

function readyReadiness(locale: 'he-IL' | 'en-US' | 'en-GB'): CommunicationAssetReadiness {
  return {
    status: 'ready',
    contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
    locale,
  };
}

function cleanKeys(value: unknown): void {
  const banned = ['accuracy', 'correct', 'wrong', 'diagnosis', 'clinical', 'score', 'microphone'];
  const seen = new Set<unknown>();
  const visit = (entry: unknown): void => {
    if (entry === null || typeof entry !== 'object' || seen.has(entry)) {
      return;
    }
    seen.add(entry);
    for (const [key, nested] of Object.entries(entry)) {
      expect(banned.some((term) => key.toLowerCase().includes(term))).toBe(false);
      visit(nested);
    }
  };
  visit(value);
}

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
  PointerEvent?: typeof MouseEvent;
};

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;

  constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'touch';
    this.isPrimary = init.isPrimary ?? true;
  }
}

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  if (reactActEnvironment.PointerEvent === undefined) {
    (reactActEnvironment as { PointerEvent?: unknown }).PointerEvent = TestPointerEvent;
  }
});

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
});

describe('PeekAndDiscoverGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  let ambientCoordinator: PeekAndDiscoverAmbientCoordinator;
  let gameCoordinator: FakeGameCoordinator;
  let assetReadiness: Pick<PeekAndDiscoverGameDependencies, 'assetReadiness'>['assetReadiness'];
  let preloadImage: NonNullable<PeekAndDiscoverGameDependencies['preloadImage']>;
  let onProgressChange: ReturnType<typeof vi.fn>;
  let onAssetError: ReturnType<typeof vi.fn>;
  let onSessionStop: ReturnType<typeof vi.fn>;
  let onBack: ReturnType<typeof vi.fn>;
  let currentSettings: ToddlerSettings;
  let currentDependencies: PeekAndDiscoverGameDependencies;
  let getUserMediaSpy: { mockRestore: () => void; mock: { calls: unknown[][] } } | null;
  let speechSynthesisSpeakSpy: { mockRestore: () => void; mock: { calls: unknown[][] } } | null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T10:00:00.000Z'));

    gameCoordinator = new FakeGameCoordinator(null);
    ambientCoordinator = { notifyInteraction: vi.fn() };
    assetReadiness = {
      validate: vi.fn(async (requirements) => readyReadiness(requirements.locale)),
    };
    preloadImage = vi.fn(async () => undefined);
    onProgressChange = vi.fn();
    onAssetError = vi.fn();
    onSessionStop = vi.fn();
    onBack = vi.fn();
    currentSettings = { ...defaultSettings };
    currentDependencies = {
      assetReadiness,
      preloadImage,
      ambientCoordinator,
      gameCoordinator,
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    getUserMediaSpy = typeof navigator.mediaDevices?.getUserMedia === 'function'
      ? vi.spyOn(navigator.mediaDevices, 'getUserMedia')
      : null;
    speechSynthesisSpeakSpy = 'speechSynthesis' in window
      && typeof window.speechSynthesis?.speak === 'function'
      ? vi.spyOn(window.speechSynthesis, 'speak')
      : null;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    getUserMediaSpy?.mockRestore();
    speechSynthesisSpeakSpy?.mockRestore();
    vi.useRealTimers();
  });

  async function renderGame(options: {
    strictMode?: boolean;
    settings?: Partial<ToddlerSettings>;
    dependencies?: Partial<PeekAndDiscoverGameDependencies>;
  } = {}) {
    currentSettings = { ...currentSettings, ...options.settings };
    currentDependencies = { ...currentDependencies, ...options.dependencies };
    const node = (
      <PeekAndDiscoverGame
        settings={currentSettings}
        communicationProgress={createInitialCommunicationProgress(PEEK_AND_DISCOVER_CONTENT_VERSION)}
        onProgressChange={onProgressChange}
        onAssetError={onAssetError}
        onSessionStop={onSessionStop}
        onBack={onBack}
        sessionId="test-session"
        dependencies={currentDependencies}
      />
    );
    await act(async () => {
      root.render(options.strictMode ? <StrictMode>{node}</StrictMode> : node);
    });
  }

  async function rerender(settings: Partial<ToddlerSettings> = {}) {
    await renderGame({ settings });
  }

  async function settle(times = 6) {
    for (let index = 0; index < times; index += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  async function advanceBy(ms: number) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
    await settle();
  }

  function stage(): HTMLElement {
    const value = container.querySelector<HTMLElement>('.peek-and-discover-game');
    expect(value).not.toBeNull();
    return value!;
  }

  function cover(): HTMLButtonElement {
    const value = container.querySelector<HTMLButtonElement>('.peek-and-discover-cover-button');
    expect(value).not.toBeNull();
    return value!;
  }

  function objectButton(): HTMLButtonElement {
    const value = container.querySelector<HTMLButtonElement>('.peek-and-discover-object-button');
    expect(value).not.toBeNull();
    return value!;
  }

  function firePointer(
    target: Element,
    type: string,
    init: MouseEventInit & { pointerId?: number; pointerType?: string } = {},
  ) {
    act(() => {
      target.dispatchEvent(new TestPointerEvent(type, { bubbles: true, cancelable: true, ...init }));
    });
  }

  async function interruptTutorialAndReachMandatoryModel() {
    await settle();
    firePointer(cover(), 'pointerdown', { pointerId: 7, pointerType: 'touch' });
    firePointer(cover(), 'pointermove', { pointerId: 7, pointerType: 'touch' });
    firePointer(cover(), 'pointerup', { pointerId: 7, pointerType: 'touch' });
    await settle();
    await advanceBy(PEEK_AND_DISCOVER_REVEAL_MS);
  }

  async function completeCurrentRound() {
    firePointer(cover(), 'pointerdown', { pointerId: 4, pointerType: 'touch' });
    await settle();
    await advanceBy(PEEK_AND_DISCOVER_REVEAL_MS);
    await act(async () => {
      gameCoordinator.resolve(gameCoordinator.calls.length - 1, 'completed');
    });
    await settle();
    await act(async () => {
      objectButton().click();
    });
    await settle();
    await advanceBy(PEEK_AND_DISCOVER_GAG_MS);
    if (stage().dataset.phase !== 'session-stop') {
      await advanceBy(PEEK_AND_DISCOVER_REST_MS);
      await settle();
    }
  }

  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: state,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  it('interrupts the tutorial immediately, treats tap and pull the same, and collapses ten rapid touches into one play under StrictMode', async () => {
    await renderGame({ strictMode: true });
    await settle();

    const curtain = cover();
    const rapidTouchBatch = async () => act(async () => {
      for (let index = 0; index < 10; index += 1) {
        curtain.dispatchEvent(new TestPointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: index + 1,
          pointerType: 'touch',
        }));
        curtain.dispatchEvent(new TestPointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          pointerId: index + 1,
          pointerType: 'touch',
        }));
        curtain.dispatchEvent(new TestPointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerId: index + 1,
          pointerType: 'touch',
        }));
      }
    });
    await rapidTouchBatch();
    await settle();
    if (stage().dataset.phase === 'tutorial') {
      await rapidTouchBatch();
      await settle();
    }
    expect(stage().dataset.phase).toBe('revealing');

    await advanceBy(PEEK_AND_DISCOVER_REVEAL_MS);
    expect(stage().dataset.phase).toBe('mandatory-model');
    expect(gameCoordinator.play).toHaveBeenCalledTimes(1);
    expect(gameCoordinator.calls[0]?.audioClass).toBe('mandatory');
    expect(gameCoordinator.calls[0]?.source).toBe('touch');
    expect(gameCoordinator.calls[0]?.segments).toHaveLength(1);
  });

  it('waits for true playback completion, sends exactly one locale-locked segment, and cancels ambient audio first', async () => {
    await renderGame();
    await interruptTutorialAndReachMandatoryModel();

    expect(stage().dataset.phase).toBe('mandatory-model');
    expect(gameCoordinator.play).toHaveBeenCalledTimes(1);
    const request = gameCoordinator.calls[0];
    expect(request?.audioClass).toBe('mandatory');
    expect(request?.segments).toEqual([
      expect.objectContaining({
        text: request?.segments?.[0]?.text,
        locale: request?.localeLock?.locale,
      }),
    ]);
    expect(request?.segments?.[0]?.text).toBe(request?.segments?.[0]?.recordedText ?? request?.segments?.[0]?.text);
    expect(request?.localeLock?.boundary).toBe('round');
    expect((ambientCoordinator.notifyInteraction as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ roundId: 'round-1' }),
      'activity-replacement',
    );

    await advanceBy(PEEK_AND_DISCOVER_REVEAL_MS + PEEK_AND_DISCOVER_GAG_MS);
    expect(stage().dataset.phase).toBe('mandatory-model');

    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    await settle();
    expect(gameCoordinator.play).toHaveBeenCalledTimes(1);

    await act(async () => {
      gameCoordinator.resolve(0, 'completed');
    });
    await settle();
    expect(stage().dataset.phase).toBe('reaction');
  });

  it('cancels on background, returns in a stable foreground without autoplay, and resumes only after a fresh touch', async () => {
    await renderGame();
    await interruptTutorialAndReachMandatoryModel();
    const beforeBackgroundContent = stage().dataset.contentId;
    const beforeBackgroundLocale = stage().dataset.locale;

    setVisibility('hidden');
    await settle();
    expect(gameCoordinator.cancelAll).toHaveBeenCalledWith('background');
    expect(stage().dataset.phase).toBe('paused');

    setVisibility('visible');
    await settle();
    expect(stage().dataset.phase).toBe('ready');
    expect(stage().dataset.contentId).toBe(beforeBackgroundContent);
    expect(stage().dataset.locale).toBe(beforeBackgroundLocale);

    await advanceBy(PEEK_AND_DISCOVER_REST_MS + 20_000);
    expect(stage().dataset.phase).toBe('ready');
    expect(gameCoordinator.play).toHaveBeenCalledTimes(1);

    firePointer(cover(), 'pointerdown', { pointerId: 33, pointerType: 'touch' });
    await settle();
    await advanceBy(PEEK_AND_DISCOVER_REVEAL_MS);
    expect(gameCoordinator.play).toHaveBeenCalledTimes(2);
  });

  it('keeps late readiness and preload settlement blocked after foreground until fresh touch', async () => {
    const readiness = deferred<CommunicationAssetReadiness>();
    const preload = deferred<void>();
    await renderGame({
      dependencies: {
        assetReadiness: { validate: vi.fn(() => readiness.promise) },
        preloadImage: vi.fn(() => preload.promise),
      },
    });
    await settle();

    setVisibility('hidden');
    await settle();
    expect(stage().dataset.phase).toBe('paused');
    setVisibility('visible');
    await settle();
    expect(stage().dataset.phase).toBe('ready');

    readiness.resolve(readyReadiness('he-IL'));
    preload.resolve(undefined);
    await settle();
    expect(stage().dataset.phase).toBe('ready');

    await advanceBy(
      PEEK_AND_DISCOVER_SILENCE_WAIT_MS
      + PEEK_AND_DISCOVER_SILENCE_DEMO_MS
      + PEEK_AND_DISCOVER_REVEAL_MS
      + 100,
    );
    expect(stage().dataset.phase).toBe('ready');
    expect(gameCoordinator.play).not.toHaveBeenCalled();

    firePointer(cover(), 'pointerdown', { pointerId: 34, pointerType: 'touch' });
    await settle();
    await advanceBy(PEEK_AND_DISCOVER_REVEAL_MS);
    expect(stage().dataset.phase).toBe('mandatory-model');
    expect(gameCoordinator.play).toHaveBeenCalledTimes(1);
  });

  it('keeps a foregrounded completed gag on the same object until the child advances it', async () => {
    await renderGame();
    await interruptTutorialAndReachMandatoryModel();
    await act(async () => {
      gameCoordinator.resolve(0, 'completed');
    });
    await settle();
    await act(async () => {
      objectButton().click();
    });
    await settle();
    await advanceBy(PEEK_AND_DISCOVER_GAG_MS);
    expect(stage().dataset.phase).toBe('rest');
    const completedContentId = stage().dataset.contentId;

    setVisibility('hidden');
    await settle();
    setVisibility('visible');
    await settle();
    expect(stage().dataset.phase).toBe('reaction');
    expect(stage().dataset.contentId).toBe(completedContentId);

    await advanceBy(PEEK_AND_DISCOVER_REST_MS + PEEK_AND_DISCOVER_GAG_MS + 20_000);
    expect(stage().dataset.phase).toBe('reaction');
    expect(stage().dataset.contentId).toBe(completedContentId);

    await act(async () => {
      objectButton().click();
    });
    await settle();
    expect(stage().dataset.phase).toBe('rest');
    await advanceBy(PEEK_AND_DISCOVER_REST_MS);
    expect(stage().dataset.phase).toBe('ready');
    expect(stage().dataset.contentId).not.toBe(completedContentId);
  });

  it('preserves the object and locale on resize/orientation changes, and only uses updated locale settings for the next round built during rest', async () => {
    await renderGame();
    await settle();
    const firstContentId = stage().dataset.contentId;
    const firstLocale = stage().dataset.locale;

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1180 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 760 });
    act(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('orientationchange'));
    });
    await settle();
    expect(stage().dataset.orientation).toBe('landscape');
    expect(stage().dataset.contentId).toBe(firstContentId);
    expect(stage().dataset.locale).toBe(firstLocale);

    await interruptTutorialAndReachMandatoryModel();
    await act(async () => {
      gameCoordinator.resolve(0, 'completed');
    });
    await settle();
    await act(async () => {
      objectButton().click();
    });
    await settle();
    await advanceBy(PEEK_AND_DISCOVER_GAG_MS);
    expect(stage().dataset.phase).toBe('rest');
    expect(stage().dataset.locale).toBe(firstLocale);

    await rerender({ englishVoiceLocale: 'en-GB' });
    await advanceBy(PEEK_AND_DISCOVER_REST_MS);
    await settle();
    expect(stage().dataset.phase).toBe('ready');
    expect(stage().dataset.locale).toBe('en-GB');
    expect(stage().dataset.contentId).not.toBe(firstContentId);
  });

  it('keeps reduced motion at 200ms or less with no travelling class and no transform-only dependency', async () => {
    await renderGame({ settings: { reducedMotion: true } });
    await settle();
    firePointer(cover(), 'pointerdown', { pointerId: 11, pointerType: 'touch' });
    await settle();
    const art = container.querySelector<HTMLElement>('.peek-and-discover-art');
    expect(stage().dataset.phase).toBe('revealing');
    expect(stage().dataset.reducedMotion).toBe('true');
    expect(art?.classList.contains('is-travelling')).toBe(false);
    await advanceBy(PEEK_AND_DISCOVER_REDUCED_MOTION_MS);
    expect(stage().dataset.phase).toBe('mandatory-model');
    expect(cssSource).toContain('transition-duration: 160ms;');
    expect(cssSource).toContain('transform: none;');
  });

  it('reports missing recordings and preload failures as child-safe asset errors with clean callback data', async () => {
    const missingRecording: NonNullable<PeekAndDiscoverGameDependencies['assetReadiness']> = {
      validate: vi.fn(async () => ({
        status: 'not-ready' as const,
        contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
        locale: 'he-IL' as const,
        issues: [{
          code: 'missing-recording' as const,
          childSafeCode: 'content-unavailable' as const,
          diagnostic: 'Missing exact recording.',
          asset: 'כדור',
        }],
      })),
    };
    await renderGame({ dependencies: { assetReadiness: missingRecording } });
    await settle();

    expect(stage().dataset.phase).toBe('asset-error');
    expect(onAssetError).toHaveBeenCalledTimes(1);
    const recordingEvent = onAssetError.mock.calls[0]?.[0] as PeekAndDiscoverAssetErrorEvent;
    expect(recordingEvent.diagnostic.issueCode).toBe('missing-recording');
    cleanKeys(recordingEvent);

    onAssetError.mockClear();
    await act(async () => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await renderGame({
      dependencies: {
        assetReadiness: { validate: vi.fn(async () => readyReadiness('he-IL')) },
        preloadImage: vi.fn(async () => {
          throw new Error('Image failed to preload.');
        }),
      },
    });
    await settle();
    expect(stage().dataset.phase).toBe('asset-error');
    const imageEvent = onAssetError.mock.calls[0]?.[0] as PeekAndDiscoverAssetErrorEvent;
    expect(imageEvent.diagnostic.issueCode).toBe('missing-image');
    cleanKeys(imageEvent);
  });

  it('stops calmly on the sixth reveal and at the four-minute deadline', async () => {
    await renderGame();
    await settle();

    for (let index = 0; index < 6; index += 1) {
      await completeCurrentRound();
    }
    expect(stage().dataset.phase).toBe('session-stop');
    expect(onSessionStop).toHaveBeenCalledTimes(1);
    const revealStop = onSessionStop.mock.calls[0]?.[0] as PeekAndDiscoverSessionStopEvent;
    expect(revealStop.reason).toBe('max-reveals');
    expect(revealStop.revealCount).toBe(6);
    cleanKeys(revealStop);

    onSessionStop.mockClear();
    await act(async () => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const waitingReadiness = deferred<CommunicationAssetReadiness>();
    await renderGame({
      dependencies: {
        gameCoordinator: new FakeGameCoordinator(null),
        assetReadiness: { validate: vi.fn(() => waitingReadiness.promise) },
      },
    });
    await settle();
    await advanceBy(PEEK_AND_DISCOVER_MAX_DURATION_MS);
    expect(stage().dataset.phase).toBe('session-stop');
    const timeStop = onSessionStop.mock.calls[0]?.[0] as PeekAndDiscoverSessionStopEvent;
    expect(timeStop.reason).toBe('time-elapsed');
  });

  it('cancels only this activity when the deadline fires during mandatory playback', async () => {
    gameCoordinator = new FakeGameCoordinator(null, false);
    await renderGame({ dependencies: { gameCoordinator } });
    await interruptTutorialAndReachMandatoryModel();
    expect(stage().dataset.phase).toBe('mandatory-model');
    expect(gameCoordinator.outcomes[0]?.settled).toBe(false);

    await advanceBy(PEEK_AND_DISCOVER_MAX_DURATION_MS - PEEK_AND_DISCOVER_REVEAL_MS);
    expect(stage().dataset.phase).toBe('session-stop');
    expect(gameCoordinator.notifyInteraction).toHaveBeenCalledTimes(1);
    expect(gameCoordinator.notifyInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 'peek-and-discover',
        sessionId: 'test-session',
        roundId: 'round-1',
      }),
      'round-replacement',
    );
    expect(gameCoordinator.cancelAll).not.toHaveBeenCalled();
    expect(gameCoordinator.outcomes[0]?.settled).toBe(false);
    expect(onSessionStop).toHaveBeenCalledTimes(1);
    expect((onSessionStop.mock.calls[0]?.[0] as PeekAndDiscoverSessionStopEvent).reason).toBe('time-elapsed');
    expect(onProgressChange).toHaveBeenCalledTimes(1);
    expect(onProgressChange.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      roundsSeen: 0,
      sessionsCompleted: 1,
    }));

    gameCoordinator.resolve(0, 'completed');
    await settle();
    expect(gameCoordinator.outcomes[0]?.settled).toBe(true);
    expect(stage().dataset.phase).toBe('session-stop');
    expect(onSessionStop).toHaveBeenCalledTimes(1);
    expect(onProgressChange).toHaveBeenCalledTimes(1);
  });

  it('does not start recorded playback when cancellation occurs during unlock', async () => {
    const unlock = deferred<void>();
    const player: RecordedSpeechBackend = {
      isEnabled: vi.fn(() => true),
      unlock: vi.fn(() => unlock.promise),
      play: vi.fn(async () => undefined),
      cancel: vi.fn(),
    };
    const backend = new PeekAndDiscoverRecordedSpeechBackend(player);
    const scope = 'communication:peek-and-discover:test-session:round-1:word-1';
    const playback = backend.speakSegments(
      [{ text: 'כדור', recordedText: 'כדור', locale: 'he-IL' }],
      defaultSettings,
      { scope, key: 'mandatory-word', priority: 'label' },
    );

    backend.cancelScope(scope, 'replay');
    expect(player.cancel).toHaveBeenCalledTimes(1);
    unlock.resolve(undefined);

    await expect(playback).resolves.toEqual(expect.objectContaining({ status: 'superseded' }));
    expect(player.play).not.toHaveBeenCalled();
  });

  it('never calls getUserMedia or speechSynthesis and keeps to existing image URLs only', async () => {
    gameCoordinator = new FakeGameCoordinator('completed');
    await renderGame({ dependencies: { gameCoordinator } });
    await settle();
    const image = container.querySelector<HTMLImageElement>('.peek-and-discover-object-image');
    expect(image).not.toBeNull();
    expect(knownImageUrls.has(new URL(image!.src).pathname)).toBe(true);

    firePointer(cover(), 'pointerdown', { pointerId: 2, pointerType: 'touch' });
    await settle();
    await advanceBy(PEEK_AND_DISCOVER_REVEAL_MS);
    await settle();

    expect(getUserMediaSpy?.mock.calls ?? []).toHaveLength(0);
    expect(speechSynthesisSpeakSpy?.mock.calls ?? []).toHaveLength(0);
  });

  it('exposes localized accessibility labels, a live status, and the target-size CSS contracts', async () => {
    await renderGame();
    await settle();

    expect(cover().getAttribute('aria-label')).toBeTruthy();
    expect(objectButton().getAttribute('aria-label')).toBeTruthy();
    expect(container.querySelector('.peek-and-discover-art')?.hasAttribute('aria-hidden')).toBe(false);
    expect(container.querySelector('.peek-and-discover-back')?.getAttribute('aria-label')).toBeTruthy();
    expect(container.querySelector('[role="status"]')?.textContent?.length).toBeGreaterThan(0);
    expect(cssSource).toContain('--peek-primary-min: 88px;');
    expect(cssSource).toContain('--peek-secondary-min: 64px;');
    expect(cssSource).toContain('min-width: 160px;');
    expect(cssSource).toContain('min-width: 280px;');
  });
});
