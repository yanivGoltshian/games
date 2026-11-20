import { describe, expect, it } from 'vitest';
import { collectRecordedSpeechCatalog } from './recordedSpeechCatalog';
import {
  GARDEN_CONNECTORS,
  GARDEN_CHILDREN,
  GARDEN_ASK,
  GARDEN_BANANA_SENTENCE,
  GARDEN_BANANA_WORDS,
  GARDEN_EFFORT,
  GARDEN_FRUITS,
  GARDEN_INVITATION,
  GARDEN_PERSIMMON_IMAGE,
  GARDEN_PERSIMMON_WORD,
  GARDEN_STAGES,
  gardenChildPhrase,
  gardenPhrase,
  gardenSegments,
} from './wordGarden';
import { hasNiqqud, stripNiqqud } from './hebrewPronunciation';

describe('word garden recorded language', () => {
  it('models three words before four-word expansions for every ordered fruit pair', () => {
    const catalog = collectRecordedSpeechCatalog();
    const keys = new Set(catalog.map(({ locale, text }) => `${locale}:${text}`));
    const lines = [GARDEN_INVITATION, GARDEN_EFFORT, GARDEN_ASK, GARDEN_PERSIMMON_WORD];
    expect(GARDEN_STAGES.map((stage) => stage.id)).toEqual([
      'arrive', 'ask', 'receive', 'exchange', 'accept',
      'pick', 'put', 'carry', 'wash', 'smell', 'taste', 'share',
      'seed', 'bury', 'cover', 'water', 'sun', 'sprout', 'tree', 'flower', 'fruit',
    ]);
    for (const stage of GARDEN_STAGES) {
      lines.push(stage.line, stage.expanded);
      expect(stage.line.he.split(' '), stage.id).toHaveLength(3);
      expect(stage.expanded.he.split(' '), stage.id).toHaveLength(4);
      expect(stage.line.en.length, stage.id).toBeGreaterThan(0);
      expect(stage.expanded.en.length, stage.id).toBeGreaterThan(0);
    }
    expect(GARDEN_STAGES.find((stage) => stage.id === 'water')?.expanded.he)
      .toBe('מים מרטיבים את הזרע');
    expect(GARDEN_STAGES.find((stage) => stage.id === 'seed')?.expanded.he).toContain('מאפרסמון');
    expect(GARDEN_STAGES.find((stage) => stage.id === 'fruit')?.line.he).toContain('אפרסמונים');
    expect(GARDEN_STAGES.find((stage) => stage.id === 'arrive')?.expanded.en)
      .toBe('The gardener arrives with a basket');
    expect(GARDEN_STAGES.find((stage) => stage.id === 'receive')?.expanded.en)
      .toBe('Sean receives a persimmon from the gardener');
    expect(GARDEN_STAGES.find((stage) => stage.id === 'share')?.expanded)
      .toMatchObject({ he: 'נועה נותנת תמרים להדר', en: 'Noa gives dates to Hadar' });
    expect(GARDEN_STAGES.find((stage) => stage.id === 'sprout')?.expanded)
      .toMatchObject({ he: 'מהגרעין צומח נבט ירוק', en: 'A green sprout grows from the seed' });
    expect(GARDEN_STAGES.find((stage) => stage.id === 'seed')?.line.en)
      .toBe('Sean takes out a seed');
    expect(GARDEN_PERSIMMON_IMAGE).toBe('/assets/vocabulary/persimmons.webp');
    for (const first of GARDEN_FRUITS) {
      const base = gardenPhrase(first);
      lines.push(base);
      expect(base.he.split(' ')).toHaveLength(3);
      expect(base.en.split(' ')).toHaveLength(3);
      for (const child of GARDEN_CHILDREN) {
        const named = gardenChildPhrase(child, first);
        lines.push(named);
        expect(named.he.split(' ')).toHaveLength(3);
        expect(named.en).toBe(`${child.en} chooses ${first.en}`);
        expect(named.he).toContain(child.verbHe);
      }
      for (const second of GARDEN_FRUITS) {
        if (first.id === second.id) continue;
        for (const child of GARDEN_CHILDREN) {
          const named = gardenChildPhrase(child, first, second);
          lines.push(named);
          expect(named.he.split(' ')).toHaveLength(4);
          expect(named.en).toBe(`${child.en} also chooses ${second.en}`);
          expect(named.he).toContain(`גם ${second.he}`);
        }
        for (const connector of GARDEN_CONNECTORS) {
          const expanded = gardenPhrase(first, second, connector);
          lines.push(expanded);
          expect(expanded.he.split(' '), expanded.he).toHaveLength(4);
          expect(expanded.en.toLowerCase()).toContain(first.en);
          expect(expanded.en.toLowerCase()).toContain(second.en);
          if (connector === 'and') expect(expanded.en).toBe(`I want ${first.en} and ${second.en}`);
          if (connector === 'with') expect(expanded.en).toBe(`${first.en[0]!.toUpperCase()}${first.en.slice(1)} with ${second.en} in the cart`);
          expect(expanded.he).toContain(first.he);
          expect(expanded.he).toContain(second.he);
        }
        expect(GARDEN_CHILDREN.find((child) => child.id === 'noa')?.verbHe).toBe('בוחרת');
      }
    }

    for (const line of lines) {
      expect(hasNiqqud(line.spokenHe), line.he).toBe(true);
      expect(stripNiqqud(line.spokenHe).normalize('NFC'), line.he).toBe(line.he.normalize('NFC'));
      for (const [locale, text] of [
        ['he-IL', line.he],
        ['en-US', line.en],
        ['en-GB', line.en],
      ]) {
        expect(keys.has(`${locale}:${text}`), `${locale}: ${text}`).toBe(true);
      }
    }
  });

  it('speaks only the active language, or both languages in sequence', () => {
    const line = gardenPhrase(GARDEN_FRUITS[0]!);
    expect(gardenSegments(line, 'he', 'en-GB').map((item) => item.text)).toEqual([line.he]);
    expect(gardenSegments(line, 'en', 'en-GB')).toEqual([{ text: line.en, locale: 'en-GB' }]);
    expect(gardenSegments(line, 'bilingual', 'en-US').map((item) => item.locale))
      .toEqual(['he-IL', 'en-US']);
  });

  it('builds a three-part banana turn with a faithful full sentence', () => {
    expect(GARDEN_BANANA_WORDS.map((part) => part.he)).toEqual(['הילד', 'אוכל', 'בננה']);
    expect(GARDEN_BANANA_SENTENCE.he).toBe('הילד אוכל בננה');
    expect(GARDEN_BANANA_SENTENCE.en).toBe('The child eats a banana');
    expect(stripNiqqud(GARDEN_BANANA_SENTENCE.spokenHe)).toBe(GARDEN_BANANA_SENTENCE.he);
  });
});
