import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');

describe('family photo privacy boundaries', () => {
  it('keeps private preview loading out of the home portal and lock screen', () => {
    const homeSource = readFileSync(resolve(ROOT, 'src/components/HomeScreen.tsx'), 'utf8');
    const gateSource = readFileSync(resolve(ROOT, 'src/components/CaregiverGate.tsx'), 'utf8');
    const appSource = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');

    expect(homeSource).not.toContain('FamilyPhoto');
    expect(homeSource).not.toContain('familyPhoto');
    expect(gateSource).not.toContain('FamilyPhoto');
    expect(gateSource).not.toContain('familyPhoto');
    expect(appSource).not.toContain('FamilyPhoto');
    expect(appSource).not.toContain('familyPhoto');
  });

  it('does not route blob URLs through service-worker fetch or caches', () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const cacheMatch = vi.fn();
    const networkFetch = vi.fn();
    const serviceWorkerSource = readFileSync(resolve(ROOT, 'public/sw.js'), 'utf8');
    const self = {
      location: { origin: 'https://local.example' },
      addEventListener: (name: string, listener: (event: unknown) => void) => {
        listeners.set(name, listener);
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    };
    const caches = {
      match: cacheMatch,
      open: vi.fn(),
      keys: vi.fn(),
      delete: vi.fn(),
    };
    const evaluate = new Function('self', 'caches', 'fetch', 'Response', serviceWorkerSource);
    evaluate(self, caches, networkFetch, Response);
    const respondWith = vi.fn();

    listeners.get('fetch')?.({
      request: {
        method: 'GET',
        mode: 'same-origin',
        url: 'blob:https://local.example/synthetic-private-photo',
      },
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
    expect(cacheMatch).not.toHaveBeenCalled();
    expect(networkFetch).not.toHaveBeenCalled();
  });
});
