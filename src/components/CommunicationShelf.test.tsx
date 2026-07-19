// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunicationShelf } from './CommunicationShelf';

const allActivityIds = ['peek', 'phone'] as const;

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

  it('renders exactly two fixed doors with accessible names and decorative art hidden', async () => {
    await act(async () => {
      root.render(
        <CommunicationShelf
          activityIds={allActivityIds}
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
      'phone',
    ]);
    expect(doors.map((door) => door.getAttribute('aria-label'))).toEqual([
      'Peek and Discover',
      'Toy Phone',
    ]);
    expect(doors.every((door) => door.type === 'button')).toBe(true);
    expect(doors.every((door) => door.querySelector('svg')?.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(container.querySelector('.communication-shelf__edge-control--replay')).toBeNull();
    expect(container.querySelector('[data-replay-sequence]')).toBeNull();
    expect(container.textContent).not.toContain('↻');
    expect(container.textContent).not.toMatch(/locked|coming soon|score|stars/i);
  });

  it('renders only public doors in fixed order and centers a one-door shelf', async () => {
    await act(async () => {
      root.render(
        <CommunicationShelf
          activityIds={['phone']}
          languageMode="en"
          onHome={() => undefined}
          onSelect={() => undefined}
          reducedMotion={false}
        />,
      );
    });

    const doors = [...container.querySelectorAll<HTMLButtonElement>('.communication-door')];
    expect(doors.map((door) => door.dataset.activityId)).toEqual(['phone']);
    expect(container.querySelector('.communication-shelf__doors')?.getAttribute('data-door-count'))
      .toBe('1');

    await act(async () => {
      root.render(
        <CommunicationShelf
          activityIds={['phone', 'peek']}
          languageMode="en"
          onHome={() => undefined}
          onSelect={() => undefined}
          reducedMotion={false}
        />,
      );
    });
    expect([...container.querySelectorAll<HTMLElement>('.communication-door')]
      .map((door) => door.dataset.activityId)).toEqual(['peek', 'phone']);
  });

  it('renders the production communication shelf as exactly two ready doors in fixed order', async () => {
    await act(async () => {
      root.render(
        <CommunicationShelf
          activityIds={['peek', 'phone']}
          languageMode="he"
          onHome={() => undefined}
          onSelect={() => undefined}
          reducedMotion={false}
        />,
      );
    });

    const doors = [...container.querySelectorAll<HTMLButtonElement>('.communication-door')];
    expect(doors.map((door) => door.dataset.activityId)).toEqual(['peek', 'phone']);
    expect(doors.map((door) => door.getAttribute('aria-label'))).toEqual([
      'מציצים ומגלים',
      'טֵלֵפוֹן צַעֲצוּעַ',
    ]);
    expect(container.querySelector('.communication-shelf__doors')?.getAttribute('data-door-count'))
      .toBe('2');
    expect(container.textContent).not.toContain('סיפור');
    expect(container.textContent).not.toContain('רכבת');
  });

  it('emits one semantic selection under ten rapid activations', async () => {
    const onSelect = vi.fn();
    await act(async () => {
      root.render(
        <CommunicationShelf
          activityIds={allActivityIds}
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
          activityIds={allActivityIds}
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

  it('does not let a secondary control interaction clear first-pointer ownership', async () => {
    const onHome = vi.fn();
    const onSelect = vi.fn();
    await act(async () => {
      root.render(
        <CommunicationShelf
          activityIds={allActivityIds}
          languageMode="en"
          onHome={onHome}
          onSelect={onSelect}
          reducedMotion={false}
        />,
      );
    });
    const firstDoor = container.querySelector<HTMLButtonElement>('[data-activity-id="peek"]')!;
    const secondDoor = container.querySelector<HTMLButtonElement>('[data-activity-id="phone"]')!;
    const home = container.querySelector<HTMLButtonElement>('[aria-label="Home"]')!;

    await act(async () => {
      firstDoor.dispatchEvent(pointerEvent('pointerdown', 1));
      home.click();
      secondDoor.dispatchEvent(pointerEvent('pointerdown', 2));
      secondDoor.dispatchEvent(pointerEvent('pointerup', 2));
      firstDoor.dispatchEvent(pointerEvent('pointerup', 1));
    });

    expect(onHome).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('peek');
  });

  it('supports RTL, English layout, keyboard activation, and reduced motion state', async () => {
    const hebrew = renderToStaticMarkup(
      <CommunicationShelf
        activityIds={allActivityIds}
        languageMode="he"
        onHome={() => undefined}
        onSelect={() => undefined}
        reducedMotion
      />,
    );
    const english = renderToStaticMarkup(
      <CommunicationShelf
        activityIds={allActivityIds}
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
          activityIds={allActivityIds}
          languageMode="en"
          onHome={() => undefined}
          onSelect={onSelect}
          reducedMotion
        />,
      );
    });
    const phoneDoor = container.querySelector<HTMLButtonElement>('[data-activity-id="phone"]')!;
    phoneDoor.focus();
    expect(document.activeElement).toBe(phoneDoor);
    await act(async () => phoneDoor.click());
    expect(onSelect).toHaveBeenCalledWith('phone');
  });
});
