import {
  TOY_PHONE_CONTENT_VERSION,
  TOY_PHONE_RECORDING_INVENTORY,
  TOY_PHONE_SHELF_META,
} from '../content/toyPhone';
import { TOY_PHONE_MEDIA_POLICY } from '../services/toyPhoneMedia';
import { ToyPhoneGame } from './ToyPhoneGame';

/**
 * Private integration seam for the later reviewed recording-production branch.
 * Public navigation remains unchanged while every exact-locale clip is absent.
 */
export const TOY_PHONE_INTEGRATION = {
  gameId: 'toy-phone',
  component: ToyPhoneGame,
  visibility: 'private',
  readiness: 'requires-all-recordings',
  mediaPolicy: TOY_PHONE_MEDIA_POLICY,
  contentVersion: TOY_PHONE_CONTENT_VERSION,
  shelfMeta: TOY_PHONE_SHELF_META,
  requiredRecordingKeys: TOY_PHONE_RECORDING_INVENTORY.map((entry) => entry.recordingKey),
} as const;

export { ToyPhoneGame };
export type { ToyPhoneCallerId, ToyPhoneObjectId } from '../content/toyPhone';
export type {
  ToyPhoneAction,
  ToyPhoneStage,
  ToyPhoneState,
} from './toyPhoneState';
export { selectToyPhoneLocale } from './toyPhoneRuntime';
