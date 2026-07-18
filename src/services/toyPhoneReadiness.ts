import {
  TOY_PHONE_CALLER_IDS,
  TOY_PHONE_CONTENT_VERSION,
  TOY_PHONE_LOCALES,
  TOY_PHONE_OBJECT_IDS,
  getToyPhoneRecordingTexts,
} from '../content/toyPhone';
import {
  createCommunicationLocaleLock,
  type CommunicationGameScope,
} from '../domain/communicationGame';
import type { SpeechLocale } from '../domain/types';
import {
  communicationAssetReadiness,
  validateCommunicationAssetReadiness,
  type CommunicationAssetReadiness,
  type CommunicationReadinessIssue,
} from './communicationAssetReadiness';
import type { RecordedSpeechManifest } from './recordedSpeech';

const INSTALLED_TOY_PHONE_IMAGES = [
  ...TOY_PHONE_CALLER_IDS.map((value) => ({ kind: 'id' as const, value })),
  ...TOY_PHONE_OBJECT_IDS.map((value) => ({ kind: 'id' as const, value })),
];
const TOY_PHONE_RECORDING_SPRITES: Record<SpeechLocale, string> = {
  'he-IL': '/speech/toy-phone-he-IL-v1.mp3',
  'en-US': '/speech/toy-phone-en-US-v1.mp3',
  'en-GB': '/speech/toy-phone-en-GB-v1.mp3',
};

export type ToyPhoneReadiness =
  | { status: 'ready'; contentVersion: string }
  | { status: 'not-ready'; contentVersion: string; issues: CommunicationReadinessIssue[] };

export function createToyPhoneContentRequirements(
  scope: CommunicationGameScope,
  locale: SpeechLocale,
) {
  return {
    contentVersion: TOY_PHONE_CONTENT_VERSION,
    scope,
    locale,
    localeLock: createCommunicationLocaleLock(scope, locale, 'session'),
    recordingKeys: getToyPhoneRecordingTexts(locale).map((text) => ({
      text,
      expectedSrc: TOY_PHONE_RECORDING_SPRITES[locale],
    })),
    images: INSTALLED_TOY_PHONE_IMAGES,
  };
}

function combineReadiness(results: readonly CommunicationAssetReadiness[]): ToyPhoneReadiness {
  const issues = results.flatMap((result) => (
    result.status === 'not-ready' ? result.issues : []
  ));
  return issues.length === 0
    ? { status: 'ready', contentVersion: TOY_PHONE_CONTENT_VERSION }
    : { status: 'not-ready', contentVersion: TOY_PHONE_CONTENT_VERSION, issues };
}

export function validateToyPhoneContentReadiness(
  scope: CommunicationGameScope,
  manifest: RecordedSpeechManifest,
): ToyPhoneReadiness {
  return combineReadiness(TOY_PHONE_LOCALES.map((locale) => (
    validateCommunicationAssetReadiness(
      createToyPhoneContentRequirements(scope, locale),
      {
        contentVersion: TOY_PHONE_CONTENT_VERSION,
        images: INSTALLED_TOY_PHONE_IMAGES,
      },
      manifest,
    )
  )));
}

export async function checkToyPhoneContentReadiness(
  scope: CommunicationGameScope,
): Promise<ToyPhoneReadiness> {
  const results = await Promise.all(TOY_PHONE_LOCALES.map((locale) => (
    communicationAssetReadiness.validate(
      createToyPhoneContentRequirements(scope, locale),
      {
        contentVersion: TOY_PHONE_CONTENT_VERSION,
        images: INSTALLED_TOY_PHONE_IMAGES,
      },
    )
  )));
  return combineReadiness(results);
}
