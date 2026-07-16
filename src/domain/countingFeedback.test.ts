import { describe, expect, it } from 'vitest';
import { buildCountingMissModel, getCountingLayout } from './countingFeedback';

describe('counting miss modeling', () => {
  it('counts every visible object in order on the first miss', () => {
    const model = buildCountingMissModel('ball', 3, 1);
    expect(model.variant).toBe('first-miss');
    expect(model.quantity).toEqual({ he: 'שלושה כדורים', en: 'three balls' });
    expect(model.lines).toEqual([
      { he: 'בוא נספור יחד.', en: "Let's count together.", pauseAfterMs: 180 },
      { he: 'אחת', en: 'one', pauseAfterMs: 220, cue: 'count-item:0' },
      { he: 'שתיים', en: 'two', pauseAfterMs: 220, cue: 'count-item:1' },
      { he: 'שלוש', en: 'three', pauseAfterMs: 220, cue: 'count-item:2' },
      { he: 'יש כאן שלושה כדורים.', en: 'There are three balls.', pauseAfterMs: 220 },
    ]);
  });

  it('makes the quantity explicit after subsequent misses', () => {
    const second = buildCountingMissModel('cup', 1, 2);
    expect(second.variant).toBe('subsequent-miss');
    expect(second.lines).toEqual([
      {
        he: 'יש כאן כוס אחת.',
        en: 'There is one cup.',
        pauseAfterMs: 220,
        cue: 'count-answer:1',
      },
    ]);
    expect(second.attemptState.band).toBe('second-miss');

    const repeated = buildCountingMissModel('sun', 5, 4);
    expect(repeated.attemptState.tier).toBe('repeated-effort');
    expect(repeated.lines[0]).toMatchObject({
      he: 'יש כאן חמש שמשות.',
      en: 'There are five suns.',
      cue: 'count-answer:5',
    });
  });

  it('selects quantity-specific responsive constellations', () => {
    expect([1, 2, 3, 5, 10].map(getCountingLayout)).toEqual([
      { columns: 1, density: 'single' },
      { columns: 2, density: 'early' },
      { columns: 3, density: 'early' },
      { columns: 3, density: 'middle' },
      { columns: 5, density: 'full' },
    ]);
  });
});
