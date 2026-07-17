import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectRecordedSpeechCatalog } from './recordedSpeechCatalog';
import { learningConcepts } from './concepts';
import {
  getHebrewPronunciationSkeleton,
  hasNiqqud,
  stripNiqqud,
} from './hebrewPronunciation';

interface Manifest {
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

    expect(Object.keys(manifest.entries).sort()).toEqual(expectedKeys.sort());
    expect(new Set(Object.values(manifest.entries).map((entry) => entry.src))).toEqual(
      new Set(['/speech/he-IL.mp3', '/speech/en-US.mp3', '/speech/en-GB.mp3']),
    );
    for (const entry of Object.values(manifest.entries)) {
      expect(entry.offset).toBeGreaterThanOrEqual(0);
      expect(entry.duration).toBeGreaterThan(0);
    }
  });

  it('pre-caches the manifest and all three sprites for installed offline use', () => {
    const serviceWorker = readFileSync(resolve('public/sw.js'), 'utf8');

    expect(serviceWorker).toContain("sean-learning-adventure-v17");
    expect(serviceWorker).toContain("'/speech/manifest.json'");
    expect(serviceWorker).toContain("'/speech/he-IL.mp3'");
    expect(serviceWorker).toContain("'/speech/en-US.mp3'");
    expect(serviceWorker).toContain("'/speech/en-GB.mp3'");
    for (const concept of learningConcepts) {
      expect(serviceWorker).toContain(`'${concept.image}'`);
    }
  });
});

describe('recorded speech pronunciation layer', () => {
  const catalog = collectRecordedSpeechCatalog();
  const byLocale = (locale: string) => catalog.filter((entry) => entry.locale === locale);

  it('keeps a stable count of 490 unique phrases per locale', () => {
    for (const locale of ['he-IL', 'en-US', 'en-GB']) {
      const entries = byLocale(locale);
      expect(entries).toHaveLength(490);
      const keys = entries.map((entry) => entry.text);
      expect(new Set(keys).size).toBe(490);
    }
  });

  it('gives every Hebrew entry a pointed spokenText that strips back to the source', () => {
    const hebrew = byLocale('he-IL');
    expect(hebrew).toHaveLength(490);
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
