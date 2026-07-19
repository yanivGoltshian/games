import { describe, expect, it } from 'vitest';
import { PORTAL_ART } from './art/portalRegistry';
import { gameMeta } from './content/games';
import { DOMAIN_KEYS } from './domain/types';
import { isRetiredActivityHash, parseHash } from './routes';

const RETIRED_ROUTES = [
  '#/communication',
  '#/communication/peek-and-discover',
  '#/communication/word-train',
  '#/communication/toy-phone',
  '#/communication/story-that-waits',
  '#/games/syllableTrain',
  '#/games/word-stretch',
] as const;

describe('child navigation', () => {
  it('exposes exactly seven direct game destinations with art and metadata', () => {
    expect(DOMAIN_KEYS).toEqual([
      'listening',
      'counting',
      'sorting',
      'puzzle',
      'memory',
      'numberPairs',
      'sillyAlien',
    ]);
    expect(Object.keys(gameMeta)).toEqual(DOMAIN_KEYS);
    for (const domain of DOMAIN_KEYS) {
      expect(gameMeta[domain].title).toBeTruthy();
      expect(PORTAL_ART[domain]).toBeTypeOf('function');
      expect(parseHash(`#/games/${domain}`)).toEqual({ kind: 'game', domain });
    }
  });

  it('fails every retired activity route closed to home', () => {
    for (const route of RETIRED_ROUTES) {
      expect(parseHash(route), route).toEqual({ kind: 'home' });
      expect(isRetiredActivityHash(route), route).toBe(true);
    }
  });

  it('recognizes retired communication subpaths and query strings for normalization', () => {
    expect(isRetiredActivityHash('#/communication/unknown?mode=child')).toBe(true);
    expect(isRetiredActivityHash('#/communication/toy-phone/')).toBe(true);
    expect(isRetiredActivityHash('#/communications')).toBe(false);
  });

  it('falls back safely for other unknown or malformed routes', () => {
    expect(parseHash('#/games/unknown')).toEqual({ kind: 'home' });
    expect(parseHash('#/games/first-sound-factory')).toEqual({ kind: 'home' });
    expect(parseHash('')).toEqual({ kind: 'home' });
  });
});
