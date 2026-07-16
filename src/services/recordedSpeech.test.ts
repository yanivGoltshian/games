import { describe, expect, it, vi } from 'vitest';
import {
  RecordedSpeechPlayer,
  shouldUseRecordedSpeech,
  type StandaloneSpeechEnvironment,
} from './recordedSpeech';

const iPadEnvironment: StandaloneSpeechEnvironment = {
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X)',
  platform: 'iPad',
  maxTouchPoints: 5,
  navigatorStandalone: true,
  displayModeStandalone: true,
};

class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  readonly connect = vi.fn();
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

function createContext() {
  const sources: FakeBufferSource[] = [];
  const decodeAudioData = vi.fn(async () => ({ duration: 10 }) as AudioBuffer);
  const context = {
    destination: {},
    createBufferSource: () => {
      const source = new FakeBufferSource();
      sources.push(source);
      return source;
    },
    createGain: () => ({
      gain: { value: 1 },
      connect: vi.fn(),
    }),
    decodeAudioData,
  } as unknown as AudioContext;
  return { context, sources, decodeAudioData };
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('recorded iPad speech', () => {
  it('requires both an Apple touch device and standalone display mode', () => {
    expect(shouldUseRecordedSpeech(iPadEnvironment)).toBe(true);
    expect(shouldUseRecordedSpeech({
      ...iPadEnvironment,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    })).toBe(true);
    expect(shouldUseRecordedSpeech({
      ...iPadEnvironment,
      navigatorStandalone: false,
      displayModeStandalone: false,
    })).toBe(false);
    expect(shouldUseRecordedSpeech({
      ...iPadEnvironment,
      userAgent: 'Mozilla/5.0 (Linux; Android 15)',
      platform: 'Linux armv8l',
    })).toBe(false);
  });

  it('unlocks the shared audio context and plays the exact manifest clip', async () => {
    const { context, sources, decodeAudioData } = createContext();
    const unlock = vi.fn(async () => undefined);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('manifest.json')) {
        return new Response(JSON.stringify({
          version: 1,
          entries: {
            'he-IL\u0000אוטו': { src: '/speech/he-IL.mp3', offset: 2.5, duration: 0.75 },
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
    const onStart = vi.fn();
    const playback = player.play({
      text: 'אוטו',
      locale: 'he-IL',
      volume: 0.65,
      onStart,
    });
    await flush();

    expect(unlock).toHaveBeenCalledOnce();
    expect(decodeAudioData).toHaveBeenCalledOnce();
    expect(sources).toHaveLength(1);
    expect(sources[0]?.start).toHaveBeenCalledWith(0, 2.5, 0.75);
    expect(onStart).toHaveBeenCalledOnce();

    sources[0]?.onended?.();
    await expect(playback).resolves.toBeUndefined();
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
