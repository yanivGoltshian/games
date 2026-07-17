import type { ToddlerSettings } from '../domain/types';
import {
  InteractionMediaCoordinator,
  type InteractionSpeechBackend,
} from '../services/interactionMediaCoordinator';
import {
  RecordedSpeechPlayer,
  type RecordedSpeechBackend,
} from '../services/recordedSpeech';
import type {
  SpeechRequestOptions,
  SpeechResult,
  SpeechSegment,
} from '../services/speech';

interface ActiveRecordedRequest {
  scope: string;
  cancelled: boolean;
}

export class RecordedOnlyWordTrainSpeechBackend implements InteractionSpeechBackend {
  private active: ActiveRecordedRequest | null = null;
  private nextRequestId = 1;

  constructor(private readonly player: RecordedSpeechBackend) {}

  async speakSegments(
    segments: SpeechSegment[],
    settings: ToddlerSettings,
    options: SpeechRequestOptions,
  ): Promise<SpeechResult> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    if (segments.length !== 1 || !options.scope) {
      return { requestId, status: 'error' };
    }

    const segment = segments[0]!;
    const active: ActiveRecordedRequest = {
      scope: options.scope,
      cancelled: false,
    };
    this.active = active;
    try {
      await this.player.play({
        text: segment.recordedText ?? segment.text,
        locale: segment.locale,
        volume: settings.quietMode ? 0 : settings.soundLevel,
        onStart: () => options.onStart?.(),
      });
      return {
        requestId,
        status: active.cancelled ? 'cancelled' : 'completed',
      };
    } catch {
      return {
        requestId,
        status: active.cancelled ? 'cancelled' : 'error',
      };
    } finally {
      if (this.active === active) {
        this.active = null;
      }
    }
  }

  cancelScope(scope: string): void {
    if (this.active?.scope !== scope) {
      return;
    }
    this.active.cancelled = true;
    this.player.cancel();
  }
}

const wordTrainRecordedSpeech = new RecordedSpeechPlayer();

export interface WordTrainMediaControllerContract {
  play: InteractionMediaCoordinator['play'];
  notifyInteraction: InteractionMediaCoordinator['notifyInteraction'];
  unlock: () => Promise<void>;
}

export class WordTrainMediaController implements WordTrainMediaControllerContract {
  constructor(
    private readonly player: RecordedSpeechBackend,
    private readonly coordinator = new InteractionMediaCoordinator(
      new RecordedOnlyWordTrainSpeechBackend(player),
    ),
  ) {}

  play(
    ...args: Parameters<InteractionMediaCoordinator['play']>
  ): ReturnType<InteractionMediaCoordinator['play']> {
    return this.coordinator.play(...args);
  }

  notifyInteraction(
    ...args: Parameters<InteractionMediaCoordinator['notifyInteraction']>
  ): ReturnType<InteractionMediaCoordinator['notifyInteraction']> {
    return this.coordinator.notifyInteraction(...args);
  }

  unlock(): Promise<void> {
    return this.player.unlock();
  }

  dispose(): void {
    this.coordinator.dispose();
  }
}

export const wordTrainMediaCoordinator = new WordTrainMediaController(
  wordTrainRecordedSpeech,
);
