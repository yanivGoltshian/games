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

export const wordTrainMediaCoordinator = new InteractionMediaCoordinator(
  new RecordedOnlyWordTrainSpeechBackend(wordTrainRecordedSpeech),
);
