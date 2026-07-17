import { describe, expect, it } from 'vitest';
import { PORTAL_ART } from './art/portalRegistry';
import { gameMeta } from './content/games';
import { DOMAIN_KEYS } from './domain/types';
import { parseHash, resolveRouteForCommunicationRelease } from './routes';

describe('child navigation', () => {
  it('exposes exactly eight stable activity destinations with art and metadata', () => {
    expect(DOMAIN_KEYS).toEqual([
      'listening',
      'counting',
      'sorting',
      'puzzle',
      'memory',
      'numberPairs',
      'sillyAlien',
      'syllableTrain',
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

  it('parses only the exact communication shelf and registered activity paths', () => {
    expect(parseHash('#/communication')).toEqual({ kind: 'communication-shelf' });
    expect(parseHash('#/communication/peek-and-discover')).toEqual({
      kind: 'communication-game',
      activityId: 'peek',
    });
    expect(parseHash('#/communication/story-that-waits')).toEqual({
      kind: 'communication-game',
      activityId: 'story',
    });
    expect(parseHash('#/communication/unknown')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/toy-phone/')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/toy-phone?mode=child')).toEqual({ kind: 'home' });
  });

  it('fails direct communication routes closed until release and integration are ready', () => {
    const shelf = parseHash('#/communication');
    const game = parseHash('#/communication/word-train');

    expect(resolveRouteForCommunicationRelease(shelf, false, () => false)).toEqual({
      kind: 'home',
    });
    expect(resolveRouteForCommunicationRelease(game, false, () => true)).toEqual({
      kind: 'home',
    });
    expect(resolveRouteForCommunicationRelease(game, true, () => false)).toEqual({
      kind: 'home',
    });
    expect(resolveRouteForCommunicationRelease(game, true, () => true)).toEqual(game);
  });
});
