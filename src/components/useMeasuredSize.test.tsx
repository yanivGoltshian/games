// @vitest-environment jsdom

import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMeasuredSize } from './useMeasuredSize';

class ResizeObserverDouble implements ResizeObserver {
  static instances: ResizeObserverDouble[] = [];

  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverDouble.instances.push(this);
  }
}

function Harness() {
  const [playing, setPlaying] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const size = useMeasuredSize(surfaceRef, playing);

  return (
    <>
      <output data-testid="size">{size.width}x{size.height}</output>
      <button type="button" onClick={() => setPlaying(true)}>Play</button>
      {playing ? <div ref={surfaceRef} data-testid="surface" /> : null}
    </>
  );
}

describe('useMeasuredSize', () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalResizeObserver = globalThis.ResizeObserver;
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = ResizeObserverDouble;
  });

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    globalThis.ResizeObserver = originalResizeObserver;
  });

  beforeEach(() => {
    ResizeObserverDouble.instances = [];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('measures a surface that mounts when measurement becomes active', async () => {
    await act(async () => root.render(<Harness />));
    expect(ResizeObserverDouble.instances).toHaveLength(0);

    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    const surface = container.querySelector<HTMLElement>('[data-testid="surface"]')!;
    Object.defineProperties(surface, {
      clientWidth: { configurable: true, value: 1024 },
      clientHeight: { configurable: true, value: 700 },
    });
    await act(async () => ResizeObserverDouble.instances[0]!.callback(
      [],
      ResizeObserverDouble.instances[0]!,
    ));

    expect(container.querySelector('[data-testid="size"]')?.textContent).toBe('1024x700');
    expect(ResizeObserverDouble.instances).toHaveLength(1);
    expect(ResizeObserverDouble.instances[0]!.observe)
      .toHaveBeenCalledWith(container.querySelector('[data-testid="surface"]'));
  });
});
