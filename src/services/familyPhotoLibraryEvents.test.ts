// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  publishFamilyPhotoLibraryChange,
  subscribeFamilyPhotoLibraryChanges,
} from './familyPhotoLibraryEvents';

class BroadcastChannelDouble {
  static instances: BroadcastChannelDouble[] = [];

  readonly close = vi.fn();
  readonly postMessage = vi.fn((data: unknown) => {
    BroadcastChannelDouble.instances
      .filter((instance) => instance !== this)
      .forEach((instance) => instance.emit(data));
  });
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

  constructor(readonly name: string) {
    BroadcastChannelDouble.instances.push(this);
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.delete(listener);
  }

  emit(data: unknown): void {
    this.listeners.forEach((listener) => listener(new MessageEvent('message', { data })));
  }
}

describe('family photo library events', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  beforeEach(() => {
    BroadcastChannelDouble.instances = [];
    globalThis.BroadcastChannel = BroadcastChannelDouble as unknown as typeof BroadcastChannel;
  });

  afterEach(() => {
    globalThis.BroadcastChannel = originalBroadcastChannel;
  });

  it('publishes only a typed identifier envelope and not image data', () => {
    publishFamilyPhotoLibraryChange({ kind: 'added', ids: ['family-photo-test'] });

    expect(BroadcastChannelDouble.instances).toHaveLength(1);
    const payload = BroadcastChannelDouble.instances[0]!.postMessage.mock.calls[0]![0];
    expect(payload).toEqual({
      sourceId: expect.any(String),
      change: {
        kind: 'added',
        ids: ['family-photo-test'],
      },
    });
    expect(JSON.stringify(payload)).not.toContain('blob');
    expect(JSON.stringify(payload)).not.toContain('image');
    expect(BroadcastChannelDouble.instances[0]!.close).toHaveBeenCalledOnce();
  });

  it('delivers one effective local change despite the same-tab broadcast path', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFamilyPhotoLibraryChanges(listener);

    publishFamilyPhotoLibraryChange({ kind: 'deleted', id: 'family-photo-test' });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      kind: 'deleted',
      id: 'family-photo-test',
    });

    unsubscribe();
  });

  it('delivers one valid remote-tab change and ignores invalid payloads', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFamilyPhotoLibraryChanges(listener);
    const subscriber = BroadcastChannelDouble.instances[0]!;

    subscriber.emit({
      sourceId: 'remote-tab',
      change: { kind: 'added', ids: ['family-photo-test'] },
    });
    subscriber.emit({
      sourceId: 'remote-tab',
      change: { kind: 'deleted', id: new Blob(['private']) },
    });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      kind: 'added',
      ids: ['family-photo-test'],
    });

    unsubscribe();
    expect(subscriber.close).toHaveBeenCalledOnce();
  });
});
