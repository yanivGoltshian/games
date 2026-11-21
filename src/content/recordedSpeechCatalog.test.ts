import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectRecordedSpeechCatalog } from './recordedSpeechCatalog';
import { GARDEN_DEFAULT_AVATAR, GARDEN_SENTENCES, GARDEN_SENTENCE_SPEECH_LINES } from './gardenSentences';
import { learningConcepts } from './concepts';
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
      ]),
    );
    for (const entry of Object.values(manifest.entries)) {
      expect(entry.offset).toBeGreaterThanOrEqual(0);
      expect(entry.duration).toBeGreaterThan(0);
    }
  });

  it('pre-caches the manifest and three speech sprites for installed offline use', () => {
    const serviceWorker = readFileSync(resolve('public/sw.js'), 'utf8');

    expect(serviceWorker).toContain("sean-learning-adventure-v32");
    expect(serviceWorker).toContain("'/speech/manifest.json'");
    expect(serviceWorker).toContain("'/speech/he-IL.mp3'");
    expect(serviceWorker).toContain("'/speech/en-US.mp3'");
    expect(serviceWorker).toContain("'/speech/en-GB.mp3'");
    const appShell = serviceWorker.match(/const APP_SHELL = \[(.*?)\];/s)?.[1] ?? '';
    expect(appShell).not.toContain('toy-phone');
    expect(appShell).not.toContain('story-that-waits');
    expect(appShell).toContain(`'${GARDEN_DEFAULT_AVATAR}'`);
    const avatar = readFileSync(resolve(`public${GARDEN_DEFAULT_AVATAR}`));
    expect(avatar.toString('ascii', 0, 4)).toBe('RIFF');
    expect(avatar.toString('ascii', 8, 16)).toBe('WEBPVP8L');
    // VP8L stores the alpha-used bit immediately after the two 14-bit dimensions.
    expect(avatar.readUInt32LE(21) >>> 28 & 1).toBe(1);
    expect(appShell).toContain("'/assets/garden/station.webp'");
    expect(serviceWorker).toContain('RETIRED_ASSET_PATHS');
    expect(serviceWorker).toContain('cache.delete(path)');
    expect(serviceWorker).toContain("status: 404");
    for (const concept of learningConcepts) {
      expect(serviceWorker).toContain(`'${concept.image}'`);
    }
    expect(serviceWorker).toContain("'/assets/vocabulary/cherries.webp'");
    expect(serviceWorker).toContain("'/assets/vocabulary/dates.webp'");
    expect(serviceWorker).toContain("'/assets/vocabulary/persimmons.webp'");
    for (const name of ['persimmon', 'dates', 'token', 'watering-can', 'banana', 'banana-bitten']) {
      expect(serviceWorker).toContain(`'/assets/garden/${name}.webp'`);
    }
    for (const { image, aftermath, setting } of GARDEN_SENTENCES) {
      for (const asset of [image, aftermath, setting].filter((path) => path !== undefined)) {
        expect(serviceWorker).toContain(`'${asset}'`);
        expect(readFileSync(resolve(`public${asset}`)).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('recorded speech pronunciation layer', () => {
  const catalog = collectRecordedSpeechCatalog();
  const byLocale = (locale: string) => catalog.filter((entry) => entry.locale === locale);

  it('keeps the approved garden and memory phrases without duplicate recording keys', () => {
    for (const locale of ['he-IL', 'en-US', 'en-GB']) {
      const entries = byLocale(locale);
      expect(entries).toHaveLength(locale === 'he-IL' ? 623 : 626);
      const keys = entries.map((entry) => entry.text);
      expect(new Set(keys).size).toBe(entries.length);
    }
  });

  it('gives every Hebrew entry a pointed spokenText that strips back to the source', () => {
    const hebrew = byLocale('he-IL');
    expect(hebrew).toHaveLength(623);
    for (const entry of hebrew) {
      expect(entry.spokenText, `missing spokenText for ${entry.text}`).toBeTruthy();
      const spoken = entry.spokenText as string;
      expect(hasNiqqud(spoken), `no niqqud in "${entry.text}"`).toBe(true);
      expect(nfc(stripNiqqud(spoken)), `strip mismatch for "${entry.text}"`)
        .toBe(getHebrewPronunciationSkeleton(entry.text));
    }
  });

  it('covers the sentence train prompts and exact actor, action, object and full models in every voice', () => {
    for (const locale of ['he-IL', 'en-US', 'en-GB'] as const) {
      const keys = new Set(byLocale(locale).map(({ text }) => text));
      for (const line of GARDEN_SENTENCE_SPEECH_LINES) {
        expect(keys.has(locale === 'he-IL' ? line.he : line.en), JSON.stringify(line)).toBe(true);
      }
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

  it('includes accurate names and the whole banana sentence in each voice', () => {
    const keys = new Set(catalog.map((entry) => `${entry.locale}\u0000${entry.text}`));
    for (const [he, en] of [
      ['הילד', 'The child'],
      ['אוכל', 'eats'],
      ['בננה', 'a banana'],
      ['הילד אוכל בננה', 'The child eats a banana'],
      ['תמרים', 'dates'],
      ['אסימון', 'token'],
      ['משפך', 'watering can'],
    ]) {
      expect(keys).toContain(`he-IL\u0000${he}`);
      expect(keys).toContain(`en-US\u0000${en}`);
      expect(keys).toContain(`en-GB\u0000${en}`);
    }
  });

  it('covers every emotion label and question in all locales', () => {
    const catalogKeys = new Set(catalog.map((entry) => `${entry.locale}\u0000${entry.text}`));
    const emotions = [
      ['שמח', 'happy'],
      ['עצוב', 'sad'],
      ['בוכה', 'crying'],
      ['כועס', 'angry'],
      ['מופתע', 'surprised'],
      ['מפחד', 'scared'],
    ] as const;

    for (const [hebrew, english] of emotions) {
      expect(catalogKeys).toContain(`he-IL\u0000${hebrew}`);
      expect(catalogKeys).toContain(`he-IL\u0000איפה ${hebrew}?`);
      expect(catalogKeys).toContain(`en-US\u0000${english}`);
      expect(catalogKeys).toContain(`en-US\u0000Where is ${english}?`);
      expect(catalogKeys).toContain(`en-GB\u0000${english}`);
      expect(catalogKeys).toContain(`en-GB\u0000Where is ${english}?`);
    }
  });

  it('contains exactly the current 1,875 clips and no retired sprites', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('public/speech/manifest.json'), 'utf8'),
    ) as Manifest;
    expect(Object.keys(manifest.entries)).toHaveLength(1875);
    expect(JSON.stringify(manifest.entries)).not.toContain('toy-phone');
    expect(JSON.stringify(manifest.entries)).not.toContain('story-that-waits');
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
