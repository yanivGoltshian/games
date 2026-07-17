// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunicationShelf } from './CommunicationShelf';

function pointerEvent(type: string, pointerId: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

describe('CommunicationShelf', () => {
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

  it('renders exactly four fixed doors with accessible names and decorative art hidden', async () => {
    await act(async () => {
      root.render(
        <CommunicationShelf
          languageMode="en"
          onHome={() => undefined}
          onSelect={() => undefined}
          reducedMotion={false}
        />,
      );
    });

    const doors = [...container.querySelectorAll<HTMLButtonElement>('.communication-door')];
    expect(doors.map((door) => door.dataset.activityId)).toEqual([
      'peek',
      'train',
      'phone',
      'story',
    ]);
    expect(doors.map((door) => door.getAttribute('aria-label'))).toEqual([
      'Peek and Discover',
      'Word Train',
      'Toy Phone',
      'Story That Waits',
    ]);
    expect(doors.every((door) => door.type === 'button')).toBe(true);
    expect(doors.every((door) => door.querySelector('svg')?.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(container.textContent).not.toMatch(/locked|coming soon|score|stars/i);
  });

  it('emits one semantic selection under ten rapid activations', async () => {
    const onSelect = vi.fn();
    await act(async () => {
      root.render(
        <CommunicationShelf
          languageMode="he"
          onHome={() => undefined}
          onSelect={onSelect}
          reducedMotion={false}
        />,
      );
    });
    const firstDoor = container.querySelector<HTMLButtonElement>('[data-activity-id="peek"]')!;

    await act(async () => {
      for (let index = 0; index < 10; index += 1) {
        firstDoor.click();
      }
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('peek');
  });

  it('lets the first pointer own a multi-touch selection', async () => {
    const onSelect = vi.fn();
    await act(async () => {
      root.render(
        <CommunicationShelf
          languageMode="he"
          onHome={() => undefined}
          onSelect={onSelect}
          reducedMotion={false}
        />,
      );
    });
    const firstDoor = container.querySelector<HTMLButtonElement>('[data-activity-id="peek"]')!;
    const secondDoor = container.querySelector<HTMLButtonElement>('[data-activity-id="phone"]')!;

    await act(async () => {
      firstDoor.dispatchEvent(pointerEvent('pointerdown', 1));
      secondDoor.dispatchEvent(pointerEvent('pointerdown', 2));
      secondDoor.dispatchEvent(pointerEvent('pointerup', 2));
      firstDoor.dispatchEvent(pointerEvent('pointerup', 1));
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('peek');
  });

  it('supports RTL, English layout, keyboard activation, and reduced motion state', async () => {
    const hebrew = renderToStaticMarkup(
      <CommunicationShelf
        languageMode="he"
        onHome={() => undefined}
        onSelect={() => undefined}
        reducedMotion
      />,
    );
    const english = renderToStaticMarkup(
      <CommunicationShelf
        languageMode="en"
        onHome={() => undefined}
        onSelect={() => undefined}
        reducedMotion={false}
      />,
    );

    expect(hebrew).toContain('dir="rtl"');
    expect(hebrew).toContain('data-reduced-motion="true"');
    expect(english).toContain('dir="ltr"');
    expect(english).toContain('lang="en"');

    const onSelect = vi.fn();
    await act(async () => {
      root.render(
        <CommunicationShelf
          languageMode="en"
          onHome={() => undefined}
          onSelect={onSelect}
          reducedMotion
        />,
      );
    });
    const storyDoor = container.querySelector<HTMLButtonElement>('[data-activity-id="story"]')!;
    storyDoor.focus();
    expect(document.activeElement).toBe(storyDoor);
    await act(async () => storyDoor.click());
    expect(onSelect).toHaveBeenCalledWith('story');
  });
});
