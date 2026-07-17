import {
  createInitialProgress,
  createInitialSettings,
  RECENT_RESULT_LIMIT,
  STORAGE_SCHEMA_VERSION,
} from './progression';
import { normalizeChildName } from './childName';
import { DEFAULT_ENGLISH_VOICE_LOCALE } from './narrationVoice';
import {
  COMMUNICATION_PROGRESS_VERSION,
  RECENT_COMMUNICATION_CONTENT_LIMIT,
  type CommunicationProgress,
} from './communicationProgress';
import type {
  AppProgress,
  ConceptStat,
  DomainProgress,
  RecentRoundResult,
  ToddlerSettings,
} from './types';
import { DOMAIN_KEYS } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeTotalStars(value: unknown, domainStars: number): number {
  return Math.max(domainStars, 0, Math.ceil(asNumber(value, domainStars)));
}

function clampLevel(value: unknown): DomainProgress['level'] {
  if (value === 2 || value === 3) {
    return value;
  }
  return 1;
}

function sanitizeConceptStat(value: unknown): ConceptStat {
  const fallback: ConceptStat = {
    attempts: 0,
    successes: 0,
    streak: 0,
    mastery: 0,
  };

  if (!isRecord(value)) {
    return fallback;
  }

  const attempts = Math.max(0, Math.round(asNumber(value.attempts, 0)));
  const successes = Math.max(0, Math.min(attempts, Math.round(asNumber(value.successes, 0))));
  const streak = Math.max(0, Math.round(asNumber(value.streak, 0)));
  const mastery = Math.min(1, Math.max(0, asNumber(value.mastery, successes === 0 ? 0 : successes / Math.max(1, attempts))));

  return { attempts, successes, streak, mastery };
}

function sanitizeSettings(input: unknown, prefersReducedMotion: boolean): ToddlerSettings {
  const defaults = createInitialSettings(prefersReducedMotion);
  if (!isRecord(input)) {
    return defaults;
  }

  const languageMode = input.languageMode === 'en' || input.languageMode === 'bilingual' ? input.languageMode : 'he';
  const englishVoiceLocale = input.englishVoiceLocale === 'en-GB'
    ? 'en-GB'
    : DEFAULT_ENGLISH_VOICE_LOCALE;
  const soundLevel = Math.min(1, Math.max(0, asNumber(input.soundLevel, defaults.soundLevel)));
  const reducedMotion = typeof input.reducedMotion === 'boolean' ? input.reducedMotion : defaults.reducedMotion;
  const quietMode = typeof input.quietMode === 'boolean' ? input.quietMode : defaults.quietMode;

  return {
    childName: normalizeChildName(input.childName),
    languageMode,
    englishVoiceLocale,
    soundLevel,
    reducedMotion,
    quietMode,
  };
}

function sanitizeRecentResult(value: unknown): RecentRoundResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const success = value.success === true;
  return {
    completedAt: Math.max(0, Math.round(asNumber(value.completedAt, 0))),
    level: clampLevel(value.level),
    success,
    firstAttempt: success && value.firstAttempt === true,
    attempts: Math.max(1, Math.round(asNumber(value.attempts, 1))),
  };
}

function sanitizeDomain(value: unknown, fallback: DomainProgress): DomainProgress {
  if (!isRecord(value)) {
    return fallback;
  }

  const conceptsSource = isRecord(value.concepts) ? value.concepts : {};
  const concepts = Object.fromEntries(
    Object.entries(conceptsSource).map(([conceptId, stat]) => [conceptId, sanitizeConceptStat(stat)]),
  );
  const attempts = Math.max(0, Math.round(asNumber(value.attempts, fallback.attempts)));
  const successes = Math.max(0, Math.min(attempts, Math.round(asNumber(value.successes, fallback.successes))));
  const level = clampLevel(value.level);
  const recentSource = Array.isArray(value.recentResults) ? value.recentResults : [];
  const recentResults = recentSource
    .map(sanitizeRecentResult)
    .filter((result): result is RecentRoundResult => result !== null)
    .slice(-RECENT_RESULT_LIMIT);
  const completedRounds = Math.max(
    successes,
    Math.round(asNumber(value.completedRounds, successes)),
  );
  const firstAttemptSuccesses = Math.max(
    0,
    Math.min(completedRounds, Math.round(asNumber(value.firstAttemptSuccesses, 0))),
  );

  return {
    attempts,
    successes,
    streak: Math.max(0, Math.round(asNumber(value.streak, fallback.streak))),
    level,
    highestLevel: Math.max(level, clampLevel(value.highestLevel)) as DomainProgress['highestLevel'],
    completedRounds,
    firstAttemptSuccesses,
    totalAttempts: Math.max(attempts, Math.round(asNumber(value.totalAttempts, attempts))),
    mastery: Math.min(1, Math.max(0, asNumber(value.mastery, fallback.mastery))),
    stars: Math.max(0, Math.round(asNumber(value.stars, fallback.stars))),
    lastPracticedAt: Math.max(0, Math.round(asNumber(value.lastPracticedAt, fallback.lastPracticedAt))),
    lastProgressionChoice: value.lastProgressionChoice === 'next' || value.lastProgressionChoice === 'replay'
      ? value.lastProgressionChoice
      : null,
    recentResults,
    concepts,
  };
}

