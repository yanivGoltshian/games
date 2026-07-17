// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StrictMode, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MicrophonePlaybackGuard } from '../services/microphonePlaybackGuard';
import {
  GenerationTokenController,
  type GenerationToken,
} from './useGenerationToken';
import {
  getAudioContextCtor,
  microphoneSupported,
  useMicEffort,
  type MicEffortController,
  type MicEffortOptions,
} from './useMicEffort';

type SampleSpy = ReturnType<typeof vi.fn>;

function Harness({
  onReady,
  onSample,
  options,
}: {
  onReady: (controller: MicEffortController) => void;
  onSample: (level: 0 | 1, deltaMs: number) => void;
  options: MicEffortOptions;
}) {
  const mic = useMicEffort(onSample, options);
  useEffect(() => {
    onReady(mic);
  });
  return null;
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function streamWithTrack(stop = vi.fn()): MediaStream {
  return {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
}

describe('useMicEffort helpers', () => {
  it('reports no support in a bare environment', () => {
    const previous = globalThis.AudioContext;
    Reflect.deleteProperty(globalThis, 'AudioContext');
    expect(getAudioContextCtor()).toBeNull();
    expect(microphoneSupported()).toBe(false);
    globalThis.AudioContext = previous;
  });
});

describe('useMicEffort hook', () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;
  let controller: MicEffortController | null;
  let sampleSpy: SampleSpy;
  let rafCallback: FrameRequestCallback | null;
  let getUserMedia: ReturnType<typeof vi.fn>;
  let contextClose: ReturnType<typeof vi.fn>;
  let sourceDisconnect: ReturnType<typeof vi.fn>;
  let analyserDisconnect: ReturnType<typeof vi.fn>;
  let contextConstructed: ReturnType<typeof vi.fn>;
  let defaultTrackStop: ReturnType<typeof vi.fn>;
  let defaultGuard: MicrophonePlaybackGuard;

  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    controller = null;
    sampleSpy = vi.fn();
    rafCallback = null;
    contextClose = vi.fn().mockResolvedValue(undefined);
    sourceDisconnect = vi.fn();
    analyserDisconnect = vi.fn();
    contextConstructed = vi.fn();
    defaultTrackStop = vi.fn();
    defaultGuard = new MicrophonePlaybackGuard();
    getUserMedia = vi.fn().mockResolvedValue(streamWithTrack(defaultTrackStop));

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const construct = contextConstructed;
    const close = contextClose;
    const disconnectSource = sourceDisconnect;
    const disconnectAnalyser = analyserDisconnect;
    class FakeAudioContext {
      state = 'running';
      resume = vi.fn().mockResolvedValue(undefined);
      close = close;
      createMediaStreamSource = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: disconnectSource,
      }));
      createAnalyser = vi.fn(() => ({
        fftSize: 1024,
        smoothingTimeConstant: 0,
        connect: vi.fn(),
        disconnect: disconnectAnalyser,
        getByteTimeDomainData: (array: Uint8Array) => array.fill(230),
      }));

      constructor() {
        construct();
      }
    }
    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;

    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn() as typeof cancelAnimationFrame;

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = true;
  });

  afterEach(async () => {
    if (mounted) {
      await act(async () => root.unmount());
    }
    container.remove();
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    Reflect.deleteProperty(globalThis, 'AudioContext');
    Reflect.deleteProperty(navigator, 'mediaDevices');
    vi.restoreAllMocks();
  });

  async function render(
    options: MicEffortOptions = { playbackGuard: defaultGuard },
    strictMode = false,
  ) {
    const harness = (
      <Harness
        onReady={(next) => {
          controller = next;
        }}
        onSample={sampleSpy}
        options={options}
      />
    );
    await act(async () => {
      root.render(strictMode ? <StrictMode>{harness}</StrictMode> : harness);
    });
  }

  async function rerender(options: MicEffortOptions) {
    await render(options);
  }

  function installDeferredAudioContexts(resumes: readonly ReturnType<typeof deferred<void>>[]) {
    const contexts: Array<{
      close: ReturnType<typeof vi.fn>;
      resume: ReturnType<typeof vi.fn>;
      sourceDisconnect: ReturnType<typeof vi.fn>;
      analyserDisconnect: ReturnType<typeof vi.fn>;
    }> = [];

    class DeferredAudioContext {
      state: AudioContextState = 'suspended';
      readonly close: ReturnType<typeof vi.fn>;
      readonly resume: ReturnType<typeof vi.fn>;
      readonly createMediaStreamSource: ReturnType<typeof vi.fn>;
      readonly createAnalyser: ReturnType<typeof vi.fn>;

      constructor() {
        const resume = resumes[contexts.length];
        if (!resume) {
          throw new Error('Missing deferred resume control');
        }
        const controls = {
          close: vi.fn().mockResolvedValue(undefined),
          resume: vi.fn(() => resume.promise),
          sourceDisconnect: vi.fn(),
          analyserDisconnect: vi.fn(),
        };
        contexts.push(controls);
        this.close = controls.close;
        this.resume = controls.resume;
        this.createMediaStreamSource = vi.fn(() => ({
          connect: vi.fn(),
          disconnect: controls.sourceDisconnect,
        }));
        this.createAnalyser = vi.fn(() => ({
          fftSize: 1024,
          smoothingTimeConstant: 0,
          connect: vi.fn(),
          disconnect: controls.analyserDisconnect,
          getByteTimeDomainData: (array: Uint8Array) => array.fill(128),
        }));
      }
    }

    globalThis.AudioContext = DeferredAudioContext as unknown as typeof AudioContext;
    return contexts;
  }

  it('opens the mic and emits only coarse binary effort', async () => {
    await render();
    let outcome;
    await act(async () => {
      outcome = await controller!.start();
    });
    expect(outcome).toEqual({ status: 'started' });

    await act(async () => {
      rafCallback?.(16);
    });

    expect(sampleSpy).toHaveBeenCalledTimes(1);
    expect(sampleSpy.mock.calls[0]?.[0]).toBe(1);
    expect(typeof sampleSpy.mock.calls[0]?.[1]).toBe('number');
  });

  it('returns typed unsupported and permission denial outcomes', async () => {
    Reflect.deleteProperty(globalThis, 'AudioContext');
    await render();
    await expect(controller!.start()).resolves.toEqual({ status: 'unsupported' });

    globalThis.AudioContext = class {} as unknown as typeof AudioContext;
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    await rerender({ playbackGuard: defaultGuard });
    await expect(controller!.start()).resolves.toEqual({ status: 'permission-denied' });
  });

  it('tears down the stream, graph, and context on stop', async () => {
    await render();
    await act(async () => {
      await controller!.start();
      controller!.stop();
    });

    expect(defaultTrackStop).toHaveBeenCalledOnce();
    expect(sourceDisconnect).toHaveBeenCalledOnce();
    expect(analyserDisconnect).toHaveBeenCalledOnce();
    expect(contextClose).toHaveBeenCalledOnce();
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('stops a stream that arrives after explicit cancellation and never retains it', async () => {
    const latePermission = deferred<MediaStream>();
    const lateStop = vi.fn();
    getUserMedia.mockReturnValueOnce(latePermission.promise);
    await render();

    const start = controller!.start();
    controller!.stop();
    latePermission.resolve(streamWithTrack(lateStop));

    await expect(start).resolves.toEqual({ status: 'cancelled' });
    expect(lateStop).toHaveBeenCalledOnce();
    expect(contextConstructed).not.toHaveBeenCalled();
  });

  it.each([
    ['normally', false],
    ['after StrictMode effect replay', true],
  ])('keeps a newer acquisition alive when an older resume rejects %s', async (_label, strictMode) => {
    const firstResume = deferred<void>();
    const secondResume = deferred<void>();
    const contexts = installDeferredAudioContexts([firstResume, secondResume]);
    const firstTrackStop = vi.fn();
    const secondTrackStop = vi.fn();
    getUserMedia
      .mockResolvedValueOnce(streamWithTrack(firstTrackStop))
      .mockResolvedValueOnce(streamWithTrack(secondTrackStop));
    await render({ playbackGuard: defaultGuard }, strictMode);

    const firstStart = controller!.start();
    await act(async () => {
      await Promise.resolve();
    });
    expect(contexts).toHaveLength(1);

    const secondStart = controller!.start();
    await act(async () => {
      await Promise.resolve();
    });
    expect(contexts).toHaveLength(2);
    expect(contexts[0]!.close).toHaveBeenCalledOnce();
    expect(firstTrackStop).toHaveBeenCalledOnce();

    secondResume.resolve(undefined);
    await expect(secondStart).resolves.toEqual({ status: 'started' });
    firstResume.reject(new DOMException('stale resume', 'AbortError'));
    await expect(firstStart).resolves.toEqual({ status: 'cancelled' });

    expect(contexts[1]!.close).not.toHaveBeenCalled();
    expect(contexts[1]!.sourceDisconnect).not.toHaveBeenCalled();
    expect(contexts[1]!.analyserDisconnect).not.toHaveBeenCalled();
    expect(secondTrackStop).not.toHaveBeenCalled();
  });

  it('cancellation releases only the acquisition whose identity still matches', async () => {
    const firstResume = deferred<void>();
    const secondResume = deferred<void>();
    const contexts = installDeferredAudioContexts([firstResume, secondResume]);
    const firstTrackStop = vi.fn();
    const secondTrackStop = vi.fn();
    getUserMedia
      .mockResolvedValueOnce(streamWithTrack(firstTrackStop))
      .mockResolvedValueOnce(streamWithTrack(secondTrackStop));
    await render();

    const firstStart = controller!.start();
    await act(async () => {
      await Promise.resolve();
    });
    const secondStart = controller!.start();
    await act(async () => {
      await Promise.resolve();
    });

    expect(contexts[0]!.close).toHaveBeenCalledOnce();
    expect(firstTrackStop).toHaveBeenCalledOnce();
    expect(contexts[1]!.close).not.toHaveBeenCalled();
    expect(secondTrackStop).not.toHaveBeenCalled();

    controller!.stop();
    expect(contexts[0]!.close).toHaveBeenCalledOnce();
    expect(firstTrackStop).toHaveBeenCalledOnce();
    expect(contexts[1]!.close).toHaveBeenCalledOnce();
    expect(secondTrackStop).toHaveBeenCalledOnce();

    firstResume.reject(new DOMException('cancelled first', 'AbortError'));
    secondResume.reject(new DOMException('cancelled second', 'AbortError'));
    await expect(firstStart).resolves.toEqual({ status: 'cancelled' });
    await expect(secondStart).resolves.toEqual({ status: 'cancelled' });
    expect(contexts[0]!.close).toHaveBeenCalledOnce();
    expect(contexts[1]!.close).toHaveBeenCalledOnce();
  });

  it('stops a late permission stream after unmount', async () => {
    const latePermission = deferred<MediaStream>();
    const lateStop = vi.fn();
    getUserMedia.mockReturnValueOnce(latePermission.promise);
    await render();

    const start = controller!.start();
    await act(async () => root.unmount());
    mounted = false;
    latePermission.resolve(streamWithTrack(lateStop));

    await expect(start).resolves.toEqual({ status: 'cancelled' });
    expect(lateStop).toHaveBeenCalledOnce();
  });

  it('closes active resources on background and never reopens on foreground', async () => {
    await render();
    await controller!.start();
    expect(getUserMedia).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event('pagehide'));
    expect(defaultTrackStop).toHaveBeenCalledOnce();
    expect(contextClose).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event('pageshow'));
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('closes a late permission stream on background', async () => {
    const latePermission = deferred<MediaStream>();
    const lateStop = vi.fn();
    getUserMedia.mockReturnValueOnce(latePermission.promise);
    await render();

    const start = controller!.start();
    window.dispatchEvent(new Event('pagehide'));
    latePermission.resolve(streamWithTrack(lateStop));

    await expect(start).resolves.toEqual({ status: 'background' });
    expect(lateStop).toHaveBeenCalledOnce();
  });

  it('rejects a stale generation token and cleans up late permission', async () => {
    const tokenController = new GenerationTokenController();
    const tokenOne = tokenController.issue({
      activityId: 'phone',
      sessionId: 'session-1',
      roundId: 'round-1',
      stepId: 'step-1',
    });
    const latePermission = deferred<MediaStream>();
    const lateStop = vi.fn();
    getUserMedia.mockReturnValueOnce(latePermission.promise);
    await render({
      playbackGuard: defaultGuard,
      generation: { token: tokenOne, isCurrent: (token) => tokenController.isCurrent(token) },
    });

    const start = controller!.start();
    const tokenTwo: GenerationToken = tokenController.issue({
      ...tokenOne.scope,
      stepId: 'step-2',
    });
    await rerender({
      playbackGuard: defaultGuard,
      generation: { token: tokenTwo, isCurrent: (token) => tokenController.isCurrent(token) },
    });
    latePermission.resolve(streamWithTrack(lateStop));

    await expect(start).resolves.toEqual({ status: 'cancelled' });
    expect(lateStop).toHaveBeenCalledOnce();
  });

  it('stays closed during playback and until 400 ms after true completion', async () => {
    let now = 10_000;
    const guard = new MicrophonePlaybackGuard(400, () => now);
    await render({ playbackGuard: guard });

    guard.beginPlayback('speech-1');
    await expect(controller!.start()).resolves.toEqual({ status: 'playback-guarded' });
    expect(getUserMedia).not.toHaveBeenCalled();

    guard.settlePlayback('speech-1', 'completed');
    now += 399;
    await expect(controller!.start()).resolves.toEqual({ status: 'playback-guarded' });
    expect(getUserMedia).not.toHaveBeenCalled();

    now += 1;
    await expect(controller!.start()).resolves.toEqual({ status: 'started' });
    expect(getUserMedia).toHaveBeenCalledOnce();
  });
});
