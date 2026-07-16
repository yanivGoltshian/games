import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectRecordedSpeechCatalog } from './recordedSpeechCatalog';

interface Manifest {
  entries: Record<string, {
    src: string;
    offset: number;
    duration: number;
  }>;
}

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

    expect(serviceWorker).toContain("sean-learning-adventure-v11");
    expect(serviceWorker).toContain("'/speech/manifest.json'");
    expect(serviceWorker).toContain("'/speech/he-IL.mp3'");
    expect(serviceWorker).toContain("'/speech/en-US.mp3'");
    expect(serviceWorker).toContain("'/speech/en-GB.mp3'");
  });
});
