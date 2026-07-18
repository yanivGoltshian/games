import { describe, expect, it } from 'vitest';
import {
  createCommunicationLocaleLock,
  type CommunicationGameScope,
} from '../domain/communicationGame';
import {
  CommunicationAssetReadinessService,
  validateCommunicationAssetReadiness,
  type CommunicationContentRequirements,
} from './communicationAssetReadiness';
import { recordedSpeechManifestKey, type RecordedSpeechManifest } from './recordedSpeech';

const scope: CommunicationGameScope = {
  activityId: 'story',
  sessionId: 'session-1',
  roundId: 'round-1',
  stepId: 'step-1',
};

function requirements(): CommunicationContentRequirements {
  return {
    contentVersion: 'pack-7',
    scope,
    locale: 'he-IL',
    localeLock: createCommunicationLocaleLock(scope, 'he-IL'),
    recordingKeys: ['מילה שלמה', 'משפט שלם'],
    images: [
      { kind: 'id', value: 'dog' },
      { kind: 'url', value: '/packs/story/scene-1.webp' },
    ],
  };
}

const manifest: RecordedSpeechManifest = {
  version: 2,
  entries: {
    [recordedSpeechManifestKey('he-IL', 'מילה שלמה')]: {
      src: '/speech/he-IL.mp3',
      offset: 0,
      duration: 1,
    },
    [recordedSpeechManifestKey('he-IL', 'משפט שלם')]: {
      src: '/speech/he-IL.mp3',
      offset: 1.2,
      duration: 2,
    },
    [recordedSpeechManifestKey('en-US', 'whole word')]: {
      src: '/speech/en-US.mp3',
      offset: 0,
      duration: 1,
    },
  },
};

