import { InteractionMediaCoordinator } from './interactionMediaCoordinator';
import { RecordedOnlySpeechBackend } from './recordedOnlySpeechBackend';
import { storyThatWaitsRecordedSpeechPlayer } from './storyThatWaitsRecordedSpeech';
import type { RecordedSpeechBackend } from './recordedSpeech';

export const STORY_THAT_WAITS_MEDIA_POLICY = 'recorded-only' as const;

export class StoryThatWaitsRecordedMediaCoordinator extends InteractionMediaCoordinator {
  private readonly recordedBackend: RecordedOnlySpeechBackend;

  constructor(player: RecordedSpeechBackend = storyThatWaitsRecordedSpeechPlayer) {
    const recordedBackend = new RecordedOnlySpeechBackend(player);
    super(recordedBackend);
    this.recordedBackend = recordedBackend;
  }

  unlock(): void {
    this.recordedBackend.unlock();
  }
}

export const storyThatWaitsMediaCoordinator = new StoryThatWaitsRecordedMediaCoordinator();
