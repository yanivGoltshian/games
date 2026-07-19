import type {
  AppProgress,
  ConceptStat,
  DomainKey,
  DomainProgress,
  LevelRecommendation,
  ProgressionChoice,
  ProgressUpdateSummary,
  RecordedRound,
  ToddlerSettings,
} from './types';
import { DEFAULT_CHILD_NAME } from './childName';
import { DEFAULT_ENGLISH_VOICE_LOCALE } from './narrationVoice';
import { DOMAIN_KEYS } from './types';

export const STORAGE_SCHEMA_VERSION = 6;
export const RECENT_RESULT_LIMIT = 5;
const LEVEL_THRESHOLDS = [0, 0.42, 0.62, 1] as const;

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function createInitialSettings(prefersReducedMotion = false): ToddlerSettings {
  return {
    childName: DEFAULT_CHILD_NAME,
    languageMode: 'he',
    englishVoiceLocale: DEFAULT_ENGLISH_VOICE_LOCALE,
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
    highestLevel: 1,
    completedRounds: 0,
    firstAttemptSuccesses: 0,
    totalAttempts: 0,
    mastery: 0,
    stars: 0,
    lastPracticedAt: 0,
    lastProgressionChoice: null,
    recentResults: [],
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

export function recommendLevelAdvance(
  domain: DomainProgress,
  domainKey?: DomainKey,
): LevelRecommendation | null {
  if (domain.level >= 3 || domain.mastery < LEVEL_THRESHOLDS[domain.level]) {
    return null;
  }

  const recentAtCurrentLevel = domain.recentResults
    .filter((result) => result.level === domain.level)
    .slice(-RECENT_RESULT_LIMIT);

  if (domainKey === 'puzzle' && domain.level === 1) {
    const lastTwoResults = recentAtCurrentLevel.slice(-2);
    if (
      lastTwoResults.length === 2
      && lastTwoResults.every((result) => result.success && result.firstAttempt)
    ) {
      return {
        currentLevel: domain.level,
        nextLevel: 2,
      };
    }
    return null;
  }

  if (recentAtCurrentLevel.length < 3) {
    return null;
  }

  const successes = recentAtCurrentLevel.filter((result) => result.success).length;
  const firstAttempts = recentAtCurrentLevel.filter((result) => result.firstAttempt).length;
  const successRate = successes / recentAtCurrentLevel.length;
  const firstAttemptRate = firstAttempts / recentAtCurrentLevel.length;
  const recentFirstAttemptStreak = [...recentAtCurrentLevel]
    .reverse()
    .findIndex((result) => !result.success || !result.firstAttempt);
  const consecutiveFirstAttempts = recentFirstAttemptStreak === -1
    ? recentAtCurrentLevel.length
    : recentFirstAttemptStreak;

  if (successRate < 0.8 || firstAttemptRate < 0.8 || consecutiveFirstAttempts < 3) {
    return null;
  }

  return {
    currentLevel: domain.level,
    nextLevel: (domain.level + 1) as DomainProgress['level'],
  };
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
  const roundAttempts = Math.max(1, Math.round(round.attempts));
  const practiceAttempts = Math.max(1, Math.ceil(roundAttempts / requiredActions));
  const firstAttempt = success && roundAttempts <= requiredActions;

  for (const conceptId of concepts) {
    const previous = nextConcepts[conceptId] ?? createInitialConceptStat();
    nextConcepts[conceptId] = updateConceptStat(previous, success, practiceAttempts);
  }

  const attempts = domain.attempts + 1;
  const successes = domain.successes + (success ? 1 : 0);
  const streak = firstAttempt ? domain.streak + 1 : 0;
  const recentResults = [
    ...domain.recentResults,
    {
      completedAt: now,
      level: domain.level,
      success,
      firstAttempt,
      attempts: roundAttempts,
    },
  ].slice(-RECENT_RESULT_LIMIT);

  const domainBeforeMastery = {
    ...domain,
    attempts,
    successes,
    streak,
    completedRounds: domain.completedRounds + (success ? 1 : 0),
    firstAttemptSuccesses: domain.firstAttemptSuccesses + (firstAttempt ? 1 : 0),
    totalAttempts: domain.totalAttempts + roundAttempts,
    recentResults,
    concepts: nextConcepts,
  };

  const mastery = computeDomainMastery(domainBeforeMastery);
  const nextDomain: DomainProgress = {
    ...domainBeforeMastery,
    mastery,
    stars: domain.stars + (success ? 1 : 0),
    lastPracticedAt: now,
  };
  const recommendation = success ? recommendLevelAdvance(nextDomain, domainKey) : null;
  const leveledUp = recommendation !== null;
  const updatedDomain: DomainProgress = leveledUp
    ? {
        ...nextDomain,
        level: recommendation.nextLevel,
        highestLevel: Math.max(nextDomain.highestLevel, recommendation.nextLevel) as DomainProgress['highestLevel'],
        lastProgressionChoice: 'next',
      }
    : nextDomain;
  const starsEarned = success ? 1 : 0;
  const milestone = success && (recommendation !== null || streak % 4 === 0);

  const nextProgress: AppProgress = {
    ...progress,
    updatedAt: now,
    totalStars: progress.totalStars + starsEarned,
    domains: {
      ...progress.domains,
      [domainKey]: updatedDomain,
    },
  };

  return {
    progress: nextProgress,
    summary: {
      starsEarned,
      leveledUp,
      milestone,
      level: updatedDomain.level,
      mastery,
      firstAttempt,
      recommendation,
    },
  };
}

export function applyProgressionChoice(
  progress: AppProgress,
  domainKey: DomainKey,
  choice: ProgressionChoice,
  now = Date.now(),
): { progress: AppProgress; domain: DomainProgress; accepted: boolean } {
  const domain = progress.domains[domainKey];
  const recommendation = recommendLevelAdvance(domain, domainKey);
  if (choice === 'next' && recommendation === null) {
    return { progress, domain, accepted: false };
  }

  const level = choice === 'next' ? recommendation!.nextLevel : domain.level;
  const nextDomain: DomainProgress = {
    ...domain,
    level,
    highestLevel: Math.max(domain.highestLevel, level) as DomainProgress['highestLevel'],
    lastProgressionChoice: choice,
  };
  const nextProgress: AppProgress = {
    ...progress,
    updatedAt: now,
    domains: {
      ...progress.domains,
      [domainKey]: nextDomain,
    },
  };

  return {
    progress: nextProgress,
    domain: nextDomain,
    accepted: true,
  };
}
