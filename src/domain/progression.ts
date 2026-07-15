import type {
  AppProgress,
  ConceptStat,
  DomainKey,
  DomainProgress,
  ProgressUpdateSummary,
  RecordedRound,
  ToddlerSettings,
} from './types';
import { DOMAIN_KEYS } from './types';

export const STORAGE_SCHEMA_VERSION = 2;
const LEVEL_THRESHOLDS = [0, 0.42, 0.62, 1] as const;

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function createInitialSettings(prefersReducedMotion = false): ToddlerSettings {
  return {
    languageMode: 'he',
    englishVoiceLocale: 'en-US',
    soundLevel: 0.7,
    reducedMotion: prefersReducedMotion,
    quietMode: false,
  };
}

export function createInitialConceptStat(): ConceptStat {
  return {
    attempts: 0,
    successes: 0,
    streak: 0,
    mastery: 0,
  };
}

export function createInitialDomainProgress(): DomainProgress {
  return {
    attempts: 0,
    successes: 0,
    streak: 0,
    level: 1,
    mastery: 0,
    stars: 0,
    lastPracticedAt: 0,
    concepts: {},
  };
}

export function createInitialProgress(prefersReducedMotion = false, now = Date.now()): AppProgress {
  return {
    version: STORAGE_SCHEMA_VERSION,
    updatedAt: now,
    totalStars: 0,
    settings: createInitialSettings(prefersReducedMotion),
    domains: Object.fromEntries(DOMAIN_KEYS.map((domain) => [domain, createInitialDomainProgress()])) as AppProgress['domains'],
  };
}

export function computeConceptMastery(stat: ConceptStat): number {
  const accuracy = stat.attempts === 0 ? 0 : stat.successes / stat.attempts;
  const streakBoost = Math.min(stat.streak, 4) * 0.08;
  return clamp(accuracy * 0.82 + streakBoost);
}

export function computeDomainMastery(domain: DomainProgress): number {
  const conceptValues = Object.values(domain.concepts);
  if (conceptValues.length === 0) {
    return clamp(domain.successes === 0 ? 0 : domain.successes / Math.max(1, domain.attempts));
  }

  const conceptAverage = conceptValues.reduce((sum, stat) => sum + stat.mastery, 0) / conceptValues.length;
  const roundAccuracy = domain.attempts === 0 ? 0 : domain.successes / domain.attempts;
  return clamp(conceptAverage * 0.72 + roundAccuracy * 0.28);
}

export function buildPracticeWeights(domain: DomainProgress, conceptIds: readonly string[]): Record<string, number> {
  return Object.fromEntries(
    conceptIds.map((conceptId) => {
      const stat = domain.concepts[conceptId] ?? createInitialConceptStat();
      const freshnessBonus = stat.attempts < 2 ? 0.8 : 0;
      return [conceptId, 1 + (1 - stat.mastery) * 3.4 + freshnessBonus];
    }),
  );
}

function updateConceptStat(previous: ConceptStat, success: boolean, practiceAttempts: number): ConceptStat {
  const next: ConceptStat = {
    attempts: previous.attempts + practiceAttempts,
    successes: previous.successes + (success ? 1 : 0),
    streak: success && practiceAttempts === 1 ? previous.streak + 1 : 0,
    mastery: 0,
  };

  next.mastery = computeConceptMastery(next);
  return next;
}

export function applyRoundResult(
  progress: AppProgress,
  domainKey: DomainKey,
  round: RecordedRound,
  now = Date.now(),
): { progress: AppProgress; summary: ProgressUpdateSummary } {
  const success = round.success ?? true;
  const domain = progress.domains[domainKey];
  const concepts = round.concepts.length > 0 ? Array.from(new Set(round.concepts)) : [domainKey];
  const nextConcepts = { ...domain.concepts };
  const requiredActions = Math.max(1, Math.round(round.requiredActions ?? 1));
  const practiceAttempts = Math.max(1, Math.ceil(Math.max(1, round.attempts) / requiredActions));

  for (const conceptId of concepts) {
    const previous = nextConcepts[conceptId] ?? createInitialConceptStat();
    nextConcepts[conceptId] = updateConceptStat(previous, success, practiceAttempts);
  }

  const attempts = domain.attempts + 1;
  const successes = domain.successes + (success ? 1 : 0);
  const streak = success && practiceAttempts === 1 ? domain.streak + 1 : 0;

  const domainBeforeMastery = {
    ...domain,
    attempts,
    successes,
    streak,
    concepts: nextConcepts,
  };

  const mastery = computeDomainMastery(domainBeforeMastery);
  let level = domain.level;
  let leveledUp = false;
  if (success && level < 3 && streak >= level * 3 && mastery >= LEVEL_THRESHOLDS[level]) {
    level = (level + 1) as DomainProgress['level'];
    leveledUp = true;
  }

  const starsEarned = success ? 1 + (leveledUp ? 1 : 0) : 0;
  const milestone = success && (leveledUp || streak % 4 === 0);
  const nextDomain: DomainProgress = {
    ...domainBeforeMastery,
    level,
    mastery,
    stars: domain.stars + starsEarned,
    lastPracticedAt: now,
  };

  const nextProgress: AppProgress = {
    ...progress,
    updatedAt: now,
    totalStars: progress.totalStars + starsEarned,
    domains: {
      ...progress.domains,
      [domainKey]: nextDomain,
    },
  };

  return {
    progress: nextProgress,
    summary: {
      starsEarned,
      leveledUp,
      milestone,
      level,
      mastery,
    },
  };
}