describe('communication asset readiness', () => {
  it('starts only when content version, exact locale recordings, and images are installed', () => {
    expect(validateCommunicationAssetReadiness(
      requirements(),
      {
        contentVersion: 'pack-7',
        images: [
          { kind: 'id', value: 'dog' },
          { kind: 'url', value: '/packs/story/scene-1.webp' },
        ],
      },
      manifest,
    )).toEqual({
      status: 'ready',
      contentVersion: 'pack-7',
      locale: 'he-IL',
    });
  });

  it('reports every missing mandatory asset without locale substitution or partial readiness', () => {
    const result = validateCommunicationAssetReadiness(
      {
        ...requirements(),
        recordingKeys: ['missing'],
      },
      {
        contentVersion: 'pack-6',
        images: [{ kind: 'id', value: 'dog' }],
      },
      manifest,
    );

    expect(result.status).toBe('not-ready');
    if (result.status === 'not-ready') {
      expect(result.issues.map((issue) => issue.code)).toEqual([
        'content-version-mismatch',
        'missing-recording',
        'missing-image',
      ]);
      expect(result.issues.every((issue) => issue.childSafeCode === 'content-unavailable')).toBe(true);
      expect(result.issues.map((issue) => issue.diagnostic).join(' ')).not.toContain('en-US');
    }
  });

  it('rejects a locale that differs from the natural unit lock', () => {
    const result = validateCommunicationAssetReadiness(
      {
        ...requirements(),
        locale: 'en-US',
      },
      {
        contentVersion: 'pack-7',
        images: requirements().images,
      },
      manifest,
    );

    expect(result).toMatchObject({
      status: 'not-ready',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'locale-mismatch' }),
        expect.objectContaining({ code: 'missing-recording' }),
      ]),
    });
  });

  it('keeps string-only recording requirements source-agnostic', () => {
    const result = validateCommunicationAssetReadiness(
      requirements(),
      {
        contentVersion: 'pack-7',
        images: requirements().images,
      },
      {
        version: 2,
        entries: {
          [recordedSpeechManifestKey('he-IL', 'מילה שלמה')]: {
            src: '/speech/other-he-IL.mp3',
            offset: 0,
            duration: 1,
          },
          [recordedSpeechManifestKey('he-IL', 'משפט שלם')]: {
            src: '/speech/other-he-IL.mp3',
            offset: 1.2,
            duration: 2,
          },
        },
      },
    );

    expect(result.status).toBe('ready');
  });

  it('requires an exact immutable src when a recording requirement declares one', () => {
    const result = validateCommunicationAssetReadiness(
      {
        ...requirements(),
        recordingKeys: [
          { text: 'מילה שלמה', expectedSrc: '/speech/story-he-IL-v1.mp3' },
          { text: 'משפט שלם', expectedSrc: '/speech/story-he-IL-v1.mp3' },
        ],
      },
      {
        contentVersion: 'pack-7',
        images: requirements().images,
      },
      {
        version: 2,
        entries: {
          [recordedSpeechManifestKey('he-IL', 'מילה שלמה')]: {
            src: '/speech/story-he-IL-v1.mp3',
            offset: 0,
            duration: 1,
          },
          [recordedSpeechManifestKey('he-IL', 'משפט שלם')]: {
            src: '/speech/he-IL.mp3',
            offset: 1.2,
            duration: 2,
          },
        },
      },
    );

    expect(result).toMatchObject({
      status: 'not-ready',
      issues: [
        expect.objectContaining({
          code: 'invalid-recording',
          asset: 'משפט שלם',
        }),
      ],
    });
  });

  it('requires exact own data properties and never invokes manifest clip getters', () => {
    const exactKey = recordedSpeechManifestKey('he-IL', 'מילה שלמה');
    const accessorKey = recordedSpeechManifestKey('he-IL', 'משפט שלם');
    const inheritedEntries = Object.create({
      [exactKey]: {
        src: '/speech/story-he-IL-v1.mp3',
        offset: 0,
        duration: 1,
      },
    }) as RecordedSpeechManifest['entries'];
    Object.defineProperty(inheritedEntries, accessorKey, {
      enumerable: true,
      get: () => {
        throw new Error('manifest entry getter must not be invoked');
      },
    });

    const result = validateCommunicationAssetReadiness(
      {
        ...requirements(),
        recordingKeys: [
          { text: 'מילה שלמה', expectedSrc: '/speech/story-he-IL-v1.mp3' },
          { text: 'משפט שלם', expectedSrc: '/speech/story-he-IL-v1.mp3' },
        ],
      },
      {
        contentVersion: 'pack-7',
        images: requirements().images,
      },
      {
        version: 2,
        entries: inheritedEntries,
      },
    );

    expect(result).toMatchObject({
      status: 'not-ready',
      issues: [
        expect.objectContaining({ code: 'missing-recording', asset: 'מילה שלמה' }),
        expect.objectContaining({ code: 'invalid-recording', asset: 'משפט שלם' }),
      ],
    });
  });

  it('rejects malformed clips without blocking a valid sibling requirement', () => {
    const malformedManifest = {
      version: 2,
      entries: {
        [recordedSpeechManifestKey('he-IL', 'מילה שלמה')]: {
          src: '/speech/story-he-IL-v1.mp3',
          offset: 0,
          duration: 1,
        },
        [recordedSpeechManifestKey('he-IL', 'משפט שלם')]: 'not-a-clip',
      },
    } as unknown as RecordedSpeechManifest;

    const validSibling = validateCommunicationAssetReadiness(
      {
        ...requirements(),
        recordingKeys: [{ text: 'מילה שלמה', expectedSrc: '/speech/story-he-IL-v1.mp3' }],
      },
      {
        contentVersion: 'pack-7',
        images: requirements().images,
      },
      malformedManifest,
    );
    const mixed = validateCommunicationAssetReadiness(
      {
        ...requirements(),
        recordingKeys: [
          { text: 'מילה שלמה', expectedSrc: '/speech/story-he-IL-v1.mp3' },
          { text: 'משפט שלם', expectedSrc: '/speech/story-he-IL-v1.mp3' },
        ],
      },
      {
        contentVersion: 'pack-7',
        images: requirements().images,
      },
      malformedManifest,
    );

    expect(validSibling.status).toBe('ready');
    expect(mixed).toMatchObject({
      status: 'not-ready',
      issues: [
        expect.objectContaining({ code: 'invalid-recording', asset: 'משפט שלם' }),
      ],
    });
  });

  it('reports an unavailable installed catalog as a typed nonfatal result', async () => {
    const service = new CommunicationAssetReadinessService(async () => {
      throw new Error('manifest offline');
    });

    await expect(service.validate(requirements(), {
      contentVersion: 'pack-7',
      images: requirements().images,
    })).resolves.toMatchObject({
      status: 'not-ready',
      issues: [expect.objectContaining({
        code: 'catalog-unavailable',
        diagnostic: 'manifest offline',
      })],
    });
  });
});
