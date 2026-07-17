import type { DomainKey } from './domain/types';
import { DOMAIN_KEYS } from './domain/types';
import type { CommunicationActivityId } from './domain/communicationGame';
import {
  COMMUNICATION_SHELF_PATH,
  communicationActivityFromPath,
} from './communication/registry';

export type Route =
  | { kind: 'home' }
  | { kind: 'caregiver' }
  | { kind: 'game'; domain: DomainKey }
  | { kind: 'communication-shelf' }
  | { kind: 'communication-game'; activityId: CommunicationActivityId };

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
  if (cleaned === COMMUNICATION_SHELF_PATH) {
    return { kind: 'communication-shelf' };
  }
  const activityId = communicationActivityFromPath(cleaned);
  if (activityId) {
    return { kind: 'communication-game', activityId };
  }
  return { kind: 'home' };
}

export function resolveRouteForCommunicationAvailability(
  route: Route,
  communicationAvailable: boolean,
): Route {
  if (route.kind === 'communication-shelf') {
    return communicationAvailable ? route : { kind: 'home' };
  }
  if (route.kind === 'communication-game') {
    return communicationAvailable
      ? route
      : { kind: 'home' };
  }

  return route;
}

export function isCommunicationHash(hash: string): boolean {
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  return /^\/communication(?:$|[/?])/.test(path);
}
