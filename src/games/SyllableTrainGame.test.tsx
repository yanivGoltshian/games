// @vitest-environment jsdom

import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { WORD_TRAIN_CONTENT_VERSION } from '../content/syllableTrain';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import type { SyllableTrainRound, ToddlerSettings } from '../domain/types';
import {
  InteractionMediaCoordinator,
  type InteractionMediaOutcome,
} from '../services/interactionMediaCoordinator';
import { MicrophonePlaybackGuard } from '../services/microphonePlaybackGuard';
import type {
  RecordedSpeechBackend,
  RecordedSpeechPlayOptions,
} from '../services/recordedSpeech';
import {
  WORD_TRAIN_FIRST_OPPORTUNITY_MS,
  WORD_TRAIN_REST_MS,
  WORD_TRAIN_REWARD_MS,
  WORD_TRAIN_SECOND_OPPORTUNITY_MS,
} from './syllableTrainState';
import { SyllableTrainGame, type SyllableTrainGameProps } from './SyllableTrainGame';
import {
  RecordedOnlyWordTrainSpeechBackend,
  WordTrainMediaController,
} from './wordTrainMedia';

const testRound: SyllableTrainRound = {
  conceptId: 'ball',
  contentVersion: WORD_TRAIN_CONTENT_VERSION,
  image: '/assets/vocabulary/ball.webp',
  recordings: {
    'he-IL': 'כדור',
    'en-US': 'ball',
    'en-GB': 'ball',
  },
  signature: 'ball',
};

const doubles = vi.hoisted(() => ({
  validate: vi.fn(),
  play: vi.fn(),
  notifyInteraction: vi.fn(),
  unlockMedia: vi.fn(),
  playTap: vi.fn(),
  unlock: vi.fn(),
  startMic: vi.fn(),
  stopMic: vi.fn(),
  micSample: null as null | ((level: 0 | 1, deltaMs: number) => void),
  micSupported: true,
  lifecycle: 'foreground' as 'foreground' | 'background',
  roundKey: 'word-train-round-1',
  startNextRound: vi.fn(),
}));

vi.mock('../services/communicationAssetReadiness', () => ({
  communicationAssetReadiness: {
    validate: doubles.validate,
  },
}));

vi.mock('../services/sound', () => ({
  getSharedAudioContext: () => null,
  unlockAudioContext: async () => undefined,
  soundService: {
    playTap: doubles.playTap,
    unlock: doubles.unlock,
  },
}));

vi.mock('../platform/useAppLifecycle', () => ({
  subscribeAppLifecycle: () => () => undefined,
  useAppLifecycle: () => doubles.lifecycle,
}));

vi.mock('./useMicEffort', () => ({
  useMicEffort: (onSample: (level: 0 | 1, deltaMs: number) => void) => {
    doubles.micSample = onSample;
    return {
      start: doubles.startMic,
      stop: doubles.stopMic,
      supported: doubles.micSupported,
    };
  },
}));

vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({
    round: testRound,
    roundKey: doubles.roundKey,
    startNextRound: doubles.startNextRound,
  }),
}));

vi.mock('../art/mascot', () => ({
  PuppyMascotArt: (props: { className?: string }) => (
    <svg data-testid="train-mascot" className={props.className} />
  ),
}));

function completedOutcome(): InteractionMediaOutcome {
  return { intentId: 'test', status: 'completed' };
}

function pointerEvent(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}

interface DeferredPlayback {
  options: RecordedSpeechPlayOptions;
  resolve: () => void;
  settled: boolean;
}

class DeferredRecordedSpeech implements RecordedSpeechBackend {
  readonly played: DeferredPlayback[] = [];
  readonly unlock = vi.fn(async () => undefined);
  readonly cancel = vi.fn(() => {
    this.played.find((playback) => !playback.settled)?.resolve();
  });

  isEnabled = () => true;

  play = (options: RecordedSpeechPlayOptions): Promise<void> => new Promise((resolve) => {
    const playback: DeferredPlayback = {
      options,
      settled: false,
      resolve: () => {
        playback.settled = true;
        resolve();
      },
    };
    this.played.push(playback);
  });

