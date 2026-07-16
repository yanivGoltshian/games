import type { DomainKey } from './domain/types';
import { DOMAIN_KEYS } from './domain/types';

export type Route =
  | { kind: 'home' }
  | { kind: 'caregiver' }
  | { kind: 'game'; domain: DomainKey };

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#/, '') || '/';
  if (cleaned === '/caregiver') {
    return { kind: 'caregiver' };
  }
  if (cleaned.startsWith('/games/')) {
    const domain = cleaned.replace('/games/', '') as DomainKey;
    if (DOMAIN_KEYS.includes(domain)) {
      return { kind: 'game', domain };
    }
  }
  return { kind: 'home' };
}
