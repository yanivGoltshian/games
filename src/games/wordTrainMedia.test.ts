import { describe, expect, it, vi } from 'vitest';
import {
  createCommunicationLocaleLock,
  type CommunicationGameScope,
} from '../domain/communicationGame';
import { createInitialSettings } from '../domain/progression';
import type {
  RecordedSpeechBackend,
  RecordedSpeechPlayOptions,
} from '../services/recordedSpeech';
import { InteractionMediaCoordinator } from '../services/interactionMediaCoordinator';
import { MicrophonePlaybackGuard } from '../services/microphonePlaybackGuard';
import {
  RecordedOnlyWordTrainSpeechBackend,
  WordTrainMediaController,
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

interface DeferredPlayback {
  options: RecordedSpeechPlayOptions;
  resolve: () => void;
}

class DeferredRecordedSpeech implements RecordedSpeechBackend {
  readonly played: DeferredPlayback[] = [];
  readonly cancel = vi.fn();
  readonly unlock = vi.fn(async () => undefined);

  isEnabled = () => true;

  play = (options: RecordedSpeechPlayOptions): Promise<void> => new Promise((resolve) => {
    this.played.push({ options, resolve });
  });

  start(index: number): void {
    this.played[index]?.options.onStart();
  }

  finish(index: number): void {
    this.played[index]?.resolve();
  }
}

const scope: CommunicationGameScope = {
  activityId: 'syllableTrain',
  sessionId: 'session-1',
  roundId: 'round-1',
  stepId: 'mandatory-model',
};

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

  it('keeps deferred mandatory playback through an early gesture on the real coordinator stack', async () => {
    const player = new DeferredRecordedSpeech();
    const sharedCoordinator = new InteractionMediaCoordinator(
      new RecordedOnlyWordTrainSpeechBackend(player),
      new MicrophonePlaybackGuard(),
      () => () => undefined,
    );
    const controller = new WordTrainMediaController(player, sharedCoordinator);
    const playback = controller.play({
      intentId: 'word-train:mandatory',
      source: 'automatic',
      scope,
      audioClass: 'mandatory',
      settings: createInitialSettings(),
      localeLock: createCommunicationLocaleLock(scope, 'he-IL', 'round'),
      segments: [{
        text: 'כדור',
        recordedText: 'כדור',
        locale: 'he-IL',
      }],
    });

    expect(player.played).toHaveLength(1);
    controller.notifyInteraction(scope, 'touch');
    await controller.unlock();

    expect(player.cancel).not.toHaveBeenCalled();
    expect(player.unlock).toHaveBeenCalledOnce();
    player.start(0);
    player.finish(0);
    await expect(playback).resolves.toMatchObject({
      status: 'completed',
      speechStatus: 'completed',
    });
    controller.dispose();
  });
});
