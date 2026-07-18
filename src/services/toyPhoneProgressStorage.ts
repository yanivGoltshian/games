import {
  createInitialToyPhoneMetrics,
  migrateToyPhoneMetrics,
  recordToyPhoneMetric,
  type ToyPhoneMetricEvent,
  type ToyPhoneMetrics,
} from '../domain/toyPhoneProgress';

export const TOY_PHONE_METRICS_STORAGE_KEY = 'sean-learning-adventure-toy-phone-metrics';

function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Unable to access Toy Phone metric storage: ${message}`);
    return null;
  }
}

export function loadToyPhoneMetrics(
  storage: Storage | null = defaultStorage(),
): ToyPhoneMetrics {
  if (!storage) {
    return createInitialToyPhoneMetrics();
  }
  try {
    const raw = storage.getItem(TOY_PHONE_METRICS_STORAGE_KEY);
    return migrateToyPhoneMetrics(raw ? JSON.parse(raw) : null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Unable to load Toy Phone metrics: ${message}`);
    return createInitialToyPhoneMetrics();
  }
}

export function saveToyPhoneMetrics(
  metrics: ToyPhoneMetrics,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(TOY_PHONE_METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Unable to save Toy Phone metrics: ${message}`);
  }
}

export function persistToyPhoneMetric(
  event: ToyPhoneMetricEvent,
  storage: Storage | null = defaultStorage(),
): ToyPhoneMetrics {
  const next = recordToyPhoneMetric(loadToyPhoneMetrics(storage), event);
  saveToyPhoneMetrics(next, storage);
  return next;
}