  start(index: number): void {
    this.played[index]?.options.onStart();
  }

  finish(index: number): void {
    this.played[index]?.resolve();
  }
}

describe('SyllableTrainGame whole-word rebuild', () => {
  let container: HTMLDivElement;
  let root: Root;
  let lastProps: SyllableTrainGameProps;
  const storage = new Map<string, string>();
  const localStorageDouble: Storage = {
    get length() {
      return storage.size;
    },
    clear: () => storage.clear(),
    getItem: (key) => storage.get(key) ?? null,
    key: (index) => [...storage.keys()][index] ?? null,
    removeItem: (key) => {
      storage.delete(key);
    },
    setItem: (key, value) => {
      storage.set(key, String(value));
    },
  };
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageDouble,
    });
  });

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    localStorage.clear();
    localStorage.setItem(`${WORD_TRAIN_CONTENT_VERSION}:tutorial-seen`, 'true');
    doubles.validate.mockReset();
    doubles.validate.mockResolvedValue({
      status: 'ready',
      contentVersion: WORD_TRAIN_CONTENT_VERSION,
      locale: 'he-IL',
    });
    doubles.play.mockReset();
    doubles.play.mockResolvedValue(completedOutcome());
    doubles.notifyInteraction.mockReset();
    doubles.unlockMedia.mockReset();
    doubles.unlockMedia.mockResolvedValue(undefined);
    doubles.playTap.mockReset();
    doubles.unlock.mockReset();
    doubles.startMic.mockReset();
    doubles.startMic.mockResolvedValue({ status: 'started' });
    doubles.stopMic.mockReset();
    doubles.startNextRound.mockReset();
    doubles.micSample = null;
    doubles.micSupported = true;
    doubles.lifecycle = 'foreground';
    doubles.roundKey = 'word-train-round-1';
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
    vi.useRealTimers();
  });

  async function flush(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function renderGame(
    settings: ToddlerSettings = createInitialSettings(),
    overrides: Partial<SyllableTrainGameProps> = {},
    strictMode = false,
  ): Promise<SyllableTrainGameProps> {
    const progress = createInitialProgress(false, 0);
    lastProps = {
      domainProgress: progress.domains.syllableTrain,
      settings,
      overallStars: 0,
      mediaReady: true,
      speechStatus: {
        supported: true,
        voiceAvailable: true,
        speaking: false,
        activeRequestId: null,
        activeCue: null,
      },
      onBack: vi.fn(),
      onCompleteRound: vi.fn(),
      onCommunicationMetrics: vi.fn(),
      mediaCoordinator: {
        play: doubles.play,
        notifyInteraction: doubles.notifyInteraction,
        unlock: doubles.unlockMedia,
      },
      ...overrides,
    };
    await act(async () => {
      const game = <SyllableTrainGame {...lastProps} />;
      root.render(strictMode ? <StrictMode>{game}</StrictMode> : game);
    });
    await flush();
    return lastProps;
  }

  async function rerender(overrides: Partial<SyllableTrainGameProps> = {}): Promise<void> {
    lastProps = { ...lastProps, ...overrides };
    await act(async () => {
      root.render(<SyllableTrainGame {...lastProps} />);
    });
    await flush();
  }

  it('validates exact-locale assets and finishes the whole recorded word before queued touch', async () => {
    let finishPlayback: ((outcome: InteractionMediaOutcome) => void) | undefined;
    doubles.play.mockImplementation(() => new Promise((resolve) => {
      finishPlayback = resolve;
    }));
    const onCompleteRound = vi.fn();
    const domainProgress = createInitialProgress(false, 0).domains.syllableTrain;
    const historySnapshot = structuredClone(domainProgress);

    await renderGame(createInitialSettings(), { domainProgress, onCompleteRound });

    expect(doubles.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        contentVersion: WORD_TRAIN_CONTENT_VERSION,
        locale: 'he-IL',
        recordingKeys: ['כדור'],
        images: [{ kind: 'url', value: testRound.image }],
      }),
      expect.objectContaining({ contentVersion: WORD_TRAIN_CONTENT_VERSION }),
    );
    expect(doubles.play).toHaveBeenCalledTimes(1);
    const request = doubles.play.mock.calls[0]![0];
    expect(request.segments).toEqual([{
      text: 'כדור',
      recordedText: 'כדור',
      locale: 'he-IL',
    }]);
    expect(request.audioClass).toBe('mandatory');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.syllable-train-car--left')!.click();
      await Promise.resolve();
    });
    await flush();
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
    expect(surface.dataset.phase).toBe('mandatory-model');
    expect(surface.dataset.pending).toBe('true');
    expect(surface.dataset.connected).toBe('false');
    expect(doubles.notifyInteraction).not.toHaveBeenCalledWith(
      expect.any(Object),
      'touch',
    );

    await act(async () => {
      finishPlayback?.(completedOutcome());
      await Promise.resolve();
    });
    await flush();
    expect(surface.dataset.phase).toBe('reward');
    expect(surface.dataset.connected).toBe('true');
    expect(onCompleteRound).not.toHaveBeenCalled();
    expect(domainProgress).toEqual(historySnapshot);
  });

  it('queues one early multi-touch intent without cancelling deferred real playback', async () => {
    const player = new DeferredRecordedSpeech();
    const sharedCoordinator = new InteractionMediaCoordinator(
      new RecordedOnlyWordTrainSpeechBackend(player),
      new MicrophonePlaybackGuard(),
      () => () => undefined,
    );
    const mediaCoordinator = new WordTrainMediaController(player, sharedCoordinator);
    const notifyInteraction = vi.spyOn(mediaCoordinator, 'notifyInteraction');
    const onMetrics = vi.fn();

    await renderGame(createInitialSettings(), {
      mediaCoordinator,
      onCommunicationMetrics: onMetrics,
    });
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
    const left = container.querySelector<HTMLButtonElement>('.syllable-train-car--left')!;
    expect(surface.dataset.phase).toBe('mandatory-model');
    expect(player.played).toHaveLength(1);

    await act(async () => {
      left.dispatchEvent(pointerEvent('pointerdown', 1, 10, 10));
      left.dispatchEvent(pointerEvent('pointerdown', 2, 10, 10));
      left.dispatchEvent(pointerEvent('pointerup', 1, 10, 10));
      left.dispatchEvent(pointerEvent('pointerup', 2, 10, 10));
      left.dispatchEvent(pointerEvent('click', 1, 10, 10));
      left.dispatchEvent(pointerEvent('click', 2, 10, 10));
    });

    expect(surface.dataset.pending).toBe('true');
    expect(surface.dataset.connected).toBe('false');
    expect(player.unlock).toHaveBeenCalledOnce();
    expect(player.cancel).not.toHaveBeenCalled();
    expect(notifyInteraction).not.toHaveBeenCalled();

    await act(async () => {
      player.start(0);
      player.finish(0);
      await Promise.resolve();
    });
    await flush();

    expect(player.played).toHaveLength(1);
    expect(surface.dataset.phase).toBe('reward');
    expect(surface.dataset.connected).toBe('true');
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({
      trainsConnected: 1,
    });
    mediaCoordinator.dispose();
  });

  it('starts one mandatory model and completes normally in StrictMode', async () => {
    await renderGame(createInitialSettings(), {}, true);

    expect(doubles.play).toHaveBeenCalledTimes(1);
    expect(container.querySelector<HTMLElement>('.syllable-train-surface')!.dataset.phase)
      .toBe('available');
  });

  it('keeps deferred real playback live in StrictMode without an asset error', async () => {
    const player = new DeferredRecordedSpeech();
    const sharedCoordinator = new InteractionMediaCoordinator(
      new RecordedOnlyWordTrainSpeechBackend(player),
      new MicrophonePlaybackGuard(),
      () => () => undefined,
    );
    const mediaCoordinator = new WordTrainMediaController(player, sharedCoordinator);
    const onMetrics = vi.fn();

    await renderGame(createInitialSettings(), {
      mediaCoordinator,
      onCommunicationMetrics: onMetrics,
    }, true);

    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
    expect(player.cancel).not.toHaveBeenCalled();
    expect(player.played).toHaveLength(1);
    expect(surface.dataset.phase).toBe('mandatory-model');
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({ mediaErrors: 0 });

    await act(async () => {
      player.start(0);
      player.finish(0);
      await Promise.resolve();
    });
    await flush();

    expect(surface.dataset.phase).toBe('available');
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({ mediaErrors: 0 });
    mediaCoordinator.dispose();
  });

  it('ignores real coordinator background cancellation before React lifecycle catches up', async () => {
    let emitMediaLifecycle: (state: 'foreground' | 'background') => void = () => undefined;
    const player = new DeferredRecordedSpeech();
    const sharedCoordinator = new InteractionMediaCoordinator(
      new RecordedOnlyWordTrainSpeechBackend(player),
      new MicrophonePlaybackGuard(),
      (listener) => {
        emitMediaLifecycle = listener;
        return () => {
          emitMediaLifecycle = () => undefined;
        };
      },
    );
    const mediaCoordinator = new WordTrainMediaController(player, sharedCoordinator);
    const onMetrics = vi.fn();

    await renderGame(createInitialSettings(), {
      mediaCoordinator,
      onCommunicationMetrics: onMetrics,
    });
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
    expect(surface.dataset.phase).toBe('mandatory-model');

    await act(async () => {
      emitMediaLifecycle('background');
      await Promise.resolve();
    });
    await flush();

    expect(surface.dataset.phase).toBe('mandatory-model');
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({ mediaErrors: 0 });

    doubles.lifecycle = 'background';
    await rerender();
    expect(surface.dataset.phase).toBe('paused');
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({ mediaErrors: 0 });
    mediaCoordinator.dispose();
  });

  it.each(['replaced', 'cancelled', 'errored', 'unavailable'] as const)(
    'routes same-generation %s mandatory playback to recoverable retry',
    async (status) => {
      doubles.play
        .mockResolvedValueOnce({ intentId: `test-${status}`, status })
        .mockResolvedValueOnce(completedOutcome());

      await renderGame();
      const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
      expect(surface.dataset.phase).toBe('asset-error');

      await act(async () => {
        container.querySelector<HTMLButtonElement>('.syllable-train-retry')!.click();
      });
      await flush();

      expect(doubles.play).toHaveBeenCalledTimes(2);
      expect(surface.dataset.phase).toBe('available');
    },
  );

  it('renders no syllables, parts, prompts, dashes, letters, or whole-word text', async () => {
    await renderGame();

    expect(container.querySelector('.syllable-train-surface')!.textContent).toBe('');
    expect(container.innerHTML).not.toContain('כַּ');
    expect(container.innerHTML).not.toContain('דּוּר');
    expect(container.innerHTML).not.toContain('Couple the train');
    expect(container.innerHTML).not.toContain('>ball<');
    expect(container.querySelector('.syllable-train-car__label')).toBeNull();
    expect(container.querySelector('.syllable-train-prompt')).toBeNull();
    expect(container.querySelector('.syllable-train-whole')).toBeNull();
    expect(container.querySelector('main')?.getAttribute('aria-label')).toBe('רכבת המילים');

    const carriageImages = container.querySelectorAll('.syllable-train-car img');
    expect(carriageImages).toHaveLength(2);
    for (const image of carriageImages) {
      expect(image.getAttribute('src')).toBe(testRound.image);
      expect(image.getAttribute('alt')).toBe('');
    }
  });

  it('keeps the current train locale locked and applies a setting change to the next train', async () => {
    const base = createInitialSettings();
    const enUs = {
      ...base,
      languageMode: 'en' as const,
      englishVoiceLocale: 'en-US' as const,
    };
    const enGb = {
      ...base,
      languageMode: 'en' as const,
      englishVoiceLocale: 'en-GB' as const,
    };
    doubles.startNextRound.mockImplementation(() => {
      doubles.roundKey = 'word-train-round-2';
    });

    await renderGame(enUs);
    expect(doubles.play.mock.calls.at(-1)?.[0].segments[0].locale).toBe('en-US');
    const playCount = doubles.play.mock.calls.length;

    await rerender({ settings: enGb });
    expect(doubles.play).toHaveBeenCalledTimes(playCount);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.syllable-train-car--left')!.click();
    });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WORD_TRAIN_REWARD_MS);
    });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WORD_TRAIN_REST_MS);
    });
    await flush();

    expect(doubles.startNextRound).toHaveBeenCalledTimes(1);
    expect(doubles.play.mock.calls.at(-1)?.[0].segments[0].locale).toBe('en-GB');
  });

  it('runs a first-use mascot demo in order and plays only after connection and light', async () => {
    localStorage.clear();
    doubles.play.mockImplementation((request) => {
      if (String(request.intentId).includes('tutorial')) {
        const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
        expect(surface.dataset.tutorialStep).toBe('modeling');
        expect(surface.dataset.connected).toBe('true');
        expect(surface.dataset.lit).toBe('true');
      }
      return Promise.resolve(completedOutcome());
    });

    await renderGame();
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
    expect(surface.dataset.phase).toBe('tutorial');
    expect(container.querySelector('[data-testid="train-mascot"]')).not.toBeNull();
    expect(doubles.play).not.toHaveBeenCalled();

    for (const expected of ['tap-left', 'tap-right', 'connected', 'lit', 'modeling']) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect([
        expected,
        ...expected === 'modeling' ? ['waiting'] : [],
      ]).toContain(surface.dataset.tutorialStep);
    }
    await flush();
    expect(doubles.play.mock.calls.some(
      ([request]) => String(request.intentId).includes('tutorial'),
    )).toBe(true);
    expect(localStorage.getItem(`${WORD_TRAIN_CONTENT_VERSION}:tutorial-seen`)).toBe('true');
  });

  it('interrupts the demo on child touch and starts normal preparation', async () => {
    localStorage.clear();
    await renderGame();
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;

    await act(async () => {
      surface.dispatchEvent(pointerEvent('pointerdown', 1, 10, 10));
    });
    await flush();

    expect(doubles.notifyInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'syllableTrain' }),
      'round-replacement',
    );
    expect(doubles.play.mock.calls.some(
      ([request]) => String(request.intentId).includes('tutorial'),
    )).toBe(false);
    expect(['preparation', 'mandatory-model', 'available']).toContain(surface.dataset.phase);
  });

  it('opens the first opportunity at the shared 399/400 ms guard boundary', async () => {
    await renderGame();
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
    expect(surface.dataset.phase).toBe('available');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(surface.dataset.phase).toBe('available');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(surface.dataset.phase).toBe('first-opportunity');
  });

  it('uses no more than two bounded opportunities then auto-connects', async () => {
    await renderGame();
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(surface.dataset.phase).toBe('first-opportunity');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WORD_TRAIN_FIRST_OPPORTUNITY_MS);
    });
    expect(surface.dataset.phase).toBe('second-opportunity');
    expect(container.querySelector('.syllable-train-voice')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WORD_TRAIN_SECOND_OPPORTUNITY_MS);
    });
    expect(surface.dataset.phase).toBe('auto-connect');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.syllable-train-car--left')!.click();
    });
    expect(surface.dataset.phase).toBe('auto-connect');
    expect(doubles.notifyInteraction).not.toHaveBeenCalledWith(
      expect.any(Object),
      'touch',
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
    });
    expect(surface.dataset.phase).toBe('reward');
    expect(surface.dataset.connected).toBe('true');
  });

  it('accepts coarse binary voice effort without identifying or scoring content', async () => {
    await renderGame();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    const voice = container.querySelector<HTMLButtonElement>('.syllable-train-voice')!;
    expect(voice.getAttribute('aria-label')).not.toContain('ball');

    await act(async () => voice.click());
    await flush();
    expect(doubles.startMic).toHaveBeenCalledOnce();
    expect(voice.getAttribute('aria-pressed')).toBe('true');

    await act(async () => doubles.micSample?.(1, 16));
    expect(container.querySelector<HTMLElement>('.syllable-train-surface')!.dataset.phase)
      .toBe('reward');
    expect(doubles.stopMic).toHaveBeenCalled();
  });

  it('gives the first pointer ownership, cancels far drags softly, and resets on orientation', async () => {
    const onMetrics = vi.fn();
    await renderGame(createInitialSettings(), { onCommunicationMetrics: onMetrics });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    const left = container.querySelector<HTMLButtonElement>('.syllable-train-car--left')!;

    await act(async () => {
      left.dispatchEvent(pointerEvent('pointerdown', 1, 0, 0));
      left.dispatchEvent(pointerEvent('pointerdown', 2, 0, 0));
      left.dispatchEvent(pointerEvent('pointermove', 2, 80, 80));
      left.dispatchEvent(pointerEvent('pointerup', 2, 80, 80));
      left.dispatchEvent(pointerEvent('click', 2, 80, 80));
    });
    expect(left.classList.contains('is-dragging')).toBe(true);
    expect(left.getAttribute('style')).not.toContain('80px');
    expect(container.querySelector<HTMLElement>('.syllable-train-surface')!.dataset.phase)
      .toBe('first-opportunity');

    await act(async () => {
      left.dispatchEvent(pointerEvent('pointermove', 1, 40, 30));
    });
    expect(left.getAttribute('style')).toContain('40px');

    await act(async () => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    expect(left.classList.contains('is-dragging')).toBe(false);
    expect(doubles.playTap).not.toHaveBeenCalled();
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({ dragCancellations: 1 });

    await act(async () => left.click());
    await flush();
    expect(container.querySelector<HTMLElement>('.syllable-train-surface')!.dataset.phase)
      .toBe('reward');
  });

  it('does not let pointer cancellation swallow the next activation', async () => {
    await renderGame();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    const left = container.querySelector<HTMLButtonElement>('.syllable-train-car--left')!;

    await act(async () => {
      left.dispatchEvent(pointerEvent('pointerdown', 7, 0, 0));
      left.dispatchEvent(pointerEvent('pointermove', 7, 40, 30));
      left.dispatchEvent(pointerEvent('pointercancel', 7, 40, 30));
    });
    expect(container.querySelector<HTMLElement>('.syllable-train-surface')!.dataset.phase)
      .toBe('first-opportunity');

    await act(async () => left.click());
    await flush();
    expect(container.querySelector<HTMLElement>('.syllable-train-surface')!.dataset.phase)
      .toBe('reward');
  });

  it('snaps either carriage from a coarse path into the generous coupling area', async () => {
    await renderGame();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    const right = container.querySelector<HTMLButtonElement>('.syllable-train-car--right')!;
    const coupler = container.querySelector<HTMLElement>('.syllable-train-coupler-target')!;
    coupler.getBoundingClientRect = () => ({
      left: 100,
      right: 220,
      top: 100,
      bottom: 220,
      width: 120,
      height: 120,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });

    await act(async () => {
      right.dispatchEvent(pointerEvent('pointerdown', 5, 350, 20));
      right.dispatchEvent(pointerEvent('pointermove', 5, 250, 90));
      right.dispatchEvent(pointerEvent('pointerup', 5, 245, 90));
    });
    await flush();
    expect(container.querySelector<HTMLElement>('.syllable-train-surface')!.dataset.phase)
      .toBe('reward');
  });

  it('cancels pending and active microphone work on background and ignores stale playback', async () => {
    let finishPlayback: ((outcome: InteractionMediaOutcome) => void) | undefined;
    doubles.play.mockImplementation(() => new Promise((resolve) => {
      finishPlayback = resolve;
    }));
    await renderGame();
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
    expect(surface.dataset.phase).toBe('mandatory-model');

    doubles.lifecycle = 'background';
    await rerender();
    expect(surface.dataset.phase).toBe('paused');
    expect(doubles.stopMic).toHaveBeenCalled();
    expect(doubles.notifyInteraction).toHaveBeenCalledWith(
      expect.any(Object),
      'background',
    );

    finishPlayback?.({ intentId: 'stale-cancelled', status: 'cancelled' });
    await flush();
    expect(surface.dataset.phase).toBe('paused');

    doubles.lifecycle = 'foreground';
    await rerender();
    expect(['preparation', 'mandatory-model']).toContain(surface.dataset.phase);
  });

  it('advances a connected train when reward is interrupted by backgrounding', async () => {
    const onMetrics = vi.fn();
    await renderGame(createInitialSettings(), { onCommunicationMetrics: onMetrics });
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.syllable-train-car--left')!.click();
    });
    await flush();
    expect(surface.dataset.phase).toBe('reward');

    doubles.lifecycle = 'background';
    await rerender();
    expect(surface.dataset.phase).toBe('paused');

    doubles.lifecycle = 'foreground';
    await rerender();
    expect(doubles.startNextRound).toHaveBeenCalledTimes(1);
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({
      trainsConnected: 1,
      trainsSeen: 2,
    });
    expect(['preparation', 'mandatory-model', 'available']).toContain(surface.dataset.phase);
  });

  it('enters asset-error for missing recording/image readiness or media error', async () => {
    doubles.validate.mockResolvedValue({
      status: 'not-ready',
      contentVersion: WORD_TRAIN_CONTENT_VERSION,
      locale: 'he-IL',
      issues: [{
        code: 'missing-recording',
        childSafeCode: 'content-unavailable',
        diagnostic: 'missing',
      }],
    });
    const onMetrics = vi.fn();
    await renderGame(createInitialSettings(), { onCommunicationMetrics: onMetrics });

    expect(container.querySelector<HTMLElement>('.syllable-train-surface')!.dataset.phase)
      .toBe('asset-error');
    expect(doubles.play).not.toHaveBeenCalled();
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({ mediaErrors: 1 });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.syllable-train-retry')!.click();
      await Promise.resolve();
    });
    await flush();
    expect(onMetrics.mock.calls.at(-1)?.[0]).toMatchObject({ mediaErrors: 2 });
  });

  it('uses a static glow reward for reduced motion and keeps controls accessible', async () => {
    await renderGame({ ...createInitialSettings(), reducedMotion: true });
    const left = container.querySelector<HTMLButtonElement>('.syllable-train-car--left')!;
    const right = container.querySelector<HTMLButtonElement>('.syllable-train-car--right')!;
    expect(left.getAttribute('aria-label')).toBeTruthy();
    expect(right.getAttribute('aria-label')).toBeTruthy();
    expect(left.getAttribute('aria-label')).not.toContain('ball');
    expect(right.getAttribute('aria-label')).not.toContain('ball');

    await act(async () => left.click());
    await flush();
    const surface = container.querySelector<HTMLElement>('.syllable-train-surface')!;
    expect(surface.dataset.reducedMotion).toBe('true');
    expect(surface.dataset.lit).toBe('true');
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
  });

  it('emits only allowlisted communication metrics and never completes clinical progress', async () => {
    const onMetrics = vi.fn();
    const onCompleteRound = vi.fn();
    await renderGame(createInitialSettings(), {
      onCommunicationMetrics: onMetrics,
      onCompleteRound,
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.syllable-train-car--left')!.click();
    });
    await flush();

    const latest = onMetrics.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(Object.keys(latest).sort()).toEqual([
      'dragCancellations',
      'mediaErrors',
      'performanceTimings',
      'recentContentIds',
      'sessions',
      'trainsConnected',
      'trainsSeen',
    ]);
    const serialized = JSON.stringify(latest).toLowerCase();
    for (const forbidden of [
      'attempt',
      'correct',
      'master',
      'accuracy',
      'articulation',
      'star',
      'method',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(onCompleteRound).not.toHaveBeenCalled();
  });
});
