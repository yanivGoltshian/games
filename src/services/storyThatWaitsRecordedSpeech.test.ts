import { describe, expect, it } from 'vitest';
import {
  collectStoryThatWaitsRecordingRequirements,
} from '../content/storyThatWaits';
import {
  recordedSpeechManifestKey,
  type RecordedSpeechManifest,
} from './recordedSpeech';
import {
  STORY_THAT_WAITS_AUDIO_PACK_ID,
  STORY_THAT_WAITS_AUDIO_SOURCE_HASH,
  STORY_THAT_WAITS_SPRITES,
  validateStoryThatWaitsRecordedSpeechManifest,
} from './storyThatWaitsRecordedSpeech';

function validManifest(): RecordedSpeechManifest {
  return {
    version: 1,
    packId: STORY_THAT_WAITS_AUDIO_PACK_ID,
    sourceHash: STORY_THAT_WAITS_AUDIO_SOURCE_HASH,
    entries: Object.fromEntries(
      collectStoryThatWaitsRecordingRequirements().map((requirement, index) => [
        recordedSpeechManifestKey(requirement.locale, requirement.recordedLookupText),
        {
          src: STORY_THAT_WAITS_SPRITES[requirement.locale],
          offset: index,
          duration: 0.75,
        },
      ]),
    ),
  } as RecordedSpeechManifest;
}

describe('Story That Waits dedicated recorded speech pack', () => {
  it('accepts only the exact approved 48-clip dedicated source manifest', () => {
    const manifest = validManifest();

    expect(validateStoryThatWaitsRecordedSpeechManifest(manifest)).toBe(manifest);
  });

  it('fails closed for wrong source, missing clips, extra clips, and wrong sprite routing', () => {
    expect(() => validateStoryThatWaitsRecordedSpeechManifest({
      ...validManifest(),
      sourceHash: 'wrong-source',
    } as RecordedSpeechManifest)).toThrow(/metadata/i);

    const missing = validManifest();
    delete missing.entries[Object.keys(missing.entries)[0]!];
    expect(() => validateStoryThatWaitsRecordedSpeechManifest(missing)).toThrow(/48 clips/i);

    const extra = validManifest();
    extra.entries.extra = { src: STORY_THAT_WAITS_SPRITES['en-US'], offset: 1, duration: 1 };
    expect(() => validateStoryThatWaitsRecordedSpeechManifest(extra)).toThrow(/48 clips/i);

    const wrongSprite = validManifest();
    const hebrewKey = Object.keys(wrongSprite.entries).find((key) => key.startsWith('he-IL'))!;
    wrongSprite.entries[hebrewKey] = {
      ...wrongSprite.entries[hebrewKey]!,
      src: STORY_THAT_WAITS_SPRITES['en-US'],
    };
    expect(() => validateStoryThatWaitsRecordedSpeechManifest(wrongSprite)).toThrow(/invalid clip/i);
  });
});
