import { describe, expect, it, vi } from 'vitest';
import { createInitialSettings } from '../domain/progression';
import type {
  RecordedSpeechBackend,
  RecordedSpeechPlayOptions,
} from '../services/recordedSpeech';
import {
  RecordedOnlyWordTrainSpeechBackend,
} from './wordTrainMedia';

class FakeRecordedSpeech implements RecordedSpeechBackend {
  readonly played: RecordedSpeechPlayOptions[] = [];
  readonly cancel = vi.fn();
  resolve: (() => void) | null = null;

  isEnabled = () => true;
  unlock = async () => undefined;
  play = (options: RecordedSpeechPlayOptions): Promise<void> => {
    this.played.push(options);
    options.onStart();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  };
}

describe('recorded-only Word Train media', () => {
  it('plays one exact-locale complete recording without a synthesis route', async () => {
    const player = new FakeRecordedSpeech();
    const backend = new RecordedOnlyWordTrainSpeechBackend(player);
    const onStart = vi.fn();
    const playback = backend.speakSegments(
      [{ text: 'ball', recordedText: 'ball', locale: 'en-GB' }],
      createInitialSettings(),
      { scope: 'word-train', onStart },
    );

    expect(player.played).toHaveLength(1);
    expect(player.played[0]).toMatchObject({
      text: 'ball',
      locale: 'en-GB',
    });
    expect(onStart).toHaveBeenCalledOnce();
    player.resolve?.();
    await expect(playback).resolves.toMatchObject({ status: 'completed' });
  });

  it('rejects multi-part playback and reports active cancellation', async () => {
    const player = new FakeRecordedSpeech();
    const backend = new RecordedOnlyWordTrainSpeechBackend(player);
    await expect(backend.speakSegments(
      [
        { text: 'b', locale: 'en-US' },
        { text: 'all', locale: 'en-US' },
      ],
      createInitialSettings(),
      { scope: 'word-train' },
    )).resolves.toMatchObject({ status: 'error' });
    expect(player.played).toHaveLength(0);

    const playback = backend.speakSegments(
      [{ text: 'ball', locale: 'en-US' }],
      createInitialSettings(),
      { scope: 'word-train' },
    );
    backend.cancelScope('word-train');
    expect(player.cancel).toHaveBeenCalledOnce();
    player.resolve?.();
    await expect(playback).resolves.toMatchObject({ status: 'cancelled' });
  });
});
