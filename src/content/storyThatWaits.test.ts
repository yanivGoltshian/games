import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localeLockMatches } from '../domain/communicationGame';
import { collectRecordedSpeechCatalog } from './recordedSpeechCatalog';
import {
  getHebrewPronunciation,
  getHebrewPronunciationSkeleton,
  hasNiqqud,
  stripNiqqud,
} from './hebrewPronunciation';
import {
  STORY_THAT_WAITS_HEBREW_DISPLAY_TEXTS,
  STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS,
  STORY_THAT_WAITS_HEBREW_REVIEW_GATE,
} from './storyThatWaitsHebrew';
import {
  STORY_THAT_WAITS_ACTION_KINDS,
  STORY_THAT_WAITS_APPROVED_ART_IDS,
  STORY_THAT_WAITS_LOCALES,
  STORY_THAT_WAITS_LOCALE_LOCK_TEMPLATES,
  STORY_THAT_WAITS_MAX_CHARACTERS,
  STORY_THAT_WAITS_MAX_WORDS,
  STORY_THAT_WAITS_PAGE_IDS,
  STORY_THAT_WAITS_SHELF_METADATA,
  STORY_THAT_WAITS_STORIES,
  STORY_THAT_WAITS_STORY_IDS,
  STORY_THAT_WAITS_VERSION,
  collectStoryThatWaitsRecordingRequirements,
  createStoryThatWaitsContentRequirements,
  createStoryThatWaitsLocaleLock,
  createStoryThatWaitsScope,
  getStoryThatWaitsAccessibilityLabel,
  getStoryThatWaitsDisplaySentence,
  getStoryThatWaitsRecordedLookupTexts,
  getStoryThatWaitsRecordingKeys,
  getStoryThatWaitsStory,
  storyThatWaitsSentenceWithinBounds,
} from './storyThatWaits';

