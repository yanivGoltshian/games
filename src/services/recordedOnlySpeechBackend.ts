import type { ToddlerSettings } from '../domain/types';
import type { InteractionSpeechBackend } from './interactionMediaCoordinator';
import {
  recordedSpeechPlayer,
  type RecordedSpeechBackend,
} from './recordedSpeech';
import type {
  SpeechRequestOptions,
  SpeechResult,
  SpeechSegment,
} from './speech';

interface ActiveRecordedRequest {
  readonly scope: string;
  forcedStatus: 'cancelled' | 'superseded' | null;
}

export class RecordedOnlySpeechBackend implements InteractionSpeechBackend {
  private active: ActiveRecordedRequest | null = null;
  private nextRequestId = 1;

  constructor(private readonly player: RecordedSpeechBackend = recordedSpeechPlayer) {}

  unlock(): void {
    void this.player.unlock().catch(() => undefined);
  }

  async speakSegments(
    segments: SpeechSegment[],
    settings: ToddlerSettings,
    options: SpeechRequestOptions,
  ): Promise<SpeechResult> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const segment = segments[0];
    if (
      segments.length !== 1
      || !segment
      || typeof segment.recordedText !== 'string'
      || !segment.recordedText.trim()
      || !options.scope
    ) {
      return { requestId, status: 'unsupported' };
    }

    if (this.active) {
      this.active.forcedStatus = 'superseded';
      this.player.cancel();
    }
    const active: ActiveRecordedRequest = {
      scope: options.scope,
      forcedStatus: null,
    };
    this.active = active;

    try {
      await this.player.unlock();
    } catch {
      // Exact recorded playback below is authoritative for readiness.
    }

    if (this.active !== active || active.forcedStatus !== null) {
      if (this.active === active) {
        this.active = null;
      }
      return { requestId, status: active.forcedStatus ?? 'superseded' };
    }

    try {
      await this.player.play({
        text: segment.recordedText,
        locale: segment.locale,
        volume: settings.quietMode ? 0 : settings.soundLevel,
        onStart: () => {
          if (this.active === active && active.forcedStatus === null) {
            options.onStart?.();
          }
        },
      });
      return {
        requestId,
        status: active.forcedStatus ?? 'completed',
      };
    } catch (error: unknown) {
      if (active.forcedStatus !== null) {
        return { requestId, status: active.forcedStatus };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        requestId,
        status: /AudioContext is unavailable/i.test(message) ? 'unsupported' : 'error',
      };
    } finally {
      if (this.active === active) {
        this.active = null;
      }
    }
  }

  cancelScope(
    scope: string,
    reason: 'navigation' | 'replay' | 'visibility' = 'replay',
  ): void {
    if (this.active?.scope !== scope) {
      return;
    }
    this.active.forcedStatus = reason === 'replay' ? 'superseded' : 'cancelled';
    this.player.cancel();
  }
}
