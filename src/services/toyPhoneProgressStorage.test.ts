import { describe, expect, it, vi } from 'vitest';
import {
  TOY_PHONE_METRICS_STORAGE_KEY,
  loadToyPhoneMetrics,
  persistToyPhoneMetric,
} from './toyPhoneProgressStorage';

describe('Toy Phone metric storage', () => {
  it('round-trips the nonclinical metric schema', () => {
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
    persistToyPhoneMetric({ type: 'session' }, storage);
    persistToyPhoneMetric({ type: 'time-to-answer', milliseconds: 800 }, storage);
    persistToyPhoneMetric({ type: 'media-readiness', status: 'not-ready' }, storage);

    expect(loadToyPhoneMetrics(storage)).toMatchObject({
      sessions: 1,
      calls: 0,
      timeToAnswer: { samples: 1, totalMs: 800 },
      mediaReadiness: { ready: 0, 'not-ready': 1 },
    });
    expect(storage.getItem(TOY_PHONE_METRICS_STORAGE_KEY)).not.toContain('method');
  });

  it('keeps play available when privacy settings block metric writes', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const blockedStorage: Storage = {
      get length() {
        return 0;
      },
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    };

    expect(() => persistToyPhoneMetric({ type: 'session' }, blockedStorage)).not.toThrow();
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('Unable to save Toy Phone metrics'),
    );
    warning.mockRestore();
  });
});
