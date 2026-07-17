import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { gameMeta } from '../content/games';
import { DOMAIN_KEYS } from '../domain/types';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('greets Sean and shows every activity portal', () => {
    const html = renderToStaticMarkup(<HomeScreen onOpenGame={() => {}} />);
    expect(html).toContain('שלום שון');
    for (const domain of DOMAIN_KEYS) {
      expect(html).toContain(gameMeta[domain].title);
    }
  });

  it('staggers portal entrance via a per-card --enter-index custom property', () => {
    const html = renderToStaticMarkup(<HomeScreen onOpenGame={() => {}} />);
    expect(html).toContain('--enter-index:0');
    expect(html).toContain(`--enter-index:${DOMAIN_KEYS.length - 1}`);
  });

  it('renders a decorative sparkle layer that is hidden from assistive tech', () => {
    const html = renderToStaticMarkup(<HomeScreen onOpenGame={() => {}} />);
    expect(html).toContain('portal-card__sparkles');
    expect(html).toMatch(/portal-card__sparkles[^>]*aria-hidden="true"/);
  });
});