const DISALLOWED_MARKERS = [/\{\{/u, /\}\}/u, /\$\{/u, /TODO/u, /TBD/u, /\.{3,}/u, /__+/u, /\[\[/u, /\]\]/u];
const HEBREW_WORD_PATTERN = /[\u05D0-\u05EA][\u0591-\u05C7\u05D0-\u05EA]*/gu;

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

  it('keeps the independently reviewed sentence revisions bound to their stable recording keys', () => {
    const duckPageTwo = getStoryThatWaitsStory('duck-and-ball').pages[1];
    const busPageFour = getStoryThatWaitsStory('bus-to-tree-and-flower').pages[3];
    const catPageTwo = getStoryThatWaitsStory('cat-finds-shoe-and-cup').pages[1];

    expect(duckPageTwo?.utterances['he-IL']).toMatchObject({
      sentence: 'ברווז נוגע בכדור.',
      recordedLookupText: 'ברווז נוגע בכדור.',
      recordingKey: 'story-that-waits/v1/he-IL/duck-and-ball/page-2',
    });
    expect(busPageFour?.utterances['en-GB']).toMatchObject({
      sentence: 'The bus rests beside the flower.',
      recordedLookupText: 'The bus rests beside the flower.',
      recordingKey: 'story-that-waits/v1/en-GB/bus-to-tree-and-flower/page-4',
    });
    expect(catPageTwo?.utterances['he-IL']).toMatchObject({
      sentence: 'חתול מזיז את הנעל.',
      recordedLookupText: 'חתול מזיז את הנעל.',
      recordingKey: 'story-that-waits/v1/he-IL/cat-finds-shoe-and-cup/page-2',
    });
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
      'חתול מזיז את הנעל.',
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

  it('maps every unpointed Hebrew lookup key to one fully pointed production sentence', () => {
    const hebrewRequirements = collectStoryThatWaitsRecordingRequirements('he-IL');
    const productionEntries = Object.entries(STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS);

    expect(productionEntries).toHaveLength(16);
    expect(new Set(productionEntries.map(([, productionText]) => productionText)).size).toBe(16);
    expect(new Set(productionEntries.map(([lookupText]) => lookupText))).toEqual(
      new Set(hebrewRequirements.map((requirement) => requirement.recordedLookupText)),
    );
    expect(STORY_THAT_WAITS_HEBREW_REVIEW_GATE).toEqual({
      status: 'pending-human-review',
      generationAllowed: false,
      requiredChecks: [
        'pronunciation',
        'stress',
        'masculine-agreement',
        'natural-prosody',
      ],
    });

    for (const requirement of hebrewRequirements) {
      const productionText = STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS[
        requirement.recordedLookupText as keyof typeof STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS
      ];
      expect(productionText, `missing pointed production text for ${requirement.recordedLookupText}`)
        .toBeTruthy();
      expect(hasNiqqud(requirement.recordedLookupText)).toBe(false);
      expect(getHebrewPronunciation(requirement.recordedLookupText)).toBe(productionText);
      expect(stripNiqqud(productionText).normalize('NFC'))
        .toBe(getHebrewPronunciationSkeleton(requirement.recordedLookupText));
      const productionWords = productionText.match(HEBREW_WORD_PATTERN) ?? [];
      expect(productionWords).toHaveLength(countWords(requirement.recordedLookupText));
      expect(
        productionWords.every((word) => hasNiqqud(word)),
        `every word must be pointed in ${productionText}`,
      ).toBe(true);
    }
  });

  it('renders every approved pointed Hebrew sentence and keeps private shelf copy fully pointed', () => {
    expect(STORY_THAT_WAITS_HEBREW_DISPLAY_TEXTS)
      .toBe(STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS);

    for (const story of STORY_THAT_WAITS_STORIES) {
      const titleWords = story.titles['he-IL'].match(HEBREW_WORD_PATTERN) ?? [];
      expect(titleWords.every((word) => hasNiqqud(word))).toBe(true);

      for (const page of story.pages) {
        const utterance = page.utterances['he-IL'];
        const displaySentence = getStoryThatWaitsDisplaySentence(
          story.id,
          page.id,
          'he-IL',
        );
        const accessibilityLabel = getStoryThatWaitsAccessibilityLabel(
          story.id,
          page.id,
          'he-IL',
        );

        expect(displaySentence).toBe(
          STORY_THAT_WAITS_HEBREW_DISPLAY_TEXTS[
            utterance.recordedLookupText as keyof typeof STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS
          ],
        );
        expect(hasNiqqud(utterance.recordedLookupText)).toBe(false);
        expect(accessibilityLabel).toContain(displaySentence);
        expect(accessibilityLabel).toContain(story.titles['he-IL']);
        expect(
          (accessibilityLabel.match(HEBREW_WORD_PATTERN) ?? [])
            .every((word) => hasNiqqud(word)),
        ).toBe(true);
      }
    }

    for (const copy of Object.values(STORY_THAT_WAITS_SHELF_METADATA['he-IL'])) {
      expect(
        (copy.match(HEBREW_WORD_PATTERN) ?? []).every((word) => hasNiqqud(word)),
      ).toBe(true);
    }
  });

  it('includes every pointed Hebrew mapping in the immutable 48-row review inventory', () => {
    const inventory = readFileSync(
      resolve('docs/source/content/story-that-waits-recording-inventory.csv'),
      'utf8',
    );
    const rows = inventory.trimEnd().split('\n');
    const inventoryRows = rows.slice(1).map((row) => row.split(',', 10));
    const requirements = collectStoryThatWaitsRecordingRequirements();

    expect(rows).toHaveLength(49);
    expect(rows[0]).toContain('hebrewProductionText');
    expect(rows[0]).toContain('hebrewReviewStatus');
    expect(inventoryRows).toHaveLength(48);
    expect(new Set(inventoryRows.map((row) => row[1])).size).toBe(48);

    for (const requirement of requirements) {
      const row = inventoryRows.find((candidate) => candidate[1] === requirement.recordingKey);
      expect(row, `missing inventory row for ${requirement.recordingKey}`).toBeDefined();
      expect(row?.slice(0, 8)).toEqual([
        requirement.locale,
        requirement.recordingKey,
        requirement.recordedLookupText,
        requirement.storyId,
        requirement.pageId,
        requirement.actionKind,
        requirement.artIds.join('|'),
        'pending',
      ]);
      if (requirement.locale === 'he-IL') {
        expect(row?.[8]).toBe(
          STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS[
            requirement.recordedLookupText as keyof typeof STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS
          ],
        );
        expect(row?.[9]).toBe('pending-human-review');
      } else {
        expect(row?.[8]).toBe('');
        expect(row?.[9]).toBe('not-applicable');
      }
    }
  });
});
