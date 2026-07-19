// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { gameMeta } from '../content/games';
import { createInitialSettings } from '../domain/progression';
import { DOMAIN_KEYS } from '../domain/types';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  const settings = { childName: 'שון', languageMode: 'he' as const };
  const renderHome = () => renderToStaticMarkup(
    <HomeScreen
      onOpenGame={() => undefined}
      settings={settings}
    />,
  );

  it('greets Sean and shows every activity portal', () => {
    const html = renderHome();
    expect(html).toContain('שלום שון');
    for (const domain of DOMAIN_KEYS) {
      expect(html).toContain(gameMeta[domain].title);
    }
  });

  it('staggers portal entrance via a per-card --enter-index custom property', () => {
    const html = renderHome();
    expect(html).toContain('--enter-index:0');
    expect(html).toContain(`--enter-index:${DOMAIN_KEYS.length - 1}`);
  });

  it('renders a decorative sparkle layer that is hidden from assistive tech', () => {
    const html = renderHome();
    expect(html).toContain('portal-card__sparkles');
    expect(html).toMatch(/portal-card__sparkles[^>]*aria-hidden="true"/);
  });

  it('keeps the exact current seven tiles while language-game replacement is undecided', () => {
    const document = new DOMParser().parseFromString(renderHome(), 'text/html');
    const domains = [...document.querySelectorAll<HTMLElement>('.portal-grid__item')]
      .map((item) => item.dataset.domain);

    expect(domains).toEqual([
      'listening',
      'counting',
      'sorting',
      'puzzle',
      'memory',
      'numberPairs',
      'sillyAlien',
    ]);
  });

  it('does not restore Train, Word Stretch, or the Communication Shelf', () => {
    const document = new DOMParser().parseFromString(renderHome(), 'text/html');
    const domains = [...document.querySelectorAll<HTMLElement>('.portal-grid__item')]
      .map((item) => item.dataset.domain);

    expect(domains).toHaveLength(7);
    expect(document.body.textContent).not.toContain('רכבת המילים');
    expect(document.body.textContent).not.toContain('מדף התקשורת');
    expect(document.body.textContent).not.toMatch(/Word Stretch|מתיחת מילים/i);
  });
});

describe('HomeScreen greeting', () => {
  it('renders the configured name in Hebrew and English modes', () => {
    const base = createInitialSettings();
    const hebrew = renderToStaticMarkup(
      <HomeScreen
        onOpenGame={() => undefined}
        settings={{ ...base, childName: 'נוֹעָה', languageMode: 'he' }}
      />,
    );
    const english = renderToStaticMarkup(
      <HomeScreen
        onOpenGame={() => undefined}
        settings={{ ...base, childName: 'נוֹעָה', languageMode: 'en' }}
      />,
    );

    expect(hebrew).toContain('שלום נוֹעָה');
    expect(english).toContain('Hello נוֹעָה');
    expect(`${hebrew}${english}`).not.toContain('שון');
    expect(`${hebrew}${english}`).not.toContain('Sean');
  });
});
