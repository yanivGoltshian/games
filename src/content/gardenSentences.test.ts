import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GARDEN_DRAWINGS, GARDEN_SENTENCES, getGardenVoiceKey, makeGardenVisit } from './gardenSentences';

describe('Garden story visits', () => {
  it('shuffles whole episodes, never repeats the last opening, and keeps growth chronological', () => {
    const firsts = new Set<string>();
    let last: string | undefined;
    for (let seed = 1; seed <= 48; seed++) {
      const visit = makeGardenVisit(last, seed);
      expect(visit[0]!.story).not.toBe(last);
      last = visit[0]!.story;
      firsts.add(last);
      expect(new Set(visit.map(b => b.id)).size).toBe(24);
      for (let i = 0; i < visit.length; i += 4) {
        const episode = visit.slice(i, i + 4);
        expect(episode).toEqual(GARDEN_SENTENCES.filter(b => b.story === episode[0]!.story));
        expect(episode[0]?.words[0].he).toBe('שון');
        expect(episode.some(b => !b.isSean && b.art.subject)).toBe(true);
        expect(episode.some(b => b.connector)).toBe(true);
      }
    }
    expect(firsts.size).toBe(6);
    expect(GARDEN_SENTENCES.filter(b => b.story === 'avocado').map(b => b.id))
      .toEqual(['avocado-water', 'avocado-root', 'avocado-shoot', 'avocado-soil']);
    expect(GARDEN_SENTENCES.find(b => b.id === 'date-palm')?.model.he).toBe('עם השנים הנבט גדל והופך לדקל');
  });
  it('reuses unchanged legacy recordings only, and invalidates a changed sentence in its own language', () => {
    for (const b of GARDEN_SENTENCES) {
      for (const lang of ['he', 'en'] as const) {
        const key = getGardenVoiceKey(b, lang);
        if (['banana', 'dates'].includes(b.id)) expect(key).toBe(`${b.id}:sean:${lang}`);
        else expect(key).not.toBe(`${b.id}:sean:${lang}`);
        expect(getGardenVoiceKey({ ...b, model: { ...b.model, [lang]: 'edited' } }, lang)).not.toBe(key);
      }
    }
  });
  it('ships real bundled drawings and paintings for each subject and object, including offline', () => {
    const symbols = readFileSync(`public${GARDEN_DRAWINGS}`, 'utf8');
    const sw = readFileSync('public/sw.js', 'utf8');
    expect(sw).toContain(`'${GARDEN_DRAWINGS}'`);
    for (const { art, isSean } of GARDEN_SENTENCES) {
      if (!isSean) expect(art.subject).toBeTruthy();
      for (const src of [art.subject, art.object, art.setting, art.aftermath]) {
        if (!src) continue;
        if (src.startsWith('#')) expect(symbols).toContain(`id="${src.slice(1)}"`);
        else expect(sw).toContain(`'${src}'`);
      }
    }
  });
});
