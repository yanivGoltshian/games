import {
  STORY_THAT_WAITS_LOCALES,
  STORY_THAT_WAITS_VERSION,
  collectStoryThatWaitsRecordingRequirements,
  type StoryThatWaitsLocale,
} from '../content/storyThatWaits';
import {
  RecordedSpeechPlayer,
  recordedSpeechManifestKey,
  type RecordedSpeechClip,
  type RecordedSpeechManifest,
} from './recordedSpeech';

export const STORY_THAT_WAITS_AUDIO_PACK_ID = `${STORY_THAT_WAITS_VERSION}-audio-v1`;
export const STORY_THAT_WAITS_AUDIO_SOURCE_HASH =
  '026fdeb5033b02e510da1cb77caaf0632f5fb21b9f759d68cb13c65a47a37602';
export const STORY_THAT_WAITS_PACK_MANIFEST_URL = '/speech/story-that-waits-v1.manifest.json';
export const STORY_THAT_WAITS_SPRITES = {
  'he-IL': '/speech/story-that-waits-he-IL-v1.mp3',
  'en-US': '/speech/story-that-waits-en-US-v1.mp3',
  'en-GB': '/speech/story-that-waits-en-GB-v1.mp3',
} as const satisfies Readonly<Record<StoryThatWaitsLocale, string>>;

type StoryManifest = RecordedSpeechManifest & {
  packId?: unknown;
  sourceHash?: unknown;
};

type ClipRecord = Readonly<Record<string, RecordedSpeechClip>>;

function expectedStoryManifestKeys(): ReadonlyMap<string, StoryThatWaitsLocale> {
  return new Map(
    collectStoryThatWaitsRecordingRequirements().map((requirement) => [
      recordedSpeechManifestKey(requirement.locale, requirement.recordedLookupText),
      requirement.locale,
    ]),
  );
}

function isClip(value: unknown): value is RecordedSpeechClip {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const clip = value as Partial<RecordedSpeechClip>;
  return typeof clip.src === 'string'
    && typeof clip.offset === 'number'
    && Number.isFinite(clip.offset)
    && clip.offset >= 0
    && typeof clip.duration === 'number'
    && Number.isFinite(clip.duration)
    && clip.duration > 0;
}

export function validateStoryThatWaitsRecordedSpeechManifest(
  manifest: RecordedSpeechManifest,
): RecordedSpeechManifest {
  const storyManifest = manifest as StoryManifest;
  const entries = storyManifest.entries;
  if (
    storyManifest.version !== 1
    || storyManifest.packId !== STORY_THAT_WAITS_AUDIO_PACK_ID
    || storyManifest.sourceHash !== STORY_THAT_WAITS_AUDIO_SOURCE_HASH
    || typeof entries !== 'object'
    || entries === null
    || Array.isArray(entries)
  ) {
    throw new Error('Story That Waits speech pack metadata is invalid.');
  }

  const expectedKeys = expectedStoryManifestKeys();
  const actualKeys = Object.keys(entries);
  if (actualKeys.length !== expectedKeys.size) {
    throw new Error('Story That Waits speech pack does not contain exactly 48 clips.');
  }

  for (const key of actualKeys) {
    const locale = expectedKeys.get(key);
    const clip = (entries as ClipRecord)[key];
    if (!locale || !isClip(clip) || clip.src !== STORY_THAT_WAITS_SPRITES[locale]) {
      throw new Error(`Story That Waits speech pack has an invalid clip for ${key}.`);
    }
  }

  for (const locale of STORY_THAT_WAITS_LOCALES) {
    const localeClipCount = actualKeys.filter((key) => expectedKeys.get(key) === locale).length;
    if (localeClipCount !== 16) {
      throw new Error(`Story That Waits speech pack must contain 16 ${locale} clips.`);
    }
  }

  return manifest;
}

export const storyThatWaitsRecordedSpeechPlayer = new RecordedSpeechPlayer(
  undefined,
  undefined,
  undefined,
  () => true,
  STORY_THAT_WAITS_PACK_MANIFEST_URL,
  validateStoryThatWaitsRecordedSpeechManifest,
);
