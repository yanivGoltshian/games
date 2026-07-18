import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectRecordedSpeechCatalog } from './recordedSpeechCatalog';
import { learningConcepts } from './concepts';
import { TOY_PHONE_RECORDING_INVENTORY } from './toyPhone';
import { RECORDED_NARRATION_VOICE_NAMES } from '../domain/narrationVoice';
import {
  getHebrewPronunciationSkeleton,
  hasNiqqud,
  stripNiqqud,
} from './hebrewPronunciation';

interface Manifest {
  version: number;
  voices: Record<string, string>;
  entries: Record<string, {
    src: string;
    offset: number;
    duration: number;
  }>;
}

const nfc = (value: string): string => value.normalize('NFC');

describe('recorded speech asset coverage', () => {
  it('contains one valid offline clip for every catalog phrase and locale', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('public/speech/manifest.json'), 'utf8'),
    ) as Manifest;
    const catalog = collectRecordedSpeechCatalog();
    const expectedKeys = catalog.map(({ locale, text }) => `${locale}\u0000${text}`);

    expect(manifest.version).toBe(2);
    expect(manifest.voices).toEqual(RECORDED_NARRATION_VOICE_NAMES);
    expect(Object.keys(manifest.entries).sort()).toEqual(expectedKeys.sort());
    expect(new Set(Object.values(manifest.entries).map((entry) => entry.src))).toEqual(
      new Set([
        '/speech/he-IL.mp3',
        '/speech/en-US.mp3',
        '/speech/en-GB.mp3',
        '/speech/toy-phone-he-IL-v1.mp3',
        '/speech/toy-phone-en-US-v1.mp3',
        '/speech/toy-phone-en-GB-v1.mp3',
      ]),
    );
    for (const entry of Object.values(manifest.entries)) {
      expect(entry.offset).toBeGreaterThanOrEqual(0);
      expect(entry.duration).toBeGreaterThan(0);
    }
  });

  it('pre-caches the manifest and all six sprites for installed offline use', () => {
    const serviceWorker = readFileSync(resolve('public/sw.js'), 'utf8');

    expect(serviceWorker).toContain("sean-learning-adventure-v23");
    expect(serviceWorker).toContain("'/speech/manifest.json'");
    expect(serviceWorker).toContain("'/speech/he-IL.mp3'");
    expect(serviceWorker).toContain("'/speech/en-US.mp3'");
    expect(serviceWorker).toContain("'/speech/en-GB.mp3'");
    expect(serviceWorker).toContain("'/speech/toy-phone-he-IL-v1.mp3'");
    expect(serviceWorker).toContain("'/speech/toy-phone-en-US-v1.mp3'");
    expect(serviceWorker).toContain("'/speech/toy-phone-en-GB-v1.mp3'");
    for (const concept of learningConcepts) {
      expect(serviceWorker).toContain(`'${concept.image}'`);
    }
  });
});

describe('recorded speech pronunciation layer', () => {
  const catalog = collectRecordedSpeechCatalog();
  const byLocale = (locale: string) => catalog.filter((entry) => entry.locale === locale);

  it('keeps a stable count of 508 unique phrases per locale after adding Toy Phone', () => {
    for (const locale of ['he-IL', 'en-US', 'en-GB']) {
      const entries = byLocale(locale);
      expect(entries).toHaveLength(508);
      const keys = entries.map((entry) => entry.text);
      expect(new Set(keys).size).toBe(508);
    }
  });

  it('gives every Hebrew entry a pointed spokenText that strips back to the source', () => {
    const hebrew = byLocale('he-IL');
    expect(hebrew).toHaveLength(508);
    for (const entry of hebrew) {
      expect(entry.spokenText, `missing spokenText for ${entry.text}`).toBeTruthy();
      const spoken = entry.spokenText as string;
      expect(hasNiqqud(spoken), `no niqqud in "${entry.text}"`).toBe(true);
      expect(nfc(stripNiqqud(spoken)), `strip mismatch for "${entry.text}"`)
        .toBe(getHebrewPronunciationSkeleton(entry.text));
    }
  });

  it('covers every new number-pairs and automatic-progression phrase in all locales', () => {
    const requiredPairs = [
      ['זוגות מספרים', 'Number pairs'],
      ['מתאימים מספרים זהים בשתי שורות', 'Match identical numbers in two rows'],
      ['לחץ על הזוגות', 'Press the pairs'],
      ['עברת שלב!', 'You moved up a level!'],
      ['עכשיו יותר מספרים', 'Now more numbers'],
      ['זכית בגביע!', 'You won a trophy!'],
      ['מעולה!', 'Excellent!'],
      ['בוא נמשיך.', "Let's do it again."],
    ] as const;
    const catalogKeys = new Set(catalog.map((entry) => `${entry.locale}\u0000${entry.text}`));

    for (const [he, en] of requiredPairs) {
      expect(catalogKeys).toContain(`he-IL\u0000${he}`);
      expect(catalogKeys).toContain(`en-US\u0000${en}`);
      expect(catalogKeys).toContain(`en-GB\u0000${en}`);
    }
  });

  it('adds exactly the reviewed Toy Phone phrases on immutable dedicated sprites', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('public/speech/manifest.json'), 'utf8'),
    ) as Manifest;
    expect(Object.keys(manifest.entries)).toHaveLength(1524);

    for (const entry of TOY_PHONE_RECORDING_INVENTORY) {
      expect(manifest.entries[entry.recordingKey]).toMatchObject({
        src: `/speech/toy-phone-${entry.locale}-v1.mp3`,
      });
    }
  });

  it('never points the source text, English entries, or manifest lookup keys', () => {
    for (const entry of catalog) {
      expect(hasNiqqud(entry.text), `source text "${entry.text}" must stay unpointed`).toBe(false);
      if (entry.locale !== 'he-IL') {
        expect(entry.spokenText, `${entry.locale} entries need no spokenText`).toBeUndefined();
      }
    }

    const manifest = JSON.parse(
      readFileSync(resolve('public/speech/manifest.json'), 'utf8'),
    ) as Manifest;
    for (const key of Object.keys(manifest.entries)) {
      expect(hasNiqqud(key), `manifest key "${key}" must stay unpointed`).toBe(false);
    }
  });
});
