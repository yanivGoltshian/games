import { describe, expect, it } from 'vitest';
import {
  createInitialToyPhoneMetrics,
  migrateToyPhoneMetrics,
  recordToyPhoneMetric,
} from './toyPhoneProgress';

describe('Toy Phone nonclinical metrics', () => {
  it('persists only sessions, calls, time-to-answer, exit, and media readiness', () => {
    let metrics = createInitialToyPhoneMetrics();
    metrics = recordToyPhoneMetric(metrics, { type: 'session' });
    metrics = recordToyPhoneMetric(metrics, { type: 'call' });
    metrics = recordToyPhoneMetric(metrics, { type: 'time-to-answer', milliseconds: 640.4 });
    metrics = recordToyPhoneMetric(metrics, { type: 'exit', reason: 'three-calls' });
    metrics = recordToyPhoneMetric(metrics, { type: 'media-readiness', status: 'ready' });

    expect(metrics).toEqual({
      version: 1,
      sessions: 1,
      calls: 1,
      timeToAnswer: { samples: 1, totalMs: 640 },
      exit: {
        'three-calls': 1,
        'four-minutes': 0,
        back: 0,
        background: 0,
        'asset-error': 0,
      },
      mediaReadiness: { ready: 1, 'not-ready': 0 },
    });

    const serialized = JSON.stringify(metrics);
    for (const forbidden of [
      'completionMethod',
      'effort',
      'audio',
      'transcript',
      'speaker',
      'clinical',
      'locale',
      'contentId',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('sanitizes malformed persisted metrics without adding identity or content fields', () => {
    expect(migrateToyPhoneMetrics({
      version: 1,
      sessions: -4,
      calls: 2.8,
      timeToAnswer: { samples: 2, totalMs: Number.POSITIVE_INFINITY },
      exit: { background: 3 },
      mediaReadiness: { 'not-ready': 2 },
      transcript: 'must disappear',
    })).toEqual({
      version: 1,
      sessions: 0,
      calls: 3,
      timeToAnswer: { samples: 2, totalMs: 0 },
      exit: {
        'three-calls': 0,
        'four-minutes': 0,
        back: 0,
        background: 3,
        'asset-error': 0,
      },
      mediaReadiness: { ready: 0, 'not-ready': 2 },
    });
  });
});
