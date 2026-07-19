// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import App from './App';
import { soundService } from './services/sound';
import { speechService } from './services/speech';

const RETIRED_ROUTES = [
  '#/communication',
  '#/communication/peek-and-discover',
  '#/communication/word-train',
  '#/communication/toy-phone',
  '#/communication/story-that-waits',
  '#/games/syllableTrain',
  '#/games/word-stretch',
] as const;

describe('retired activity routes', () => {
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
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
  });

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  it.each(RETIRED_ROUTES)(
    'fails %s closed before media, timers, or microphone can start',
    async (retiredRoute) => {
      vi.useFakeTimers();
      localStorage.clear();
      window.history.replaceState(null, '', retiredRoute);
      const speechUnlock = vi.spyOn(speechService, 'unlock');
      const speechPlayback = vi.spyOn(speechService, 'speakSegments');
      const soundUnlock = vi.spyOn(soundService, 'unlock');
      const getUserMedia = vi.fn();
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia },
      });
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<App />);
      });

      expect(window.location.hash).toBe('#/');
      expect(container.querySelectorAll('.portal-grid__item')).toHaveLength(7);
      expect(container.querySelector('.game-shell')).toBeNull();
      expect(speechUnlock).not.toHaveBeenCalled();
      expect(speechPlayback).not.toHaveBeenCalled();
      expect(soundUnlock).not.toHaveBeenCalled();
      expect(getUserMedia).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);

      await act(async () => root.unmount());
      container.remove();
      vi.restoreAllMocks();
      vi.useRealTimers();
    },
  );
});
