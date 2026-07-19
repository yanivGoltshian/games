import { describe, expect, it } from 'vitest';
import { PORTAL_ART } from './art/portalRegistry';
import { gameMeta } from './content/games';
import { DOMAIN_KEYS } from './domain/types';
import {
  isCommunicationHash,
  parseHash,
  resolveRouteForCommunicationAvailability,
} from './routes';

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

  it('parses only the exact communication shelf and registered activity paths', () => {
    expect(parseHash('#/communication')).toEqual({ kind: 'communication-shelf' });
    expect(parseHash('#/communication/peek-and-discover')).toEqual({
      kind: 'communication-game',
      activityId: 'peek',
    });
    expect(parseHash('#/communication/toy-phone')).toEqual({
      kind: 'communication-game',
      activityId: 'phone',
    });
    expect(parseHash('#/communication/story-that-waits')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/word-train')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/unknown')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/toy-phone/')).toEqual({ kind: 'home' });
    expect(parseHash('#/communication/toy-phone?mode=child')).toEqual({ kind: 'home' });
  });

  it('fails direct communication routes closed until release and integration are ready', () => {
    const shelf = parseHash('#/communication');
    const game = parseHash('#/communication/toy-phone');

    expect(resolveRouteForCommunicationAvailability(shelf, [])).toEqual({
      kind: 'home',
    });
    expect(resolveRouteForCommunicationAvailability(game, ['peek'])).toEqual({
      kind: 'home',
    });
    expect(resolveRouteForCommunicationAvailability(game, ['phone'])).toEqual(game);
    expect(resolveRouteForCommunicationAvailability(
      parseHash('#/communication/toy-phone'),
      ['peek', 'phone'],
    )).toEqual({
      kind: 'communication-game',
      activityId: 'phone',
    });
    expect(resolveRouteForCommunicationAvailability(
      parseHash('#/communication/story-that-waits'),
      ['peek', 'phone'],
    )).toEqual({ kind: 'home' });
  });

  it('keeps old Story routes closed even when other communication activities are available', () => {
    const phone = parseHash('#/communication/toy-phone');
    const story = parseHash('#/communication/story-that-waits');

    expect(resolveRouteForCommunicationAvailability(phone, ['peek'])).toEqual({
      kind: 'home',
    });
    expect(resolveRouteForCommunicationAvailability(story, ['peek', 'phone'])).toEqual({
      kind: 'home',
    });
  });

  it('fails the legacy Train URL closed instead of restoring Train', () => {
    const legacyTrain = parseHash('#/games/syllableTrain');

    expect(legacyTrain).toEqual({ kind: 'home' });
    expect(resolveRouteForCommunicationAvailability(legacyTrain, ['peek', 'phone'])).toEqual({
      kind: 'home',
    });
  });

  it('recognizes complete communication hash identities for fail-closed normalization', () => {
    expect(isCommunicationHash('#/communication')).toBe(true);
    expect(isCommunicationHash('#/communication/toy-phone')).toBe(true);
    expect(isCommunicationHash('#/communication/unknown?mode=child')).toBe(true);
    expect(isCommunicationHash('#/communications')).toBe(false);
  });
});
