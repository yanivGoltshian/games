import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LEVEL_UP_SPEECH, MORE_NUMBERS_SPEECH } from '../content/levelUpSpeech';
import { SuccessOverlay } from './SuccessOverlay';
import { scheduleSuccessAdvance } from './successTiming';

const settings = {
  childName: 'שון',
  languageMode: 'he' as const,
  englishVoiceLocale: 'en-US' as const,
  soundLevel: 0.7,
  reducedMotion: false,
  quietMode: false,
};

describe('automatic success transition', () => {
  it('renders an accessible automatic celebration without progression buttons', () => {
    const markup = renderToStaticMarkup(
      <SuccessOverlay
        settings={settings}
        scope="game:number-pairs"
        seed="level-up"
        targetSegments={[{ text: 'שלוש', locale: 'he-IL' }]}
        tier="milestone"
        recommendation={{ currentLevel: 1, nextLevel: 2 }}
        followUpSegments={[{ text: MORE_NUMBERS_SPEECH.he, locale: 'he-IL' }]}
        onAdvance={() => undefined}
      />,
    );

    expect(markup).toContain('עברת שלב!');
    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('מוכנים לשלב הבא');
  });

  it('keeps the spoken level-up sequence in the required order', () => {
    expect(LEVEL_UP_SPEECH.map((line) => line.he)).toEqual([
      'עברת שלב!',
      'כל הכבוד, שון!',
      'זכית בגביע!',
    ]);
  });

  it('cleans up the liveness timer before it can advance', () => {
    let callback: (() => void) | null = null;
    let advanced = false;
    const cancel = scheduleSuccessAdvance(
      15_000,
      () => {
        advanced = true;
      },
      {
        setTimeout: (next, delay) => {
          expect(delay).toBe(15_000);
          callback = next;
          return 7;
        },
        clearTimeout: (handle) => {
          expect(handle).toBe(7);
          callback = null;
        },
      },
    );

    cancel();

    expect(callback).toBeNull();
    expect(advanced).toBe(false);
  });
});
