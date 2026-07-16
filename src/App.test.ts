import { describe, expect, it } from 'vitest';
import { PORTAL_ART } from './art/portalRegistry';
import { gameMeta } from './content/games';
import { DOMAIN_KEYS } from './domain/types';
import { parseHash } from './routes';

describe('child navigation', () => {
  it('exposes exactly five stable activity destinations with art and metadata', () => {
    expect(DOMAIN_KEYS).toEqual(['listening', 'counting', 'sorting', 'puzzle', 'memory']);
    for (const domain of DOMAIN_KEYS) {
      expect(gameMeta[domain].title).toBeTruthy();
      expect(PORTAL_ART[domain]).toBeTypeOf('function');
      expect(parseHash(`#/games/${domain}`)).toEqual({ kind: 'game', domain });
    }
  });

  it('falls back safely for unknown or malformed routes', () => {
    expect(parseHash('#/games/unknown')).toEqual({ kind: 'home' });
    expect(parseHash('')).toEqual({ kind: 'home' });
  });
});
