// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ boom }: { boom: boolean }) {
  if (boom) {
    throw new Error('boom');
  }
  return <div data-testid="safe-child">child ok</div>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // React logs caught render errors to console.error; silence it for clean output.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function render(ui: ReactNode) {
  act(() => {
    root.render(ui);
  });
}

describe('ErrorBoundary', () => {
  it('shows a friendly fallback instead of a white screen when a child throws', () => {
    render(
      <ErrorBoundary resetKey="a">
        <Bomb boom />
      </ErrorBoundary>,
    );

    expect(container.textContent).toContain('אופס! משהו קטן נתקע');
    expect(container.querySelector('[data-testid="safe-child"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary resetKey="a">
        <Bomb boom={false} />
      </ErrorBoundary>,
    );

    expect(container.querySelector('[data-testid="safe-child"]')?.textContent).toBe('child ok');
    expect(container.textContent).not.toContain('אופס');
  });

  it('recovers automatically when the resetKey changes', () => {
    render(
      <ErrorBoundary resetKey="crash-route">
        <Bomb boom />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('אופס! משהו קטן נתקע');

    render(
      <ErrorBoundary resetKey="home">
        <Bomb boom={false} />
      </ErrorBoundary>,
    );

    expect(container.querySelector('[data-testid="safe-child"]')?.textContent).toBe('child ok');
    expect(container.textContent).not.toContain('אופס');
  });

  it('calls onReset when the child presses the back-home button', () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary resetKey="a" onReset={onReset}>
        <Bomb boom />
      </ErrorBoundary>,
    );

    const button = container.querySelector<HTMLButtonElement>('.primary-button');
    expect(button).not.toBeNull();

    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
