import type { ToddlerSettings } from '../domain/types';
import {
  InteractionMediaCoordinator,
} from './interactionMediaCoordinator';
import { communicationMicrophoneGuard } from './microphonePlaybackGuard';
import {
  recordedSpeechPlayer,
  type RecordedSpeechBackend,
} from './recordedSpeech';
import { SpeechService } from './speech';

const forcedRecordedSpeech: RecordedSpeechBackend = {
  isEnabled: () => true,
  unlock: () => recordedSpeechPlayer.unlock(),
  play: (options) => recordedSpeechPlayer.play(options),
  cancel: () => recordedSpeechPlayer.cancel(),
};

export const TOY_PHONE_MEDIA_POLICY = 'recorded-only' as const;
export const toyPhoneSpeechService = new SpeechService(forcedRecordedSpeech);
export const toyPhoneMediaCoordinator = new InteractionMediaCoordinator(
  toyPhoneSpeechService,
  communicationMicrophoneGuard,
);

export function unlockToyPhoneMedia(settings: ToddlerSettings): void {
  toyPhoneSpeechService.unlock(settings);
}

export type PreparedMicrophoneStatus =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported'
  | 'error';

export async function readPreparedMicrophoneStatus(): Promise<PreparedMicrophoneStatus> {
  if (
    typeof navigator === 'undefined'
    || !navigator.mediaDevices?.getUserMedia
    || !navigator.permissions?.query
  ) {
    return 'unsupported';
  }
  try {
    const permission = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    if (permission.state === 'granted' || permission.state === 'denied') {
      return permission.state;
    }
    return 'prompt';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.info(`Microphone permission cannot be preflighted: ${message}`);
    return 'error';
  }
}

export function startToyPhoneRingCue(): () => void {
  return () => undefined;
}

export function startToyPhoneDisconnectCue(): () => void {
  return () => undefined;
}
