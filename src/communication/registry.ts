import type { CommunicationActivityId } from '../domain/communicationGame';
import { STORY_THAT_WAITS_SHELF_METADATA } from '../content/storyThatWaits';

export const COMMUNICATION_SHELF_PATH = '/communication' as const;

export type CommunicationDoorPalette = 'coral' | 'ocean' | 'leaf' | 'honey';

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

export const COMMUNICATION_SHELF_REGISTRY = [
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
    activityId: 'train',
    slug: 'word-train',
    path: '/communication/word-train',
    palette: 'ocean',
    title: {
      he: 'רכבת המילים',
      en: 'Word Train',
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
  {
    activityId: 'story',
    slug: 'story-that-waits',
    path: '/communication/story-that-waits',
    palette: 'honey',
    title: {
      he: STORY_THAT_WAITS_SHELF_METADATA['he-IL'].title,
      en: 'Story That Waits',
    },
    description: {
      he: STORY_THAT_WAITS_SHELF_METADATA['he-IL'].description,
      en: STORY_THAT_WAITS_SHELF_METADATA['en-US'].description,
    },
  },
] as const satisfies readonly CommunicationShelfEntry[];

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
