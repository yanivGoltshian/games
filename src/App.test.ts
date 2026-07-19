import { describe, expect, it } from 'vitest';
import { PORTAL_ART } from './art/portalRegistry';
import { gameMeta } from './content/games';
import { DOMAIN_KEYS } from './domain/types';
import { parseHash } from './routes';

describe('child navigation', () => {
  it('exposes seven direct game destinations with art and metadata', () => {
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

  it('falls back safely for unknown or malformed routes', () => {
    expect(parseHash('#/games/unknown')).toEqual({ kind: 'home' });
    expect(parseHash('#/games/word-stretch')).toEqual({ kind: 'home' });
    expect(parseHash('#/games/first-sound-factory')).toEqual({ kind: 'home' });
    expect(parseHash('')).toEqual({ kind: 'home' });
  });

  it('fails every old communication route closed to Home', () => {
    expect(parseHash('#/communication')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/peek-and-discover')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/toy-phone')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/story-that-waits')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/word-train')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/unknown')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/toy-phone/')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/toy-phone?mode=child')).toEqual({ kind: 'home' });
  });

  it('fails the legacy Train URL closed instead of restoring Train', () => {
    expect(parseHash('#/games/syllableTrain')).toEqual({ kind: 'home' });
  });
});
