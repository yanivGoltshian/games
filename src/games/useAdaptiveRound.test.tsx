// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createInitialDomainProgress } from '../domain/progression';
import type { DomainProgress } from '../domain/types';
import { generatePuzzleRound } from '../domain/rounds';
import { useAdaptiveRound } from './useAdaptiveRound';

function Harness() {
  const [progress, setProgress] = useState<DomainProgress>(createInitialDomainProgress());
  const { round, refreshRoundForCurrentProgress } = useAdaptiveRound(
    'puzzle',
    progress,
    generatePuzzleRound,
  );
  return (
    <>
      <output data-testid="piece-count">{round.pieces.length}</output>
      <button
        type="button"
        data-testid="level-2"
        onClick={() => setProgress((current) => ({ ...current, level: 2 }))}
      />
      <button
        type="button"
        data-testid="level-3"
        onClick={() => setProgress((current) => ({ ...current, level: 3 }))}
      />
      <button
        type="button"
        data-testid="choose-built-in"
        onClick={refreshRoundForCurrentProgress}
      />
    </>
  );
}

describe('useAdaptiveRound progress refresh', () => {
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

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('regenerates a cached built-in puzzle at the latest family-earned level', async () => {
    expect(container.querySelector('[data-testid="piece-count"]')?.textContent).toBe('2');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="level-2"]')!.click());
    expect(container.querySelector('[data-testid="piece-count"]')?.textContent).toBe('2');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="choose-built-in"]')!.click());
    expect(container.querySelector('[data-testid="piece-count"]')?.textContent).toBe('4');

    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="level-3"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="choose-built-in"]')!.click());
    expect(container.querySelector('[data-testid="piece-count"]')?.textContent).toBe('9');
  });
});
