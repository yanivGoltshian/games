export const TOY_PHONE_METRICS_VERSION = 1 as const;

export type ToyPhoneExitMetric =
  | 'three-calls'
  | 'four-minutes'
  | 'back'
  | 'background'
  | 'asset-error';
export type ToyPhoneMediaReadinessMetric = 'ready' | 'not-ready';

export interface ToyPhoneMetrics {
  version: typeof TOY_PHONE_METRICS_VERSION;
  sessions: number;
  calls: number;
  timeToAnswer: {
    samples: number;
    totalMs: number;
  };
  exit: Record<ToyPhoneExitMetric, number>;
  mediaReadiness: Record<ToyPhoneMediaReadinessMetric, number>;
}

export type ToyPhoneMetricEvent =
  | { type: 'session' }
  | { type: 'call' }
  | { type: 'time-to-answer'; milliseconds: number }
  | { type: 'exit'; reason: ToyPhoneExitMetric }
  | { type: 'media-readiness'; status: ToyPhoneMediaReadinessMetric };

export function createInitialToyPhoneMetrics(): ToyPhoneMetrics {
  return {
    version: TOY_PHONE_METRICS_VERSION,
    sessions: 0,
    calls: 0,
    timeToAnswer: {
      samples: 0,
      totalMs: 0,
    },
    exit: {
      'three-calls': 0,
      'four-minutes': 0,
      back: 0,
      background: 0,
      'asset-error': 0,
    },
    mediaReadiness: {
      ready: 0,
      'not-ready': 0,
    },
  };
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function migrateToyPhoneMetrics(value: unknown): ToyPhoneMetrics {
  const initial = createInitialToyPhoneMetrics();
  if (!isRecord(value) || value.version !== TOY_PHONE_METRICS_VERSION) {
    return initial;
  }
  const timeToAnswer = isRecord(value.timeToAnswer) ? value.timeToAnswer : {};
  const exit = isRecord(value.exit) ? value.exit : {};
  const mediaReadiness = isRecord(value.mediaReadiness) ? value.mediaReadiness : {};
  return {
    version: TOY_PHONE_METRICS_VERSION,
    sessions: safeCount(value.sessions),
    calls: safeCount(value.calls),
    timeToAnswer: {
      samples: safeCount(timeToAnswer.samples),
      totalMs: safeCount(timeToAnswer.totalMs),
    },
    exit: {
      'three-calls': safeCount(exit['three-calls']),
      'four-minutes': safeCount(exit['four-minutes']),
      back: safeCount(exit.back),
      background: safeCount(exit.background),
      'asset-error': safeCount(exit['asset-error']),
    },
    mediaReadiness: {
      ready: safeCount(mediaReadiness.ready),
      'not-ready': safeCount(mediaReadiness['not-ready']),
    },
  };
}

export function recordToyPhoneMetric(
  metrics: ToyPhoneMetrics,
  event: ToyPhoneMetricEvent,
): ToyPhoneMetrics {
  switch (event.type) {
    case 'session':
      return { ...metrics, sessions: metrics.sessions + 1 };
    case 'call':
      return { ...metrics, calls: metrics.calls + 1 };
    case 'time-to-answer': {
      const milliseconds = Number.isFinite(event.milliseconds)
        ? Math.max(0, Math.round(event.milliseconds))
        : 0;
      return {
        ...metrics,
        timeToAnswer: {
          samples: metrics.timeToAnswer.samples + 1,
          totalMs: metrics.timeToAnswer.totalMs + milliseconds,
        },
      };
    }
    case 'exit':
      return {
        ...metrics,
        exit: {
          ...metrics.exit,
          [event.reason]: metrics.exit[event.reason] + 1,
        },
      };
    case 'media-readiness':
      return {
        ...metrics,
        mediaReadiness: {
          ...metrics.mediaReadiness,
          [event.status]: metrics.mediaReadiness[event.status] + 1,
        },
      };
  }
}
