import { describe, expect, it, vi } from 'vitest';
import { createInitialSettings } from '../domain/progression';
import type {
  RecordedSpeechBackend,
  RecordedSpeechPlayOptions,
} from './recordedSpeech';
import { RecordedOnlySpeechBackend } from './recordedOnlySpeechBackend';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

class FakeRecordedSpeech implements RecordedSpeechBackend {
  readonly played: RecordedSpeechPlayOptions[] = [];
  readonly cancel = vi.fn();
  readonly unlock = vi.fn<() => Promise<void>>(async () => undefined);
  readonly isEnabled = vi.fn(() => false);
  playError: Error | null = null;
  playback = deferred<void>();

  play = vi.fn((options: RecordedSpeechPlayOptions): Promise<void> => {
    if (this.playError) {
      return Promise.reject(this.playError);
    }
    this.played.push(options);
    options.onStart();
    return this.playback.promise;
  });
}

const settings = createInitialSettings();
const options = {
  scope: 'interaction:counting:session:round:prompt-1',
  onStart: vi.fn(),
};

describe('RecordedOnlySpeechBackend', () => {
  it('plays one exact recorded sentence even when the platform fallback flag is disabled', async () => {
    const player = new FakeRecordedSpeech();
    const backend = new RecordedOnlySpeechBackend(player);
    const synthesisSpeak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak: synthesisSpeak });
    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn(() => {
      throw new Error('Runtime synthesis must never be constructed.');
    }));

    const playback = backend.speakSegments(
      [{
        text: 'The bus rests beside the flower.',
        recordedText: 'The bus rests beside the flower.',
        locale: 'en-GB',
      }],
      settings,
      options,
    );
    await Promise.resolve();

    expect(player.isEnabled).not.toHaveBeenCalled();
    expect(player.played).toEqual([
      expect.objectContaining({
        text: 'The bus rests beside the flower.',
        locale: 'en-GB',
      }),
    ]);
    expect(options.onStart).toHaveBeenCalledOnce();
    expect(synthesisSpeak).not.toHaveBeenCalled();

    player.playback.resolve(undefined);
    await expect(playback).resolves.toMatchObject({ status: 'completed' });
    vi.unstubAllGlobals();
  });

  it('fails closed when exact recorded text or the recorded backend is unavailable', async () => {
    const player = new FakeRecordedSpeech();
    const backend = new RecordedOnlySpeechBackend(player);

    await expect(backend.speakSegments(
      [{ text: 'display only', recordedText: null, locale: 'en-US' }],
      settings,
      options,
    )).resolves.toMatchObject({ status: 'unsupported' });
    expect(player.play).not.toHaveBeenCalled();

    player.playError = new Error('AudioContext is unavailable for recorded speech.');
    await expect(backend.speakSegments(
      [{ text: 'ball', recordedText: 'ball', locale: 'en-US' }],
      settings,
      options,
    )).resolves.toMatchObject({ status: 'unsupported' });

    player.playError = new Error('Recorded speech is missing for en-US: ball');
    await expect(backend.speakSegments(
      [{ text: 'ball', recordedText: 'ball', locale: 'en-US' }],
      settings,
      options,
    )).resolves.toMatchObject({ status: 'error' });
  });

  it('cancels during deferred unlock without starting stale recorded playback', async () => {
    const unlock = deferred<void>();
    const player = new FakeRecordedSpeech();
    player.unlock.mockImplementationOnce(() => unlock.promise);
    const backend = new RecordedOnlySpeechBackend(player);
    const playback = backend.speakSegments(
      [{ text: 'ball', recordedText: 'ball', locale: 'en-US' }],
      settings,
      options,
    );

    backend.cancelScope(options.scope, 'visibility');
    unlock.resolve(undefined);

    await expect(playback).resolves.toMatchObject({ status: 'cancelled' });
    expect(player.cancel).toHaveBeenCalledOnce();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('exposes a gesture-bound unlock without routing through generic speech', () => {
    const player = new FakeRecordedSpeech();
    const backend = new RecordedOnlySpeechBackend(player);

    backend.unlock();

    expect(player.unlock).toHaveBeenCalledOnce();
  });
});
