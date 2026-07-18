import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_SHELF_PATH,
  COMMUNICATION_SHELF_REGISTRY,
  communicationActivityFromPath,
  communicationShelfEntry,
} from './registry';

describe('communication shelf registry', () => {
  it('keeps exactly four fixed scope identities, paths, titles, and positions', () => {
    expect(COMMUNICATION_SHELF_PATH).toBe('/communication');
    expect(COMMUNICATION_SHELF_REGISTRY).toEqual([
      expect.objectContaining({
        activityId: 'peek',
        path: '/communication/peek-and-discover',
        title: expect.objectContaining({ en: 'Peek and Discover' }),
      }),
      expect.objectContaining({
        activityId: 'train',
        path: '/communication/word-train',
        title: expect.objectContaining({ en: 'Word Train' }),
      }),
      expect.objectContaining({
        activityId: 'phone',
        path: '/communication/toy-phone',
        title: expect.objectContaining({ en: 'Toy Phone' }),
      }),
      expect.objectContaining({
        activityId: 'story',
        path: '/communication/story-that-waits',
        title: {
          he: 'סִפּוּר שֶׁמְּחַכֶּה',
          en: 'Story That Waits',
        },
        description: {
          he: 'גְּעוּ בַּסֵּפֶר',
          en: 'Touch the book',
        },
      }),
    ]);
  });

  it('accepts only exact registered activity paths', () => {
    expect(communicationActivityFromPath('/communication/toy-phone')).toBe('phone');
    expect(communicationActivityFromPath('/communication/toy-phone/')).toBeNull();
    expect(communicationActivityFromPath('/communication/unknown')).toBeNull();
    expect(communicationActivityFromPath('/communication/word-stretch')).toBeNull();
    expect(communicationActivityFromPath('/communication/first-sound-factory')).toBeNull();
    expect(communicationShelfEntry('story').slug).toBe('story-that-waits');
  });
});
