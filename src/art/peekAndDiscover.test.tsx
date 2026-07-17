// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PeekAndDiscoverArt } from './peekAndDiscover';

const cssSource = readFileSync(
  join(process.cwd(), 'src/games/PeekAndDiscoverGame.css'),
  'utf8',
);
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
});

describe('PeekAndDiscoverArt', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the toy-theatre structure with stable data attributes and both controls', async () => {
    await act(async () => {
      root.render(
        <PeekAndDiscoverArt
          phase="reaction"
          demoMode="tutorial"
          gagId="animal-wiggle"
          gagActive={true}
          revealed={true}
          reducedMotion={false}
          locale="he-IL"
          imageUrl="/assets/vocabulary/dog.webp"
          contentId="dog"
          assetState="playing"
          coverButtonProps={{ 'aria-label': 'cover' }}
          objectButtonProps={{ 'aria-label': 'object' }}
        />,
      );
    });

    const art = container.querySelector<HTMLElement>('.peek-and-discover-art');
    expect(art).not.toBeNull();
    expect(art?.dataset.artPhase).toBe('reaction');
    expect(art?.dataset.demoMode).toBe('tutorial');
    expect(art?.dataset.gagMotion).toBe('wiggle');
    expect(art?.dataset.gagActive).toBe('true');
    expect(art?.dataset.revealed).toBe('true');
    expect(art?.hasAttribute('aria-hidden')).toBe(false);

    const stage = container.querySelector('.peek-and-discover-stage');
    expect(stage).not.toBeNull();
    expect(container.querySelector('.peek-and-discover-object-button')).not.toBeNull();
    expect(container.querySelector('.peek-and-discover-cover-button')).not.toBeNull();
    expect(container.querySelector('.peek-and-discover-mascot')).not.toBeNull();
    expect(container.querySelector('.peek-and-discover-object-image')).not.toBeNull();
  });

  it('keeps the CSS target-size and reduced-motion contracts explicit', () => {
    expect(cssSource).toContain('min-width: 160px;');
    expect(cssSource).toContain('min-height: 160px;');
    expect(cssSource).toContain('min-width: 280px;');
    expect(cssSource).toContain('min-height: 280px;');
    expect(cssSource).toContain('width: var(--peek-secondary-min);');
    expect(cssSource).toContain('--peek-primary-min: 88px;');
    expect(cssSource).toContain('--peek-secondary-min: 64px;');
    expect(cssSource).toContain('transition-duration: 160ms;');
    expect(cssSource).toContain('transform: none;');
    expect(cssSource).toContain("data-reduced-motion='true'");
  });
});
