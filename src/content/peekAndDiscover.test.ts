import { describe, expect, it } from 'vitest';
import { createInitialCommunicationProgress } from '../domain/communicationProgress';
import { createCommunicationLocaleLock, type CommunicationGameScope } from '../domain/communicationGame';
import type { ToddlerSettings } from '../domain/types';
import {
  validateCommunicationAssetReadiness,
  type CommunicationContentRequirements,
} from '../services/communicationAssetReadiness';
import { recordedSpeechManifestKey, type RecordedSpeechManifest } from '../services/recordedSpeech';
import { learningConcepts } from './concepts';
import {
  PEEK_AND_DISCOVER_CONTENT,
  PEEK_AND_DISCOVER_CONTENT_VERSION,
  PEEK_AND_DISCOVER_INSTALLED_CONTENT,
  buildPeekAndDiscoverMandatorySegment,
  buildPeekAndDiscoverReadinessRequirements,
  buildPeekAndDiscoverRound,
  resolvePeekAndDiscoverLocale,
  selectPeekAndDiscoverContent,
} from './peekAndDiscover';

const scope: CommunicationGameScope = {
  activityId: 'peek-and-discover',
  sessionId: 'session-1',
  roundId: 'round-1',
  stepId: 'step-1',
};

const settings: ToddlerSettings = {
  childName: 'Sean',
  languageMode: 'bilingual',
  englishVoiceLocale: 'en-US',
  soundLevel: 0.7,
  reducedMotion: false,
  quietMode: false,
};

function buildRequirements(
  locale: 'he-IL' | 'en-US',
  word: string,
): CommunicationContentRequirements {
  return {
    contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
    scope,
    locale,
    localeLock: createCommunicationLocaleLock(scope, locale),
    recordingKeys: [word],
    images: [{ kind: 'url', value: '/assets/example.webp' }],
  };
}

function buildManifest(entries: Array<readonly ['he-IL' | 'en-US' | 'en-GB', string]>): RecordedSpeechManifest {
  return {
    version: 1,
    entries: Object.fromEntries(entries.map(([locale, word], index) => [
      recordedSpeechManifestKey(locale, word),
      {
        src: `/speech/${locale}.mp3`,
        offset: index,
        duration: 1,
      },
    ])),
  };
}

