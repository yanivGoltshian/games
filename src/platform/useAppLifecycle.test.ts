// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readAppLifecycleState,
  subscribeAppLifecycle,
} from './useAppLifecycle';

describe('app lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports foreground and background using visibility and page events', () => {
    const states: string[] = [];
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const cleanup = subscribeAppLifecycle((state) => states.push(state));

    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pageshow'));

    expect(states).toEqual(['background', 'foreground']);
    expect(readAppLifecycleState(document)).toBe('foreground');
    cleanup();
  });

  it('removes every listener and emits no events after cleanup', () => {
    const listener = vi.fn();
    const cleanup = subscribeAppLifecycle(listener);

    cleanup();
    window.dispatchEvent(new Event('pagehide'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not treat foreground return as a request to start media', () => {
    const listener = vi.fn();
    const cleanup = subscribeAppLifecycle(listener);

    window.dispatchEvent(new Event('pageshow'));

    expect(listener).not.toHaveBeenCalled();
    cleanup();
  });
});
