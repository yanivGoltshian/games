import { describe, expect, it } from 'vitest';
import { localeLockMatches } from '../domain/communicationGame';
import { collectRecordedSpeechCatalog } from './recordedSpeechCatalog';
import {
  STORY_THAT_WAITS_ACTION_KINDS,
  STORY_THAT_WAITS_APPROVED_ART_IDS,
  STORY_THAT_WAITS_LOCALES,
  STORY_THAT_WAITS_LOCALE_LOCK_TEMPLATES,
  STORY_THAT_WAITS_MAX_CHARACTERS,
  STORY_THAT_WAITS_MAX_WORDS,
  STORY_THAT_WAITS_PAGE_IDS,
  STORY_THAT_WAITS_STORIES,
  STORY_THAT_WAITS_STORY_IDS,
  STORY_THAT_WAITS_VERSION,
  collectStoryThatWaitsRecordingRequirements,
  createStoryThatWaitsContentRequirements,
  createStoryThatWaitsLocaleLock,
  createStoryThatWaitsScope,
  getStoryThatWaitsRecordedLookupTexts,
  getStoryThatWaitsRecordingKeys,
  getStoryThatWaitsStory,
  storyThatWaitsSentenceWithinBounds,
} from './storyThatWaits';

const DISALLOWED_MARKERS = [/\{\{/u, /\}\}/u, /\$\{/u, /TODO/u, /TBD/u, /\.{3,}/u, /__+/u, /\[\[/u, /\]\]/u];

function countWords(sentence: string): number {
  return sentence.trim().split(/\s+/u).filter(Boolean).length;
}

describe('Story That Waits content pack', () => {
  it('contains exactly four fixed stories with four ordered pages each', () => {
    expect(STORY_THAT_WAITS_STORY_IDS).toEqual([
      'duck-and-ball',
      'rabbit-and-carrot',
      'bus-to-tree-and-flower',
      'cat-finds-shoe-and-cup',
    ]);
    expect(STORY_THAT_WAITS_STORIES).toHaveLength(4);
    expect(STORY_THAT_WAITS_STORIES.map((story) => story.order)).toEqual([1, 2, 3, 4]);

    for (const story of STORY_THAT_WAITS_STORIES) {
      expect(story.localeLockBoundary).toBe('session');
      expect(story.pages).toHaveLength(4);
      expect(story.pages.map((page) => page.id)).toEqual(STORY_THAT_WAITS_PAGE_IDS);
      expect(story.pages.map((page) => page.order)).toEqual([1, 2, 3, 4]);
      expect(story.pages.map((page) => page.beat)).toEqual(['beginning', 'middle', 'middle', 'end']);
      expect(getStoryThatWaitsStory(story.id)).toBe(story);
    }
  });

  it('ships exactly sixteen utterances per locale and forty-eight total recording requirements', () => {
    const allRequirements = collectStoryThatWaitsRecordingRequirements();
    expect(allRequirements).toHaveLength(48);

    for (const locale of STORY_THAT_WAITS_LOCALES) {
      const perLocale = collectStoryThatWaitsRecordingRequirements(locale);
      expect(perLocale).toHaveLength(16);
      expect(getStoryThatWaitsRecordingKeys(locale)).toHaveLength(16);
      expect(getStoryThatWaitsRecordedLookupTexts(locale)).toHaveLength(16);
      expect(new Set(getStoryThatWaitsRecordingKeys(locale)).size).toBe(16);
    }

    expect(new Set(allRequirements.map((entry) => entry.recordingKey)).size).toBe(48);
  });

  it('keeps locale lock data distinct and bound to one story for an entire session', () => {
    expect(STORY_THAT_WAITS_LOCALE_LOCK_TEMPLATES).toHaveLength(4);
    expect(new Set(STORY_THAT_WAITS_LOCALE_LOCK_TEMPLATES.map((entry) => entry.activityId)).size).toBe(4);

    for (const story of STORY_THAT_WAITS_STORIES) {
      const sessionId = `session-for-${story.id}`;
      const lock = createStoryThatWaitsLocaleLock(story.id, sessionId, 'en-US', 'page-3');
      const sameStoryScope = createStoryThatWaitsScope(story.id, sessionId, 'page-4');
      expect(lock.boundary).toBe('session');
      expect(localeLockMatches(lock, sameStoryScope, 'en-US')).toBe(true);

      const otherStory = STORY_THAT_WAITS_STORIES.find((candidate) => candidate.id !== story.id);
      expect(otherStory).toBeTruthy();
      if (otherStory) {
        expect(localeLockMatches(lock, createStoryThatWaitsScope(otherStory.id, sessionId), 'en-US')).toBe(false);
      }
    }
  });

  it('uses only approved art ids and known action kinds', () => {
    const approvedArt = new Set(STORY_THAT_WAITS_APPROVED_ART_IDS);
    const actionKinds = new Set(STORY_THAT_WAITS_ACTION_KINDS);

    for (const story of STORY_THAT_WAITS_STORIES) {
      for (const page of story.pages) {
        expect(actionKinds.has(page.action.kind)).toBe(true);
        expect(approvedArt.has(page.action.subjectArtId)).toBe(true);
        if (page.action.objectArtId) {
          expect(approvedArt.has(page.action.objectArtId)).toBe(true);
        }
        expect(page.artIds.length).toBeGreaterThanOrEqual(1);
        for (const artId of page.artIds) {
          expect(approvedArt.has(artId)).toBe(true);
        }
      }
    }
  });

  it('keeps every utterance complete, punctuated, bounded, and free of fragments or markers', () => {
    for (const story of STORY_THAT_WAITS_STORIES) {
      for (const page of story.pages) {
        for (const locale of STORY_THAT_WAITS_LOCALES) {
          const utterance = page.utterances[locale];
          expect(utterance.locale).toBe(locale);
          expect(utterance.recordedLookupText).toBe(utterance.sentence);
          expect(utterance.sentence).toMatch(/[.!?]$/u);
          expect(utterance.sentence).toBe(utterance.sentence.trim());
          expect(countWords(utterance.sentence)).toBeGreaterThanOrEqual(3);
          expect(countWords(utterance.sentence)).toBeLessThanOrEqual(STORY_THAT_WAITS_MAX_WORDS);
          expect(utterance.sentence.length).toBeLessThanOrEqual(STORY_THAT_WAITS_MAX_CHARACTERS);
          expect(storyThatWaitsSentenceWithinBounds(utterance.sentence)).toBe(true);
          expect(utterance.accessibilityLabel).toContain(utterance.sentence);
          for (const marker of DISALLOWED_MARKERS) {
            expect(utterance.sentence).not.toMatch(marker);
          }
        }
      }
    }
  });

  it('authors en-US and en-GB separately while preserving the same story actions', () => {
    const differingPairs = STORY_THAT_WAITS_STORIES.flatMap((story) => (
      story.pages.filter((page) => page.utterances['en-US'].sentence !== page.utterances['en-GB'].sentence)
    ));
    const duckPageTwo = getStoryThatWaitsStory('duck-and-ball').pages[1];
    const busPageTwo = getStoryThatWaitsStory('bus-to-tree-and-flower').pages[1];

    expect(differingPairs.length).toBeGreaterThanOrEqual(4);
    expect(duckPageTwo).toBeDefined();
    expect(busPageTwo).toBeDefined();
    expect(duckPageTwo?.utterances['en-US'].sentence).toBe('The duck taps the ball.');
    expect(duckPageTwo?.utterances['en-GB'].sentence).toBe('The duck gives the ball a tap.');
    expect(busPageTwo?.utterances['en-US'].sentence).toBe('The bus stops by the tree.');
    expect(busPageTwo?.utterances['en-GB'].sentence).toBe('The bus stops beside the tree.');
  });

  it('builds exact content requirements for manifest lookup text and approved images', () => {
    const requirements = createStoryThatWaitsContentRequirements(
      'cat-finds-shoe-and-cup',
      'session-42',
      'he-IL',
    );

    expect(requirements.contentVersion).toBe(STORY_THAT_WAITS_VERSION);
    expect(requirements.locale).toBe('he-IL');
    expect(requirements.localeLock.boundary).toBe('session');
    expect(requirements.scope.activityId).toBe('story-that-waits:cat-finds-shoe-and-cup');
    expect(requirements.recordingKeys).toEqual([
      'חתול רואה נעל.',
      'חתול דוחף את הנעל.',
      'חתול מוצא כוס.',
      'חתול יושב ליד הכוס.',
    ]);
    expect(requirements.images).toEqual([
      { kind: 'id', value: 'cat' },
      { kind: 'id', value: 'shoe' },
      { kind: 'id', value: 'cup' },
    ]);
  });

  it('remains fail-closed until the separate recording production session', () => {
    const installedCatalogKeys = new Set(
      collectRecordedSpeechCatalog().map((entry) => `${entry.locale}\u0000${entry.text}`),
    );

    for (const requirement of collectStoryThatWaitsRecordingRequirements()) {
      expect(
        installedCatalogKeys.has(`${requirement.locale}\u0000${requirement.recordedLookupText}`),
      ).toBe(false);
    }
  });
});
