import { createHash } from 'node:crypto';
import {
  STORY_THAT_WAITS_LOCALES,
  STORY_THAT_WAITS_VERSION,
  collectStoryThatWaitsRecordingRequirements,
  type StoryThatWaitsLocale,
} from '../src/content/storyThatWaits.js';
import {
  STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS,
} from '../src/content/storyThatWaitsHebrew.js';
import { hasNiqqud } from '../src/content/hebrewPronunciation.js';
import { RECORDED_NARRATION_VOICE_NAMES } from '../src/domain/narrationVoice.js';
import { recordedSpeechManifestKey } from '../src/services/recordedSpeech.js';

export const STORY_THAT_WAITS_AUDIO_PACK_ID = `${STORY_THAT_WAITS_VERSION}-audio-v1`;
export const STORY_THAT_WAITS_AUDIO_FORMAT = 'riff-24khz-16bit-mono-pcm';
export const STORY_THAT_WAITS_SAMPLE_RATE = 24_000;
export const STORY_THAT_WAITS_SPRITES = {
  'he-IL': '/speech/story-that-waits-he-IL-v1.mp3',
  'en-US': '/speech/story-that-waits-en-US-v1.mp3',
  'en-GB': '/speech/story-that-waits-en-GB-v1.mp3',
} as const satisfies Readonly<Record<StoryThatWaitsLocale, string>>;
export const STORY_THAT_WAITS_PACK_MANIFEST_PATH =
  'public/speech/story-that-waits-v1.manifest.json';
export const STORY_THAT_WAITS_PRODUCTION_LEDGER_PATH =
  'docs/source/content/story-that-waits-audio-production-ledger.json';

export interface StoryThatWaitsSpeechSource {
  locale: StoryThatWaitsLocale;
  storyId: string;
  pageId: string;
  recordingKey: string;
  manifestKey: string;
  lookupText: string;
  synthesisText: string;
  voice: string;
}

export interface StoryThatWaitsPackClip {
  src: string;
  offset: number;
  duration: number;
}

export interface StoryThatWaitsPackManifest {
  version: 1;
  packId: typeof STORY_THAT_WAITS_AUDIO_PACK_ID;
  sourceHash: string;
  voices: Record<StoryThatWaitsLocale, string>;
  entries: Record<string, StoryThatWaitsPackClip>;
}

function assertSourceInventory(sources: readonly StoryThatWaitsSpeechSource[]): void {
  if (sources.length !== 48) {
    throw new Error(`Story speech inventory must contain exactly 48 sources, found ${sources.length}.`);
  }
  if (new Set(sources.map((source) => source.recordingKey)).size !== 48) {
    throw new Error('Story speech inventory contains duplicate stable recording keys.');
  }
  if (new Set(sources.map((source) => source.manifestKey)).size !== 48) {
    throw new Error('Story speech inventory contains duplicate exact-locale manifest keys.');
  }

  for (const locale of STORY_THAT_WAITS_LOCALES) {
    const localeSources = sources.filter((source) => source.locale === locale);
    if (localeSources.length !== 16) {
      throw new Error(`Story speech inventory must contain 16 ${locale} sources.`);
    }
  }

  for (const source of sources) {
    if (
      source.lookupText !== source.lookupText.normalize('NFC')
      || source.synthesisText !== source.synthesisText.normalize('NFC')
    ) {
      throw new Error(`Story speech source is not NFC-normalized: ${source.recordingKey}`);
    }
    if (
      source.locale === 'he-IL'
      && (!hasNiqqud(source.synthesisText) || hasNiqqud(source.lookupText))
    ) {
      throw new Error(`Hebrew production source is not fully separated from its lookup key: ${source.recordingKey}`);
    }
    if (source.locale !== 'he-IL' && source.synthesisText !== source.lookupText) {
      throw new Error(`English production source differs from its approved exact sentence: ${source.recordingKey}`);
    }
  }
}

export function collectStoryThatWaitsSpeechSources(): readonly StoryThatWaitsSpeechSource[] {
  const sources = collectStoryThatWaitsRecordingRequirements().map((requirement) => {
    const synthesisText = requirement.locale === 'he-IL'
      ? STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS[
        requirement.recordedLookupText as keyof typeof STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS
      ]
      : requirement.recordedLookupText;
    if (!synthesisText) {
      throw new Error(`Missing reviewed synthesis source for ${requirement.recordingKey}.`);
    }
    return {
      locale: requirement.locale,
      storyId: requirement.storyId,
      pageId: requirement.pageId,
      recordingKey: requirement.recordingKey,
      manifestKey: recordedSpeechManifestKey(
        requirement.locale,
        requirement.recordedLookupText,
      ),
      lookupText: requirement.recordedLookupText,
      synthesisText: synthesisText.normalize('NFC'),
      voice: RECORDED_NARRATION_VOICE_NAMES[requirement.locale],
    };
  });
  assertSourceInventory(sources);
  return sources;
}

export function storyThatWaitsSourceHash(
  sources = collectStoryThatWaitsSpeechSources(),
): string {
  const canonical = sources.map((source) => ({
    recordingKey: source.recordingKey,
    locale: source.locale,
    lookupText: source.lookupText,
    synthesisText: source.synthesisText,
    voice: source.voice,
  }));
  return createHash('sha256').update(`${JSON.stringify(canonical)}\n`).digest('hex');
}

export function unicodeCodePoints(text: string): string[] {
  return Array.from(text, (character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      throw new Error('Unable to read Unicode code point.');
    }
    return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
  });
}
