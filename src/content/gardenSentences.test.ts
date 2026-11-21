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
      expect(new Set(visit.map(b => b.id)).size).toBe(22);
      for (let i = 0; i < visit.length;) {
        const episode = GARDEN_SENTENCES.filter(b => b.story === visit[i]!.story);
        expect(visit.slice(i, i + episode.length)).toEqual(episode);
        expect(episode[0]?.words[0].he).toBe('שון');
        i += episode.length;
      }
    }
    expect(firsts.size).toBe(6);
    const models = (story: string) => GARDEN_SENTENCES.filter(b => b.story === story).map(b => b.model.he);
    expect(models('banana')).toEqual(['שון אוכל בננה', 'הקליפה נשארת ביד של שון', 'שון שם את הקליפה בפח']);
    expect(models('date')).toEqual(['שון אוכל תמרים', 'שון טומן את הגרעין באדמה', 'נבט ירוק גדל מהאדמה', 'הנבט גדל והופך לעץ דקל']);
    expect(models('avocado')).toEqual(['שון אוכל אבוקדו', 'שון שם את גרעין האבוקדו במים', 'נבט קטן מציץ מהגרעין', 'שון שותל את הנבט באדמה']);
    expect(models('strawberry')).toEqual(['שון משקה את השתיל באדמה', 'פרח לבן נפתח בשמש', 'דבורה מבקרת את הפרח']);
    expect(models('carrot')).toEqual(['שון זורע זרעי גזר', 'הגשם מרטיב את האדמה', 'עלים ירוקים מבצבצים מהאדמה', 'שון מושך את הגזר מהאדמה', 'שון אוכל את הגזר']);
    expect(models('apple')).toEqual(['שון קוטף תפוח מהעץ', 'שון שוטף את התפוח', 'לבסוף שון נוגס בתפוח']);
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
