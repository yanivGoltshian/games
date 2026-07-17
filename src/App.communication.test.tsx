// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { CommunicationIntegrationContract } from './communication/integration';
import type { CommunicationReleaseReadiness } from './communication/release';
import { speechService } from './services/speech';

function readyIntegration(
  readinessPatch: Partial<CommunicationReleaseReadiness> = {},
): CommunicationIntegrationContract {
  const ready = {
    status: 'ready' as const,
    contentVersion: 'pack-1',
    locale: 'he-IL' as const,
  };
  return {
    release: {
      explicitlyEnabled: true,
      readiness: {
        peek: { 'he-IL': ready },
        train: { 'he-IL': ready },
        phone: { 'he-IL': ready },
        story: { 'he-IL': ready },
        ...readinessPatch,
      },
    },
    games: {},
  };
}

describe('App communication release routing', () => {
  let container: HTMLDivElement;
  let root: Root | null;
  let getUserMedia: ReturnType<typeof vi.fn>;
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
    const stored = new Map<string, string>();
    const localStorage: Storage = {
      get length() {
        return stored.size;
      },
      clear: () => stored.clear(),
      getItem: (key) => stored.get(key) ?? null,
      key: (index) => [...stored.keys()][index] ?? null,
      removeItem: (key) => {
        stored.delete(key);
      },
      setItem: (key, value) => {
        stored.set(key, value);
      },
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    window.history.replaceState(null, '', '#/');
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
    getUserMedia = vi.fn();
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it('keeps the production home at the current exact eight tiles by default', async () => {
    await act(async () => root?.render(<App />));

    const domains = [...container.querySelectorAll<HTMLElement>('.portal-grid__item')]
      .map((item) => item.dataset.domain);
    expect(domains).toEqual([
      'listening',
      'counting',
      'sorting',
      'puzzle',
      'memory',
      'numberPairs',
      'sillyAlien',
      'syllableTrain',
    ]);
  });

  it('replaces Train with one shelf tile only when enabled and fully ready', async () => {
    await act(async () => root?.render(<App communication={readyIntegration()} />));

    const domains = [...container.querySelectorAll<HTMLElement>('.portal-grid__item')]
      .map((item) => item.dataset.domain);
    expect(domains).toHaveLength(8);
    expect(domains.at(-1)).toBe('communication');
    expect(domains).not.toContain('syllableTrain');
  });

  it('shows all four doors together on the enabled shelf route', async () => {
    window.history.replaceState(null, '', '#/communication');
    await act(async () => root?.render(<App communication={readyIntegration()} />));

    expect([...container.querySelectorAll<HTMLElement>('.communication-door')]
      .map((door) => door.dataset.activityId)).toEqual([
      'peek',
      'train',
      'phone',
      'story',
    ]);
  });

  it('redirects disabled and not-ready direct routes without media or permission side effects', async () => {
    window.history.replaceState(null, '', '#/communication');
    const cancelAll = vi.spyOn(speechService, 'cancelAll');
    const unlock = vi.spyOn(speechService, 'unlock');
    const notReady = readyIntegration({ story: {} });

    await act(async () => root?.render(<App communication={notReady} />));

    expect(window.location.hash).toBe('#/');
    expect(container.querySelectorAll('.portal-grid__item')).toHaveLength(8);
    expect(container.querySelector('[data-domain="communication"]')).toBeNull();
    expect(cancelAll).not.toHaveBeenCalled();
    expect(unlock).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('keeps Train visible when an explicitly disabled direct activity route fails closed', async () => {
    window.history.replaceState(null, '', '#/communication/peek-and-discover');
    const cancelAll = vi.spyOn(speechService, 'cancelAll');
    const unlock = vi.spyOn(speechService, 'unlock');

    await act(async () => root?.render(<App />));

    expect(window.location.hash).toBe('#/');
    expect(container.querySelector('[data-domain="syllableTrain"]')).not.toBeNull();
    expect(container.querySelector('[data-domain="communication"]')).toBeNull();
    expect(cancelAll).not.toHaveBeenCalled();
    expect(unlock).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('fails a ready direct game route closed when no game integration is mounted', async () => {
    window.history.replaceState(null, '', '#/communication/toy-phone');
    await act(async () => root?.render(<App communication={readyIntegration()} />));

    expect(window.location.hash).toBe('#/');
    expect(container.querySelectorAll('.portal-grid__item')).toHaveLength(8);
    expect(container.querySelector('[data-domain="communication"]')).not.toBeNull();
    expect(container.querySelector('.communication-door')).toBeNull();
  });
});