describe('peek and discover content', () => {
  it('adapts all 21 existing learning concepts with the existing image urls only', () => {
    expect(PEEK_AND_DISCOVER_CONTENT).toHaveLength(21);
    expect(PEEK_AND_DISCOVER_CONTENT.map((item) => item.id)).toEqual(
      learningConcepts.map((concept) => concept.id),
    );
    expect(PEEK_AND_DISCOVER_CONTENT.map((item) => item.imageUrl)).toEqual(
      learningConcepts.map((concept) => concept.image),
    );
    expect(PEEK_AND_DISCOVER_INSTALLED_CONTENT.images).toEqual(
      learningConcepts.map((concept) => ({ kind: 'url', value: concept.image })),
    );
  });

  it('builds exactly one exact-word recorded segment for every supported locale', () => {
    const banana = PEEK_AND_DISCOVER_CONTENT.find((item) => item.id === 'banana');
    expect(banana).toBeDefined();
    if (!banana) {
      return;
    }

    expect(buildPeekAndDiscoverMandatorySegment(banana, 'he-IL')).toEqual([
      { text: 'בננה', locale: 'he-IL', recordedText: 'בננה' },
    ]);
    expect(buildPeekAndDiscoverMandatorySegment(banana, 'en-US')).toEqual([
      { text: 'banana', locale: 'en-US', recordedText: 'banana' },
    ]);
    expect(buildPeekAndDiscoverMandatorySegment(banana, 'en-GB')).toEqual([
      { text: 'banana', locale: 'en-GB', recordedText: 'banana' },
    ]);
  });

  it('resolves locale locks per settings and alternates bilingual rounds from Hebrew to English', () => {
    expect(resolvePeekAndDiscoverLocale({ languageMode: 'he', englishVoiceLocale: 'en-US' }, 0)).toBe('he-IL');
    expect(resolvePeekAndDiscoverLocale({ languageMode: 'en', englishVoiceLocale: 'en-GB' }, 0)).toBe('en-GB');
    expect(resolvePeekAndDiscoverLocale({ languageMode: 'bilingual', englishVoiceLocale: 'en-US' }, 0)).toBe('he-IL');
    expect(resolvePeekAndDiscoverLocale({ languageMode: 'bilingual', englishVoiceLocale: 'en-US' }, 1)).toBe('en-US');
    expect(resolvePeekAndDiscoverLocale({ languageMode: 'bilingual', englishVoiceLocale: 'en-GB' }, 3)).toBe('en-GB');
  });

  it('stores the current round locale lock so settings changes affect only the next object', () => {
    const progress = createInitialCommunicationProgress(PEEK_AND_DISCOVER_CONTENT_VERSION);
    const firstRound = buildPeekAndDiscoverRound({
      scope,
      progress,
      settings,
      roundIndex: 0,
      previousCategory: null,
    });
    const secondRound = buildPeekAndDiscoverRound({
      scope: { ...scope, roundId: 'round-2', stepId: 'step-2' },
      progress,
      settings: { ...settings, englishVoiceLocale: 'en-GB' },
      roundIndex: 1,
      previousCategory: firstRound.content.category,
    });

    expect(firstRound.locale).toBe('he-IL');
    expect(firstRound.localeLock.locale).toBe('he-IL');
    expect(secondRound.locale).toBe('en-GB');
    expect(secondRound.localeLock.locale).toBe('en-GB');
    expect(firstRound.localeLock.locale).toBe('he-IL');
  });

  it('prefers non-recent content first, then a different category, then the deterministic scan order', () => {
    const progress = createInitialCommunicationProgress(PEEK_AND_DISCOVER_CONTENT_VERSION);
    const first = selectPeekAndDiscoverContent({
      progress,
      selectionIndex: 0,
      previousCategory: null,
    });
    expect(first.id).toBe('ball');

    const second = selectPeekAndDiscoverContent({
      progress: {
        ...progress,
        recentContentIds: ['ball', 'car'],
      },
      selectionIndex: 0,
      previousCategory: 'transport',
    });
    expect(second.id).toBe('banana');
    expect(second.category).not.toBe('transport');

    const fallbackToRecent = selectPeekAndDiscoverContent({
      progress: {
        ...progress,
        recentContentIds: learningConcepts.map((concept) => concept.id),
      },
      selectionIndex: 17,
      previousCategory: 'transport',
    });
    expect(fallbackToRecent.id).toBe('flower');
  });

  it('builds readiness requirements with exactly one selected image url and exact recording key', () => {
    const round = buildPeekAndDiscoverRound({
      scope,
      progress: createInitialCommunicationProgress(PEEK_AND_DISCOVER_CONTENT_VERSION),
      settings,
      roundIndex: 0,
      previousCategory: null,
    });

    expect(buildPeekAndDiscoverReadinessRequirements(round)).toEqual({
      contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
      scope,
      locale: 'he-IL',
      localeLock: round.localeLock,
      recordingKeys: [round.exactWord],
      images: [{ kind: 'url', value: round.content.imageUrl }],
    });
  });

  it('validates exact readiness and rejects missing image, recording, or catalog substitutions', () => {
    const round = buildPeekAndDiscoverRound({
      scope,
      progress: createInitialCommunicationProgress(PEEK_AND_DISCOVER_CONTENT_VERSION),
      settings,
      roundIndex: 0,
      previousCategory: null,
    });
    const manifest = buildManifest([
      ['he-IL', round.exactWord],
      ['en-US', 'banana'],
      ['en-GB', 'banana'],
    ]);

    expect(validateCommunicationAssetReadiness(
      round.readiness,
      {
        contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
        images: [{ kind: 'url', value: round.content.imageUrl }],
      },
      manifest,
    )).toEqual({
      status: 'ready',
      contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
      locale: round.locale,
    });

    const missingImage = validateCommunicationAssetReadiness(
      round.readiness,
      {
        contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
        images: [],
      },
      manifest,
    );
    expect(missingImage).toMatchObject({
      status: 'not-ready',
      issues: [expect.objectContaining({ code: 'missing-image' })],
    });

    const missingRecording = validateCommunicationAssetReadiness(
      {
        ...round.readiness,
        recordingKeys: ['not-the-word'],
      },
      {
        contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
        images: [{ kind: 'url', value: round.content.imageUrl }],
      },
      manifest,
    );
    expect(missingRecording).toMatchObject({
      status: 'not-ready',
      issues: [expect.objectContaining({ code: 'missing-recording' })],
    });

    const localeMismatch = validateCommunicationAssetReadiness(
      {
        ...buildRequirements('en-US', 'banana'),
        localeLock: createCommunicationLocaleLock(scope, 'he-IL'),
      },
      {
        contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
        images: [{ kind: 'url', value: '/assets/example.webp' }],
      },
      buildManifest([['en-US', 'banana']]),
    );
    expect(localeMismatch).toMatchObject({
      status: 'not-ready',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'locale-mismatch' }),
      ]),
    });
  });
});
