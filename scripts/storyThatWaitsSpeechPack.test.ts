import { describe, expect, it } from 'vitest';
import {
  STORY_THAT_WAITS_AUDIO_PACK_ID,
  STORY_THAT_WAITS_SPRITES,
  collectStoryThatWaitsSpeechSources,
  storyThatWaitsSourceHash,
  unicodeCodePoints,
} from './storyThatWaitsSpeechPack';

describe('Story That Waits speech pack source contract', () => {
  it('binds exactly 48 immutable exact-locale sources to dedicated versioned sprites', () => {
    const sources = collectStoryThatWaitsSpeechSources();

    expect(sources).toHaveLength(48);
    expect(new Set(sources.map((source) => source.recordingKey))).toHaveLength(48);
    expect(new Set(sources.map((source) => source.manifestKey))).toHaveLength(48);
    expect(STORY_THAT_WAITS_AUDIO_PACK_ID).toBe('story-that-waits-v1-audio-v1');
    expect(Object.values(STORY_THAT_WAITS_SPRITES)).toEqual([
      '/speech/story-that-waits-he-IL-v1.mp3',
      '/speech/story-that-waits-en-US-v1.mp3',
      '/speech/story-that-waits-en-GB-v1.mp3',
    ]);
  });

  it('uses only the approved pointed Hebrew production sources', () => {
    const hebrewSources = collectStoryThatWaitsSpeechSources().filter(
      (source) => source.locale === 'he-IL',
    );

    expect(hebrewSources).toHaveLength(16);
    expect(hebrewSources.every((source) => (
      source.lookupText !== source.synthesisText
      && source.lookupText === source.lookupText.normalize('NFC')
      && source.synthesisText === source.synthesisText.normalize('NFC')
    ))).toBe(true);
  });

  it('produces deterministic source hashes and exact submitted code-point sequences', () => {
    const sources = collectStoryThatWaitsSpeechSources();
    const hash = storyThatWaitsSourceHash(sources);
    const firstHebrew = sources.find((source) => source.locale === 'he-IL');

    expect(hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(storyThatWaitsSourceHash(sources)).toBe(hash);
    expect(firstHebrew).toBeDefined();
    expect(
      unicodeCodePoints(firstHebrew?.synthesisText ?? '')
        .map((value) => String.fromCodePoint(Number.parseInt(value.slice(2), 16)))
        .join(''),
    ).toBe(firstHebrew?.synthesisText);
  });
});
