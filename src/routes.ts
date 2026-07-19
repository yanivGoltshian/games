import type { DomainKey } from './domain/types';
import { DOMAIN_KEYS } from './domain/types';

export type Route =
  | { kind: 'home' }
  | { kind: 'caregiver' }
  | { kind: 'game'; domain: DomainKey };

export function parseHash(hash: string): Route {
  const cleaned = (hash.startsWith('#') ? hash.slice(1) : hash) || '/';
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