function readLegacySettings(raw: Record<string, unknown>, prefersReducedMotion: boolean): ToddlerSettings {
  const preferences = isRecord(raw.preferences) ? raw.preferences : {};
  return sanitizeSettings(
    {
      languageMode: preferences.language ?? preferences.languageMode,
      englishVoiceLocale: preferences.englishVoice ?? preferences.englishVoiceLocale,
      soundLevel: preferences.sound ?? preferences.soundLevel,
      reducedMotion: preferences.motionReduced ?? preferences.reducedMotion,
      quietMode: preferences.quiet ?? preferences.quietMode,
      childName: preferences.childName,
    },
    prefersReducedMotion,
  );
}

function sanitizeDomains(source: unknown, template: AppProgress['domains']): AppProgress['domains'] {
  const output = { ...template };
  if (!isRecord(source)) {
    return output;
  }

  for (const domain of DOMAIN_KEYS) {
    output[domain] = sanitizeDomain(source[domain], template[domain]);
  }

  return output;
}

function sanitizeCommunicationProgress(
  value: unknown,
  fallback: CommunicationProgress,
): CommunicationProgress {
  if (!isRecord(value)) {
    return fallback;
  }

  const contentVersion = typeof value.contentVersion === 'string' && value.contentVersion.trim()
    ? value.contentVersion.trim()
    : null;
  const recentSource = Array.isArray(value.recentContentIds) ? value.recentContentIds : [];
  const recentContentIds = Array.from(new Set(
    recentSource.filter((contentId): contentId is string => (
      typeof contentId === 'string' && contentId.trim().length > 0
    )).map((contentId) => contentId.trim()),
  )).slice(-RECENT_COMMUNICATION_CONTENT_LIMIT);

  return {
    version: COMMUNICATION_PROGRESS_VERSION,
    contentVersion,
    sessionsCompleted: Math.max(0, Math.round(asNumber(value.sessionsCompleted, 0))),
    roundsSeen: Math.max(0, Math.round(asNumber(value.roundsSeen, 0))),
    recentContentIds,
    lastPlayedAt: Math.max(0, Math.round(asNumber(value.lastPlayedAt, 0))),
  };
}

export function migrateStoredProgress(
  raw: unknown,
  options: { prefersReducedMotion?: boolean; now?: number } = {},
): AppProgress {
  const prefersReducedMotion = options.prefersReducedMotion ?? false;
  const now = options.now ?? Date.now();
  const base = createInitialProgress(prefersReducedMotion, now);

  if (!isRecord(raw)) {
    return base;
  }

  if (
    raw.version === STORAGE_SCHEMA_VERSION
    || raw.version === 5
    || raw.version === 4
    || raw.version === 3
    || raw.version === 2
  ) {
    const settings = sanitizeSettings(raw.settings, prefersReducedMotion);
    const domains = sanitizeDomains(raw.domains, base.domains);
    const domainStars = Object.values(domains).reduce((sum, domain) => sum + domain.stars, 0);

    return {
      version: STORAGE_SCHEMA_VERSION,
      updatedAt: Math.max(0, Math.round(asNumber(raw.updatedAt, now))),
      totalStars: sanitizeTotalStars(raw.totalStars, domainStars),
      settings,
      domains,
      communication: sanitizeCommunicationProgress(raw.communication, base.communication),
    };
  }

  const settings = readLegacySettings(raw, prefersReducedMotion);
  const legacyDomainSource = raw.domains ?? raw.stats;
  const domains = sanitizeDomains(legacyDomainSource, base.domains);
  const domainStars = Object.values(domains).reduce((sum, domain) => sum + domain.stars, 0);

  return {
    version: STORAGE_SCHEMA_VERSION,
    updatedAt: Math.max(0, Math.round(asNumber(raw.updatedAt, now))),
    totalStars: sanitizeTotalStars(raw.totalStars, domainStars),
    settings,
    domains,
    communication: base.communication,
  };
}

export function serializeProgress(progress: AppProgress): string {
  return JSON.stringify(progress);
}
