// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../domain/progression';
import { CaregiverPanel } from './CaregiverPanel';

describe('CaregiverPanel child name', () => {
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
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('commits a trimmed Unicode name through the existing settings callback', async () => {
    const onUpdateSettings = vi.fn();
    await act(async () => {
      root.render(
        <CaregiverPanel
          progress={createInitialProgress(false, 1)}
          onBack={() => undefined}
          onReset={() => undefined}
          onUpdateSettings={onUpdateSettings}
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      valueSetter.call(input, '  נוֹעָה   לִי  ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(onUpdateSettings).toHaveBeenCalledWith({ childName: 'נוֹעָה לִי' });
    expect(input.value).toBe('נוֹעָה לִי');
  });

  it('resolves whitespace-only edits back to the default name', async () => {
    const progress = createInitialProgress(false, 1);
    progress.settings.childName = 'נועה';
    const onUpdateSettings = vi.fn();
    await act(async () => {
      root.render(
        <CaregiverPanel
          progress={progress}
          onBack={() => undefined}
          onReset={() => undefined}
          onUpdateSettings={onUpdateSettings}
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      valueSetter.call(input, '   ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(onUpdateSettings).toHaveBeenCalledWith({ childName: 'שון' });
  });

  it('shows and preserves the explicit UK child narration voice', async () => {
    const progress = createInitialProgress(false, 1);
    progress.settings.englishVoiceLocale = 'en-GB';
    await act(async () => {
      root.render(
        <CaregiverPanel
          progress={progress}
          onBack={() => undefined}
          onReset={() => undefined}
          onUpdateSettings={() => undefined}
        />,
      );
    });

    const voiceSelect = [...container.querySelectorAll('select')]
      .find((select) => select.querySelector('option[value="en-US"]'));

    expect(voiceSelect?.value).toBe('en-GB');
    expect(voiceSelect?.selectedOptions[0]?.textContent).toContain('Maisie');
    expect(container.textContent).toContain('Azure אינו מסווג קול ילד עברי');
  });

  it('groups seven core games and two communication games with caregiver-safe metrics only', async () => {
    await act(async () => {
      root.render(
        <CaregiverPanel
          communicationItems={[
            { activityId: 'peek', lastPlayedAt: 0, sessionsCompleted: 0, readiness: 'ready' },
            { activityId: 'phone', lastPlayedAt: 200, sessionsCompleted: 3, readiness: 'ready' },
          ]}
          communicationReleaseAvailable
          progress={createInitialProgress(false, 1)}
          onBack={() => undefined}
          onReset={() => undefined}
          onUpdateSettings={() => undefined}
        />,
      );
    });

    expect(container.querySelectorAll('.domain-progress-item')).toHaveLength(7);
    const group = container.querySelector<HTMLElement>('.communication-caregiver-group')!;
    const items = [...group.querySelectorAll<HTMLElement>('.communication-caregiver-item')];
    expect(items.map((item) => item.dataset.activityId)).toEqual([
      'peek',
      'phone',
    ]);
    expect(group.textContent).toContain('הפעלה אחרונה');
    expect(group.textContent).toContain('מספר הפעלות');
    expect(group.textContent).toContain('מוכנות תוכן');
    expect(group.textContent).not.toMatch(/score|stars|accuracy|completion|speech|thumbnail|https?:/i);
    expect(group.querySelector('img')).toBeNull();
    expect([...group.querySelectorAll('svg')]
      .every((art) => art.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('preserves all seven current domain metrics while pre-release diagnostics stay unavailable', async () => {
    await act(async () => {
      root.render(
        <CaregiverPanel
          communicationItems={[
            { activityId: 'peek', lastPlayedAt: 0, sessionsCompleted: 0, readiness: 'not-ready' },
            { activityId: 'phone', lastPlayedAt: 0, sessionsCompleted: 0, readiness: 'not-ready' },
          ]}
          progress={createInitialProgress(false, 1)}
          onBack={() => undefined}
          onReset={() => undefined}
          onUpdateSettings={() => undefined}
        />,
      );
    });

    expect(container.querySelectorAll('.domain-progress-item')).toHaveLength(7);
    expect(container.querySelectorAll('.communication-caregiver-item')).toHaveLength(2);
    expect(container.querySelector('.communication-caregiver-group')?.textContent)
      .toContain('עדיין לא מוכן');
  });
});
