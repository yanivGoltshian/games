import { describe, expect, it, vi } from 'vitest';
import {
  RecordedSpeechPlayer,
  shouldUseRecordedSpeech,
  type RecordedSpeechEnvironment,
} from './recordedSpeech';

const installedIPadEnvironment: RecordedSpeechEnvironment = {
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  platform: 'iPad',
  maxTouchPoints: 5,
  navigatorStandalone: true,
  displayModeStandalone: true,
};

class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  playbackRate = { value: 1 };
  readonly connect = vi.fn();
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

function createContext() {
  const sources: FakeBufferSource[] = [];
  const decodeAudioData = vi.fn(async () => ({ duration: 10 }) as AudioBuffer);
  const createBufferSource = vi.fn(() => {
    const source = new FakeBufferSource();
    sources.push(source);
    return source;
  });
  const context = {
    currentTime: 12,
    destination: {},
    createBufferSource,
    createGain: () => ({
      gain: { value: 1 },
      connect: vi.fn(),
    }),
    decodeAudioData,
  } as unknown as AudioContext;
  return { context, sources, createBufferSource, decodeAudioData };
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('recorded iPad speech', () => {
  it('routes every Apple mobile context through recorded speech, not just standalone', () => {
    // iPad Safari, a normal browser tab (not installed / not standalone).
    expect(shouldUseRecordedSpeech({
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1',
      platform: 'iPad',
      maxTouchPoints: 5,
      navigatorStandalone: false,
      displayModeStandalone: false,
    })).toBe(true);

    // iPad Chrome (CriOS) tab — also WebKit under the hood.
    expect(shouldUseRecordedSpeech({
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
      platform: 'iPad',
      maxTouchPoints: 5,
      navigatorStandalone: false,
      displayModeStandalone: false,
    })).toBe(true);

    // Installed iPad PWA (standalone).
    expect(shouldUseRecordedSpeech(installedIPadEnvironment)).toBe(true);

    // iPadOS 13+ desktop-class Safari reporting as MacIntel with touch.
    expect(shouldUseRecordedSpeech({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
      navigatorStandalone: false,
      displayModeStandalone: false,
    })).toBe(true);

    // iPhone browser tab.
    expect(shouldUseRecordedSpeech({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
      navigatorStandalone: false,
      displayModeStandalone: false,
    })).toBe(true);

    // Android stays on Web Speech.
    expect(shouldUseRecordedSpeech({
      userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
      navigatorStandalone: false,
      displayModeStandalone: false,
    })).toBe(false);

    // Touchless desktop Mac stays on Web Speech.
    expect(shouldUseRecordedSpeech({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.7 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      navigatorStandalone: false,
      displayModeStandalone: false,
    })).toBe(false);
  });

  it('unlocks only the shared context and lazily loads the requested locale', async () => {
    const { context, sources, decodeAudioData } = createContext();
    const unlock = vi.fn(async () => undefined);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'he-IL\u0000אוטו': { src: '/speech/he-IL.mp3', offset: 2.5, duration: 0.75 },
            'en-US\u0000car': { src: '/speech/en-US.mp3', offset: 4, duration: 0.6 },
            'en-GB\u0000car': { src: '/speech/en-GB.mp3', offset: 5, duration: 0.65 },
          },
        }));
      }
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      unlock,
      fetcher,
      () => true,
    );

    await player.unlock();
    expect(fetcher).not.toHaveBeenCalled();
    expect(decodeAudioData).not.toHaveBeenCalled();

    const onStart = vi.fn();
    const playback = player.play({
      text: 'אוטו',
      locale: 'he-IL',
      volume: 0.65,
      onStart,
    });
    await vi.waitFor(() => {
      expect(sources).toHaveLength(1);
    });

    expect(unlock).toHaveBeenCalledOnce();
    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      '/speech/manifest.json',
      '/speech/he-IL.mp3',
    ]);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.start).toHaveBeenCalledWith(0, 2.5, 0.75);
    expect(onStart).toHaveBeenCalledOnce();

    sources[0]?.onended?.();
    await expect(playback).resolves.toBeUndefined();
  });

  it('deduplicates concurrent decodes for clips in the same locale', async () => {
    const { context, sources, decodeAudioData } = createContext();
    let releaseAudio: ((value: ArrayBuffer) => void) | undefined;
    const audio = new Promise<ArrayBuffer>((resolve) => {
      releaseAudio = resolve;
    });
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'he-IL\u0000אוטו': { src: '/speech/he-IL.mp3', offset: 2.5, duration: 0.75 },
            'he-IL\u0000כלב': { src: '/speech/he-IL.mp3', offset: 8, duration: 0.7 },
          },
        }));
      }
      return {
        ok: true,
        arrayBuffer: () => audio,
      } as Response;
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );

    const car = player.play({
      text: 'אוטו',
      locale: 'he-IL',
      volume: 1,
      onStart: vi.fn(),
    });
    const dog = player.play({
      text: 'כלב',
      locale: 'he-IL',
      volume: 1,
      onStart: vi.fn(),
    });
    await flush();
    releaseAudio?.(new ArrayBuffer(3));
    await vi.waitFor(() => {
      expect(sources).toHaveLength(2);
    });

    expect(fetcher.mock.calls.filter(([input]) => String(input) === '/speech/he-IL.mp3')).toHaveLength(1);
    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(sources).toHaveLength(2);
    sources.forEach((source) => source.onended?.());
    await expect(Promise.all([car, dog])).resolves.toEqual([undefined, undefined]);
  });

  it('stretches only the recorded opening before continuing at normal speed', async () => {
    const { context, sources } = createContext();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'he-IL\u0000כלב': { src: '/speech/he-IL.mp3', offset: 8, duration: 0.7 },
          },
        }));
      }
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );
    const onStart = vi.fn();

    const playback = player.play({
      text: 'כלב',
      locale: 'he-IL',
      volume: 1,
      onStart,
      stretch: { leadSeconds: 0.18, playbackRate: 0.34 },
    });
    await vi.waitFor(() => {
      expect(sources).toHaveLength(2);
    });

    expect(sources[0]?.playbackRate.value).toBe(0.34);
    expect(sources[0]?.start).toHaveBeenCalledWith(12, 8, 0.18);
    expect(sources[1]?.playbackRate.value).toBe(1);
    expect(sources[1]?.start.mock.calls[0]?.[0]).toBeCloseTo(12 + 0.18 / 0.34);
    expect(sources[1]?.start).toHaveBeenCalledWith(
      expect.any(Number),
      8.18,
      0.52,
    );
    expect(onStart).toHaveBeenCalledOnce();

    sources[0]?.onended?.();
    let settled = false;
    void playback.then(() => {
      settled = true;
    });
    await flush();
    expect(settled).toBe(false);

    sources[1]?.onended?.();
    await expect(playback).resolves.toBeUndefined();
  });

  it('stops both scheduled sources when stretched playback is cancelled', async () => {
    const { context, sources } = createContext();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'en-US\u0000dog': { src: '/speech/en-US.mp3', offset: 3, duration: 0.6 },
          },
        }));
      }
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );

    const playback = player.play({
      text: 'dog',
      locale: 'en-US',
      volume: 1,
      onStart: vi.fn(),
      stretch: { leadSeconds: 0.16, playbackRate: 0.4 },
    });
    await vi.waitFor(() => {
      expect(sources).toHaveLength(2);
    });

    player.cancel();
    expect(sources[0]?.stop).toHaveBeenCalledOnce();
    expect(sources[1]?.stop).toHaveBeenCalledOnce();
    await expect(playback).resolves.toBeUndefined();
  });

  it('only stops sources that started when stretched scheduling fails', async () => {
    const { context, sources, createBufferSource } = createContext();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'en-US\u0000dog': { src: '/speech/en-US.mp3', offset: 3, duration: 0.6 },
          },
        }));
      }
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );
    const schedulingError = new Error('Unable to schedule trailing audio.');
    createBufferSource
      .mockImplementationOnce(() => {
        const source = new FakeBufferSource();
        sources.push(source);
        return source;
      })
      .mockImplementationOnce(() => {
        const source = new FakeBufferSource();
        source.start.mockImplementationOnce(() => {
          throw schedulingError;
        });
        sources.push(source);
        return source;
      });
    const playback = player.play({
      text: 'dog',
      locale: 'en-US',
      volume: 1,
      onStart: vi.fn(),
      stretch: { leadSeconds: 0.16, playbackRate: 0.4 },
    });
    await expect(playback).rejects.toBe(schedulingError);
    expect(sources[0]?.stop).toHaveBeenCalledOnce();
    expect(sources[1]?.stop).not.toHaveBeenCalled();
  });

  it('reuses an active same-locale decode after its original caller is cancelled', async () => {
    const { context, sources, decodeAudioData } = createContext();
    let releaseDecode: ((value: AudioBuffer) => void) | undefined;
    const decode = new Promise<AudioBuffer>((resolve) => {
      releaseDecode = resolve;
    });
    decodeAudioData.mockImplementationOnce(() => decode);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'en-US\u0000car': { src: '/speech/en-US.mp3', offset: 4, duration: 0.6 },
            'en-US\u0000dog': { src: '/speech/en-US.mp3', offset: 8, duration: 0.7 },
          },
        }));
      }
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );

    const car = player.play({
      text: 'car',
      locale: 'en-US',
      volume: 1,
      onStart: vi.fn(),
    });
    await vi.waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledOnce();
    });
    player.cancel();
    const dog = player.play({
      text: 'dog',
      locale: 'en-US',
      volume: 1,
      onStart: vi.fn(),
    });
    await flush();

    expect(fetcher.mock.calls.filter(([input]) => String(input) === '/speech/en-US.mp3')).toHaveLength(1);
    expect(decodeAudioData).toHaveBeenCalledOnce();

    releaseDecode?.({ duration: 10 } as AudioBuffer);
    await expect(car).resolves.toBeUndefined();
    await vi.waitFor(() => {
      expect(sources).toHaveLength(1);
    });
    sources[0]?.onended?.();
    await expect(dog).resolves.toBeUndefined();
  });

  it('evicts the previous locale buffer when the requested locale changes', async () => {
    const { context, sources, decodeAudioData } = createContext();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'he-IL\u0000אוטו': { src: '/speech/he-IL.mp3', offset: 2.5, duration: 0.75 },
            'en-US\u0000car': { src: '/speech/en-US.mp3', offset: 4, duration: 0.6 },
          },
        }));
      }
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );

    const playAndFinish = async (text: string, locale: 'he-IL' | 'en-US') => {
      const expectedSourceCount = sources.length + 1;
      const playback = player.play({ text, locale, volume: 1, onStart: vi.fn() });
      await vi.waitFor(() => {
        expect(sources).toHaveLength(expectedSourceCount);
      });
      sources.at(-1)?.onended?.();
      await playback;
    };

    await playAndFinish('אוטו', 'he-IL');
    await playAndFinish('car', 'en-US');
    await playAndFinish('אוטו', 'he-IL');

    expect(decodeAudioData).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      '/speech/manifest.json',
      '/speech/he-IL.mp3',
      '/speech/en-US.mp3',
      '/speech/he-IL.mp3',
    ]);
  });

  it('serializes a locale switch while a cancelled decode is still pending', async () => {
    const { context, sources, decodeAudioData } = createContext();
    let releaseFirstDecode: ((value: AudioBuffer) => void) | undefined;
    const firstDecode = new Promise<AudioBuffer>((resolve) => {
      releaseFirstDecode = resolve;
    });
    let activeDecodes = 0;
    let maximumActiveDecodes = 0;
    decodeAudioData
      .mockImplementationOnce(async () => {
        activeDecodes += 1;
        maximumActiveDecodes = Math.max(maximumActiveDecodes, activeDecodes);
        const buffer = await firstDecode;
        activeDecodes -= 1;
        return buffer;
      })
      .mockImplementationOnce(async () => {
        activeDecodes += 1;
        maximumActiveDecodes = Math.max(maximumActiveDecodes, activeDecodes);
        activeDecodes -= 1;
        return { duration: 10 } as AudioBuffer;
      });
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'he-IL\u0000אוטו': { src: '/speech/he-IL.mp3', offset: 2.5, duration: 0.75 },
            'en-US\u0000car': { src: '/speech/en-US.mp3', offset: 4, duration: 0.6 },
          },
        }));
      }
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );

    const hebrew = player.play({
      text: 'אוטו',
      locale: 'he-IL',
      volume: 1,
      onStart: vi.fn(),
    });
    await vi.waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledOnce();
    });
    player.cancel();
    const english = player.play({
      text: 'car',
      locale: 'en-US',
      volume: 1,
      onStart: vi.fn(),
    });
    await flush();

    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.some(([input]) => String(input) === '/speech/en-US.mp3')).toBe(false);

    releaseFirstDecode?.({ duration: 10 } as AudioBuffer);
    await expect(hebrew).resolves.toBeUndefined();
    await vi.waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledTimes(2);
      expect(sources).toHaveLength(1);
    });

    expect(maximumActiveDecodes).toBe(1);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      '/speech/manifest.json',
      '/speech/he-IL.mp3',
      '/speech/en-US.mp3',
    ]);
    sources[0]?.onended?.();
    await expect(english).resolves.toBeUndefined();
  });

  it('skips a superseded queued locale before loading the latest locale', async () => {
    const { context, sources, decodeAudioData } = createContext();
    let releaseFirstDecode: ((value: AudioBuffer) => void) | undefined;
    const firstDecode = new Promise<AudioBuffer>((resolve) => {
      releaseFirstDecode = resolve;
    });
    const events: string[] = [];
    let activeDecodes = 0;
    let maximumActiveDecodes = 0;
    decodeAudioData
      .mockImplementationOnce(async () => {
        activeDecodes += 1;
        maximumActiveDecodes = Math.max(maximumActiveDecodes, activeDecodes);
        events.push('decode:he-IL:start');
        const buffer = await firstDecode;
        events.push('decode:he-IL:end');
        activeDecodes -= 1;
        return buffer;
      })
      .mockImplementationOnce(async () => {
        activeDecodes += 1;
        maximumActiveDecodes = Math.max(maximumActiveDecodes, activeDecodes);
        events.push('decode:en-US:start');
        activeDecodes -= 1;
        return { duration: 10 } as AudioBuffer;
      });
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'he-IL\u0000אוטו': { src: '/speech/he-IL.mp3', offset: 2.5, duration: 0.75 },
            'en-GB\u0000car': { src: '/speech/en-GB.mp3', offset: 5, duration: 0.65 },
            'en-US\u0000car': { src: '/speech/en-US.mp3', offset: 4, duration: 0.6 },
          },
        }));
      }
      events.push(`fetch:${url}`);
      return new Response(new Uint8Array([1, 2, 3]));
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );

    const hebrew = player.play({
      text: 'אוטו',
      locale: 'he-IL',
      volume: 1,
      onStart: vi.fn(),
    });
    await vi.waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledOnce();
    });

    player.cancel();
    const british = player.play({
      text: 'car',
      locale: 'en-GB',
      volume: 1,
      onStart: vi.fn(),
    });
    await flush();
    player.cancel();
    const american = player.play({
      text: 'car',
      locale: 'en-US',
      volume: 1,
      onStart: vi.fn(),
    });
    await flush();

    expect(events).toEqual([
      'fetch:/speech/he-IL.mp3',
      'decode:he-IL:start',
    ]);

    releaseFirstDecode?.({ duration: 10 } as AudioBuffer);
    await expect(Promise.all([hebrew, british])).resolves.toEqual([undefined, undefined]);
    await vi.waitFor(() => {
      expect(decodeAudioData).toHaveBeenCalledTimes(2);
      expect(sources).toHaveLength(1);
    });

    expect(maximumActiveDecodes).toBe(1);
    expect(events).toEqual([
      'fetch:/speech/he-IL.mp3',
      'decode:he-IL:start',
      'decode:he-IL:end',
      'fetch:/speech/en-US.mp3',
      'decode:en-US:start',
    ]);
    expect(fetcher.mock.calls.some(([input]) => String(input) === '/speech/en-GB.mp3')).toBe(false);

    sources[0]?.onended?.();
    await expect(american).resolves.toBeUndefined();
  });

  it('surfaces audio loading failures and allows a later retry', async () => {
    const { context, sources, decodeAudioData } = createContext();
    let audioAttempt = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'en-US\u0000car': { src: '/speech/en-US.mp3', offset: 0, duration: 0.5 },
          },
        }));
      }
      audioAttempt += 1;
      return audioAttempt === 1
        ? new Response(null, { status: 503 })
        : new Response(new Uint8Array([1, 2, 3]));
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );
    const options = {
      text: 'car',
      locale: 'en-US' as const,
      volume: 1,
      onStart: vi.fn(),
    };

    await expect(player.play(options)).rejects.toThrow(
      'Recorded speech audio failed with HTTP 503.',
    );
    expect(decodeAudioData).not.toHaveBeenCalled();

    const retry = player.play(options);
    await vi.waitFor(() => {
      expect(sources).toHaveLength(1);
    });
    sources[0]?.onended?.();
    await expect(retry).resolves.toBeUndefined();
    expect(audioAttempt).toBe(2);
    expect(decodeAudioData).toHaveBeenCalledOnce();
  });

  it('does not start a pending clip after cancellation', async () => {
    const { context, sources } = createContext();
    let releaseAudio: ((value: ArrayBuffer) => void) | undefined;
    const audio = new Promise<ArrayBuffer>((resolve) => {
      releaseAudio = resolve;
    });
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'en-US\u0000car': { src: '/speech/en-US.mp3', offset: 0, duration: 0.5 },
          },
        }));
      }
      return {
        ok: true,
        arrayBuffer: () => audio,
      } as Response;
    });
    const player = new RecordedSpeechPlayer(
      () => context,
      async () => undefined,
      fetcher,
      () => true,
    );
    const playback = player.play({
      text: 'car',
      locale: 'en-US',
      volume: 1,
      onStart: vi.fn(),
    });
    await flush();

    player.cancel();
    releaseAudio?.(new ArrayBuffer(1));
    await expect(playback).resolves.toBeUndefined();
    expect(sources).toHaveLength(0);
  });
});
