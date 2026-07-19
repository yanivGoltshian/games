import type { DomainKey } from '../domain/types';

export type HomeItem =
  | { kind: 'game'; domain: DomainKey };

export const CORE_HOME_DOMAIN_KEYS = [
  'listening',
  'counting',
  'sorting',
  'puzzle',
  'memory',
  'numberPairs',
  'sillyAlien',
] as const satisfies readonly DomainKey[];

export const DEFAULT_HOME_ITEMS = [
  { kind: 'game', domain: 'listening' },
  { kind: 'game', domain: 'counting' },
  { kind: 'game', domain: 'sorting' },
  { kind: 'game', domain: 'puzzle' },
  { kind: 'game', domain: 'memory' },
  { kind: 'game', domain: 'numberPairs' },
  { kind: 'game', domain: 'sillyAlien' },
] as const satisfies readonly HomeItem[];

export function homeItems(): readonly HomeItem[] {
  return DEFAULT_HOME_ITEMS;
}
