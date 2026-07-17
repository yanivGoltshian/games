// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAudioContextCtor,
  microphoneSupported,
  useMicEffort,
  type MicEffortController,
} from './useMicEffort';

type SampleSpy = ReturnType<typeof vi.fn>;

function Harness({
  onReady,
  onSample,
}: {
  onReady: (controller: MicEffortController) => void;
  onSample: (level: number, deltaMs: number) => void;
}) {
  const mic = useMicEffort(onSample);
  useEffect(() => {
    onReady(mic);
  });
  return null;
}

describe('useMicEffort helpers', () => {
  it('reports no support in a bare jsdom environment', () => {
    expect(getAudioContextCtor()).toBeNull();
    expect(microphoneSupported()).toBe(false);
  });
});

describe('useMicEffort hook', () => {
  let container: HTMLDivElement;
  let root: Root;
  let controller: MicEffortController | null;
  let sampleSpy: SampleSpy;
  const trackStop = vi.fn();
  const contextClose = vi.fn().mockResolvedValue(undefined);
  let rafCallback: FrameRequestCallback | null;

  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    controller = null;
    sampleSpy = vi.fn();
    trackStop.mockClear();
    contextClose.mockClear();
    rafCallback = null;

    const fakeStream = {
      getTracks: () => [{ stop: trackStop }],
    } as unknown as MediaStream;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
    });

    class FakeAudioContext {
      state = 'running';
      resume = vi.fn().mockResolvedValue(undefined);
      close = contextClose;
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
      createAnalyser = vi.fn(() => ({
        fftSize: 1024,
        smoothingTimeConstant: 0,
        connect: vi.fn(),
        // Fill the waveform with a loud, off-centre value so RMS is high.
        getByteTimeDomainData: (array: Uint8Array) => array.fill(230),
      }));
    }
    (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;

    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn() as typeof cancelAnimationFrame;

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  async function mount() {
    await act(async () => {
      root.render(<Harness onReady={(c) => (controller = c)} onSample={sampleSpy} />);
    });
  }

  it('opens the mic and streams normalised effort samples', async () => {
    await mount();
    expect(controller?.supported).toBe(true);

    let started = false;
    await act(async () => {
      started = await controller!.start();
    });
    expect(started).toBe(true);

    // Drive one animation frame; the loud waveform should yield a clamped level.
    await act(async () => {
      rafCallback?.(16);
    });

    expect(sampleSpy).toHaveBeenCalledTimes(1);
    const [level, deltaMs] = sampleSpy.mock.calls[0]!;
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThanOrEqual(1);
    expect(typeof deltaMs).toBe('number');
  });

  it('tears down the stream and context on stop', async () => {
    await mount();
    await act(async () => {
      await controller!.start();
    });

    await act(async () => {
      controller!.stop();
    });

    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(contextClose).toHaveBeenCalledTimes(1);
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
  });
});
