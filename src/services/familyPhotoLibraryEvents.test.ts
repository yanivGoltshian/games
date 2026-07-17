// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  publishFamilyPhotoLibraryChange,
  subscribeFamilyPhotoLibraryChanges,
} from './familyPhotoLibraryEvents';

class BroadcastChannelDouble {
  static instances: BroadcastChannelDouble[] = [];

  readonly close = vi.fn();
  readonly postMessage = vi.fn();
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

  it('publishes only a typed identifier change and not image data', () => {
    publishFamilyPhotoLibraryChange({ kind: 'deleted', id: 'family-photo-test' });

    expect(BroadcastChannelDouble.instances).toHaveLength(1);
    expect(BroadcastChannelDouble.instances[0]!.postMessage).toHaveBeenCalledWith({
      kind: 'deleted',
      id: 'family-photo-test',
    });
    expect(BroadcastChannelDouble.instances[0]!.close).toHaveBeenCalledOnce();
  });

  it('subscribes to valid cross-tab changes and ignores invalid payloads', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFamilyPhotoLibraryChanges(listener);
    const subscriber = BroadcastChannelDouble.instances[0]!;

    subscriber.emit({ kind: 'deleted', id: 'family-photo-test' });
    subscriber.emit({ kind: 'deleted', id: new Blob(['private']) });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      kind: 'deleted',
      id: 'family-photo-test',
    });

    unsubscribe();
    expect(subscriber.close).toHaveBeenCalledOnce();
  });
});
