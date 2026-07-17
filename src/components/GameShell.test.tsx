// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameShell } from './GameShell';

describe('GameShell restart control', () => {
  let container: HTMLDivElement;
  let root: Root;
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('starts a fresh round from the circular-arrow control', async () => {
    const onRestart = vi.fn();
    await act(async () => {
      root.render(
        <GameShell
          ariaLabel="Test game"
          accentClass="test-game"
          reducedMotion={false}
          onHome={() => undefined}
          onRestart={onRestart}
          restartLabel="New game"
          homeLabel="Home"
          liveStatus="Ready"
          languageMode="en"
        >
          <div>Round</div>
        </GameShell>,
      );
    });

    const restart = container.querySelector<HTMLButtonElement>('.rail-button--restart');
    expect(restart?.getAttribute('aria-label')).toBe('New game');
    expect(restart?.hasAttribute('aria-pressed')).toBe(false);
    await act(async () => restart?.click());
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
