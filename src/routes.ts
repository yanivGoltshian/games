import type { DomainKey } from './domain/types';
import { DOMAIN_KEYS } from './domain/types';

export type Route =
  | { kind: 'home' }
  | { kind: 'caregiver' }
  | { kind: 'game'; domain: DomainKey };

const RETIRED_GAME_PATH_PATTERN =
  /^\/games\/(?:syllableTrain|word-stretch)(?:$|[/?])/;

function hashPath(hash: string): string {
  const cleaned = (hash.startsWith('#') ? hash.slice(1) : hash) || '/';
  return cleaned.split('?', 1)[0] ?? '/';
}

export function parseHash(hash: string): Route {
  const cleaned = hashPath(hash);
  if (cleaned === '/caregiver') {
    return { kind: 'caregiver' };
  }
  const gameMatch = /^\/games\/([^/]+)$/.exec(cleaned);
  if (gameMatch) {
    const domain = gameMatch[1] as DomainKey;
    if (DOMAIN_KEYS.includes(domain)) {
      return { kind: 'game', domain };
    }
  }
  return { kind: 'home' };
}

export function isRetiredActivityHash(hash: string): boolean {
  const path = hashPath(hash);
  return (
    /^\/communication(?:$|[/?])/.test(path)
    || RETIRED_GAME_PATH_PATTERN.test(path)
  );
}
