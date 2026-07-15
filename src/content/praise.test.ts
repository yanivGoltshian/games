import { describe, expect, it } from 'vitest';
import { MILESTONE_PRAISE_EN, MILESTONE_PRAISE_HE, PRAISE_EN, PRAISE_HE, selectPraise } from './praise';

describe('praise selector', () => {
  it('is deterministic for the same locale, tier, and seed', () => {
    const first = selectPraise('he', 'standard', 'listening-3-2');
    const second = selectPraise('he', 'standard', 'listening-3-2');
    expect(first).toEqual(second);
  });

  it('returns different phrases for different seeds at least some of the time', () => {
    const seeds = Array.from({ length: 12 }, (_, index) => `seed-${index}`);
    const ids = new Set(seeds.map((seed) => selectPraise('he', 'standard', seed).id));
    expect(ids.size).toBeGreaterThan(1);
  });

  it('only returns Hebrew phrases for the he locale', () => {
    for (let index = 0; index < 20; index += 1) {
      const line = selectPraise('he', 'standard', `he-${index}`);
      expect(PRAISE_HE.map((entry) => entry.id)).toContain(line.id);
    }
  });

  it('only returns English phrases for the en locale', () => {
    for (let index = 0; index < 20; index += 1) {
      const line = selectPraise('en', 'standard', `en-${index}`);
      expect(PRAISE_EN.map((entry) => entry.id)).toContain(line.id);
    }
  });

  it('includes the required stable Hebrew phrases', () => {
    const texts = PRAISE_HE.map((entry) => entry.text);
    expect(texts).toEqual(['כל הכבוד, שון!', 'יופי!', 'הצלחת!']);
  });

  it('includes the required stable English phrases', () => {
    const texts = PRAISE_EN.map((entry) => entry.text);
    expect(texts).toEqual(['Great job, Sean!', 'Great!', 'You did it!']);
  });

  it('selects from the richer milestone tier when requested', () => {
    for (let index = 0; index < 10; index += 1) {
      const line = selectPraise('he', 'milestone', `milestone-${index}`);
      expect(MILESTONE_PRAISE_HE.map((entry) => entry.id)).toContain(line.id);
      expect(line.tier).toBe('milestone');
    }
    for (let index = 0; index < 10; index += 1) {
      const line = selectPraise('en', 'milestone', `milestone-en-${index}`);
      expect(MILESTONE_PRAISE_EN.map((entry) => entry.id)).toContain(line.id);
    }
  });

  it('keeps stable ids across calls so future audio assets can key off them', () => {
    expect(PRAISE_HE.map((entry) => entry.id)).toEqual(['praise-he-01', 'praise-he-02', 'praise-he-03']);
    expect(PRAISE_EN.map((entry) => entry.id)).toEqual(['praise-en-01', 'praise-en-02', 'praise-en-03']);
  });
});
