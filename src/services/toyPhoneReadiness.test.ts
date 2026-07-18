import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOY_PHONE_RECORDING_INVENTORY } from '../content/toyPhone';
import type { CommunicationGameScope } from '../domain/communicationGame';
import type { RecordedSpeechManifest } from './recordedSpeech';
import { validateToyPhoneContentReadiness } from './toyPhoneReadiness';

const scope: CommunicationGameScope = {
  activityId: 'toy-phone',
  sessionId: 'session-1',
  roundId: 'readiness',
  stepId: 'all-recordings',
};

function toySpriteSrc(locale: string): string {
  return `/speech/toy-phone-${locale}-v1.mp3`;
}

function completeManifest(): RecordedSpeechManifest {
  return {
    version: 2,
    entries: Object.fromEntries(TOY_PHONE_RECORDING_INVENTORY.map((entry, index) => [
      entry.recordingKey,
      {
        src: toySpriteSrc(entry.locale),
        offset: index,
        duration: 1,
      },
    ])),
  };
}

function stale1fddToyManifest(): RecordedSpeechManifest {
  return {
    version: 2,
    entries: Object.fromEntries(TOY_PHONE_RECORDING_INVENTORY.map((entry, index) => [
      entry.recordingKey,
      {
        src: `/speech/${entry.locale}.mp3`,
        offset: 1_249 + index,
        duration: 1,
      },
    ])),
  };
}

describe('Toy Phone production readiness', () => {
  it('requires all 54 exact-locale recordings', () => {
    expect(validateToyPhoneContentReadiness(scope, completeManifest())).toEqual({
      status: 'ready',
      contentVersion: 'toy-phone-v1',
    });
  });

  it('fails global readiness when one exact recording is missing', () => {
    const manifest = completeManifest();
    const missing = TOY_PHONE_RECORDING_INVENTORY[37]!;
    delete manifest.entries[missing.recordingKey];

    const result = validateToyPhoneContentReadiness(scope, manifest);
    expect(result.status).toBe('not-ready');
    if (result.status === 'not-ready') {
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: 'missing-recording',
          asset: missing.text,
        }),
      ]);
    }
  });

  it('rejects the stale 1fdd manifest shape with all 54 Toy keys on legacy sprites', () => {
    const result = validateToyPhoneContentReadiness(scope, stale1fddToyManifest());

    expect(result).toMatchObject({
      status: 'not-ready',
      contentVersion: 'toy-phone-v1',
    });
    if (result.status === 'not-ready') {
      expect(result.issues).toHaveLength(54);
      expect(result.issues.every((issue) => issue.code === 'invalid-recording')).toBe(true);
    }
  });

  it.each([
    ['legacy', '/speech/he-IL.mp3'],
    ['wrong locale', '/speech/toy-phone-en-US-v1.mp3'],
    ['wrong case', '/speech/toy-phone-he-il-v1.mp3'],
    ['query string', '/speech/toy-phone-he-IL-v1.mp3?v=1'],
    ['cross origin', 'https://example.test/speech/toy-phone-he-IL-v1.mp3'],
  ])('rejects %s Toy src values', (_name, badSrc) => {
    const manifest = completeManifest();
    const entry = TOY_PHONE_RECORDING_INVENTORY.find((candidate) => candidate.locale === 'he-IL')!;
    manifest.entries[entry.recordingKey] = {
      src: badSrc,
      offset: 0,
      duration: 1,
    };

    const result = validateToyPhoneContentReadiness(scope, manifest);
    expect(result).toMatchObject({
      status: 'not-ready',
      issues: [expect.objectContaining({
        code: 'invalid-recording',
        asset: entry.text,
      })],
    });
  });

  it('requires Toy clips to be own data objects with own src data properties', () => {
    const first = TOY_PHONE_RECORDING_INVENTORY[0]!;
    const second = TOY_PHONE_RECORDING_INVENTORY[1]!;
    const third = TOY_PHONE_RECORDING_INVENTORY[2]!;
    const fourth = TOY_PHONE_RECORDING_INVENTORY[3]!;
    const fifth = TOY_PHONE_RECORDING_INVENTORY[4]!;
    const entries = Object.create({
      [first.recordingKey]: {
        src: toySpriteSrc(first.locale),
        offset: 0,
        duration: 1,
      },
    }) as RecordedSpeechManifest['entries'];
    Object.assign(entries, completeManifest().entries);
    delete entries[first.recordingKey];
    entries[second.recordingKey] = 'not-a-clip' as unknown as RecordedSpeechManifest['entries'][string];
    entries[third.recordingKey] = Object.create({
      src: toySpriteSrc(third.locale),
      offset: 0,
      duration: 1,
    }) as RecordedSpeechManifest['entries'][string];
    Object.defineProperty(entries, fourth.recordingKey, {
      enumerable: true,
      get: () => {
        throw new Error('Toy manifest getter must not be invoked');
      },
    });
    Object.defineProperty(entries[fifth.recordingKey]!, 'src', {
      enumerable: true,
      get: () => {
        throw new Error('Toy clip src getter must not be invoked');
      },
    });

    const result = validateToyPhoneContentReadiness(scope, { version: 2, entries });
    expect(result).toMatchObject({
      status: 'not-ready',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'missing-recording', asset: first.text }),
        expect.objectContaining({ code: 'invalid-recording', asset: second.text }),
        expect.objectContaining({ code: 'invalid-recording', asset: third.text }),
        expect.objectContaining({ code: 'invalid-recording', asset: fourth.text }),
        expect.objectContaining({ code: 'invalid-recording', asset: fifth.text }),
      ]),
    });
  });

  it('accepts the production pack only when all 54 exact recordings are installed', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('public/speech/manifest.json'), 'utf8'),
    ) as RecordedSpeechManifest;
    const result = validateToyPhoneContentReadiness(scope, manifest);
    expect(result).toEqual({
      status: 'ready',
      contentVersion: 'toy-phone-v1',
    });
    for (const entry of TOY_PHONE_RECORDING_INVENTORY) {
      expect(manifest.entries).toHaveProperty(entry.recordingKey);
      expect(manifest.entries[entry.recordingKey]?.src).toBe(toySpriteSrc(entry.locale));
    }
  });
});
