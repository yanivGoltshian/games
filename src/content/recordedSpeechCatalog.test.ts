import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectRecordedSpeechCatalog } from './recordedSpeechCatalog';
import { hasNiqqud, stripNiqqud } from './hebrewPronunciation';

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

    expect(serviceWorker).toContain("sean-learning-adventure-v13");
    expect(serviceWorker).toContain("'/speech/manifest.json'");
    expect(serviceWorker).toContain("'/speech/he-IL.mp3'");
    expect(serviceWorker).toContain("'/speech/en-US.mp3'");
    expect(serviceWorker).toContain("'/speech/en-GB.mp3'");
  });
});

describe('recorded speech pronunciation layer', () => {
  const catalog = collectRecordedSpeechCatalog();
  const byLocale = (locale: string) => catalog.filter((entry) => entry.locale === locale);

  it('keeps a stable count of 141 unique phrases per locale', () => {
    for (const locale of ['he-IL', 'en-US', 'en-GB']) {
      const entries = byLocale(locale);
      expect(entries).toHaveLength(141);
      const keys = entries.map((entry) => entry.text);
      expect(new Set(keys).size).toBe(141);
    }
  });

  it('gives every Hebrew entry a pointed spokenText that strips back to the source', () => {
    const hebrew = byLocale('he-IL');
    expect(hebrew).toHaveLength(141);
    for (const entry of hebrew) {
      expect(entry.spokenText, `missing spokenText for ${entry.text}`).toBeTruthy();
      const spoken = entry.spokenText as string;
      expect(hasNiqqud(spoken), `no niqqud in "${entry.text}"`).toBe(true);
      expect(nfc(stripNiqqud(spoken)), `strip mismatch for "${entry.text}"`).toBe(nfc(entry.text));
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
