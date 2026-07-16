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
