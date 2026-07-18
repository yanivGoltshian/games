// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { gameMeta } from '../content/games';
import { createInitialSettings } from '../domain/progression';
import { DOMAIN_KEYS } from '../domain/types';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  const settings = { childName: 'שון', languageMode: 'he' as const };
  const renderHome = (communicationAvailable = false) => renderToStaticMarkup(
    <HomeScreen
      communicationAvailable={communicationAvailable}
      onOpenCommunication={() => undefined}
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

  it('renders exact whole-word Train metadata without segmentation wording', () => {
    const html = renderToStaticMarkup(
      <HomeScreen
        onOpenCommunication={() => undefined}
        onOpenGame={() => undefined}
        settings={settings}
      />,
    );
    const childVisibleText = html.replace(/<[^>]+>/g, ' ');

    expect(gameMeta.syllableTrain).toMatchObject({
      title: 'רכבת המילים',
      subtitle: 'מחברים קרונות ושומעים מילה שלמה',
    });
    expect(html).toContain('רכבת המילים');
    expect(`${childVisibleText} ${gameMeta.syllableTrain.subtitle}`).not.toMatch(
      /הברה|הברות|syllable|fragment|chunk/i,
    );
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

  it('keeps the exact current eight tiles when communication is unavailable', () => {
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
      'syllableTrain',
    ]);
  });

  it('replaces Train with one shelf tile while preserving exactly eight positions', () => {
    const document = new DOMParser().parseFromString(renderHome(true), 'text/html');
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
      'communication',
    ]);
    expect(document.body.textContent).toContain('מדף התקשורת');
    expect(document.body.textContent).not.toContain(gameMeta.syllableTrain.title);
  });
});

describe('HomeScreen greeting', () => {
  it('renders the configured name in Hebrew and English modes', () => {
    const base = createInitialSettings();
    const hebrew = renderToStaticMarkup(
      <HomeScreen
        onOpenCommunication={() => undefined}
        onOpenGame={() => undefined}
        settings={{ ...base, childName: 'נוֹעָה', languageMode: 'he' }}
      />,
    );
    const english = renderToStaticMarkup(
      <HomeScreen
        onOpenCommunication={() => undefined}
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
