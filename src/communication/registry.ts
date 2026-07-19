import type { CommunicationActivityId } from '../domain/communicationGame';

export const COMMUNICATION_SHELF_PATH = '/communication' as const;

export type CommunicationDoorPalette = 'coral' | 'leaf';

export interface CommunicationShelfEntry {
  activityId: CommunicationActivityId;
  slug: string;
  path: `/communication/${string}`;
  palette: CommunicationDoorPalette;
  title: {
    he: string;
    en: string;
  };
  description?: {
    he: string;
    en: string;
  };
}

export const COMMUNICATION_SHELF_REGISTRY: readonly CommunicationShelfEntry[] = [
  {
    activityId: 'peek',
    slug: 'peek-and-discover',
    path: '/communication/peek-and-discover',
    palette: 'coral',
    title: {
      he: 'מציצים ומגלים',
      en: 'Peek and Discover',
    },
  },
  {
    activityId: 'phone',
    slug: 'toy-phone',
    path: '/communication/toy-phone',
    palette: 'leaf',
    title: {
      he: 'טֵלֵפוֹן צַעֲצוּעַ',
      en: 'Toy Phone',
    },
  },
] as const;

export type CommunicationShelfSlug = (typeof COMMUNICATION_SHELF_REGISTRY)[number]['slug'];
export type CommunicationActivityPath = (typeof COMMUNICATION_SHELF_REGISTRY)[number]['path'];

export function communicationShelfEntry(
  activityId: CommunicationActivityId,
): (typeof COMMUNICATION_SHELF_REGISTRY)[number] {
  const entry = COMMUNICATION_SHELF_REGISTRY.find((candidate) => (
    candidate.activityId === activityId
  ));
  if (!entry) {
    throw new Error(`Unknown communication activity: ${activityId}`);
  }
  return entry;
}

export function communicationActivityFromPath(
  path: string,
): CommunicationActivityId | null {
  return COMMUNICATION_SHELF_REGISTRY.find((entry) => entry.path === path)?.activityId ?? null;
}
