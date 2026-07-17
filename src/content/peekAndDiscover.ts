import type { CommunicationProgress } from '../domain/communicationProgress';
import {
  createCommunicationLocaleLock,
  type CommunicationGameScope,
  type CommunicationLocaleLock,
} from '../domain/communicationGame';
import type { ConceptCategory, SpeechLocale, ToddlerSettings } from '../domain/types';
import type {
  CommunicationContentRequirements,
  InstalledCommunicationContent,
} from '../services/communicationAssetReadiness';
import type { SpeechSegment } from '../services/speech';
import {
  learningConcepts,
  type LearningConceptDefinition,
  type LearningConceptId,
} from './concepts';

export const PEEK_AND_DISCOVER_CONTENT_VERSION = 'peek-and-discover.v1' as const;
export const PEEK_AND_DISCOVER_ACTIVITY_ID = 'peek-and-discover' as const;

type PeekAndDiscoverGagMotion = 'peek' | 'bounce' | 'wiggle';
export type PeekAndDiscoverVisualGagId = `${ConceptCategory}-${PeekAndDiscoverGagMotion}`;

export interface PeekAndDiscoverContentItem<
  TConcept extends LearningConceptDefinition = LearningConceptDefinition,
> {
  readonly id: TConcept['id'];
  readonly concept: TConcept;
  readonly category: TConcept['category'];
  readonly imageUrl: TConcept['image'];
  readonly gagId: PeekAndDiscoverVisualGagId;
}

export interface PeekAndDiscoverSelectionOptions {
  readonly progress: Pick<CommunicationProgress, 'recentContentIds'>;
  readonly previousCategory?: ConceptCategory | null | undefined;
  readonly selectionIndex: number;
}

export interface PeekAndDiscoverRound {
  readonly scope: CommunicationGameScope;
  readonly locale: SpeechLocale;
  readonly localeLock: CommunicationLocaleLock;
  readonly content: PeekAndDiscoverContentItem;
  readonly roundIndex: number;
  readonly exactWord: string;
  readonly mandatorySegments: PeekAndDiscoverMandatorySegments;
  readonly readiness: CommunicationContentRequirements;
}

export interface PeekAndDiscoverRoundBuilderOptions {
  readonly scope: CommunicationGameScope;
  readonly progress: Pick<CommunicationProgress, 'recentContentIds'>;
  readonly settings: Pick<ToddlerSettings, 'languageMode' | 'englishVoiceLocale'>;
  readonly roundIndex: number;
  readonly previousCategory?: ConceptCategory | null;
}

export type PeekAndDiscoverMandatorySegment = SpeechSegment & {
  readonly recordedText: string;
};

export type PeekAndDiscoverMandatorySegments = readonly [PeekAndDiscoverMandatorySegment];

const PEEK_AND_DISCOVER_CONCEPT_BY_ID = new Map<
  LearningConceptId,
  LearningConceptDefinition
>(learningConcepts.map((concept) => [concept.id, concept]));
const PEEK_AND_DISCOVER_CONCEPT_IDS = new Set<string>(
  learningConcepts.map((concept) => concept.id),
);

const GAG_MOTIONS_BY_CATEGORY: Record<ConceptCategory, readonly PeekAndDiscoverGagMotion[]> = {
  animal: ['peek', 'wiggle', 'bounce'],
  clothing: ['wiggle', 'peek'],
  furniture: ['bounce', 'peek'],
  fruit: ['bounce', 'peek', 'wiggle'],
  nature: ['wiggle', 'bounce'],
  tableware: ['bounce', 'wiggle'],
  toy: ['bounce', 'peek'],
  transport: ['peek', 'bounce', 'wiggle'],
  vegetable: ['peek', 'wiggle'],
};

function requirePeekAndDiscoverConcept(
  id: LearningConceptId,
): LearningConceptDefinition {
  const concept = PEEK_AND_DISCOVER_CONCEPT_BY_ID.get(id);
  if (!concept) {
    throw new Error(`Unknown Peek and Discover concept: ${id}`);
  }
  return concept;
}

function buildVisualGagId(concept: LearningConceptDefinition): PeekAndDiscoverVisualGagId {
  const motions = GAG_MOTIONS_BY_CATEGORY[concept.category];
  const motion = motions[concept.id.length % motions.length];
  if (!motion) {
    throw new Error(`Missing Peek and Discover gag motion for ${concept.category}.`);
  }
  return `${concept.category}-${motion}` as PeekAndDiscoverVisualGagId;
}

function normalizeSelectionIndex(selectionIndex: number): number {
  if (!Number.isFinite(selectionIndex)) {
    return 0;
  }
  return Math.max(0, Math.trunc(selectionIndex));
}

function exactWordForLocale(
  concept: LearningConceptDefinition,
  locale: SpeechLocale,
): string {
  return locale === 'he-IL' ? concept.he : concept.en;
}

function isPeekAndDiscoverContentId(value: string): value is LearningConceptId {
  return PEEK_AND_DISCOVER_CONCEPT_IDS.has(value);
}

function buildContentItem(id: LearningConceptId): PeekAndDiscoverContentItem {
  const concept = requirePeekAndDiscoverConcept(id);
  return {
    id: concept.id,
    concept,
    category: concept.category,
    imageUrl: concept.image,
    gagId: buildVisualGagId(concept),
  };
}

export const PEEK_AND_DISCOVER_CONTENT: readonly PeekAndDiscoverContentItem[] =
  learningConcepts.map((concept) => buildContentItem(concept.id));

export const PEEK_AND_DISCOVER_INSTALLED_CONTENT: InstalledCommunicationContent = {
  contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
  images: PEEK_AND_DISCOVER_CONTENT.map((item) => ({
    kind: 'url' as const,
    value: item.imageUrl,
  })),
};

export function resolvePeekAndDiscoverLocale(
  settings: Pick<ToddlerSettings, 'languageMode' | 'englishVoiceLocale'>,
  roundIndex: number,
): SpeechLocale {
  if (settings.languageMode === 'he') {
    return 'he-IL';
  }

  if (settings.languageMode === 'en') {
    return settings.englishVoiceLocale;
  }
  return normalizeSelectionIndex(roundIndex) % 2 === 0
    ? 'he-IL'
    : settings.englishVoiceLocale;
}

export function createPeekAndDiscoverScope(
  sessionId: string,
  roundIndex: number,
): CommunicationGameScope {
  const ordinal = normalizeSelectionIndex(roundIndex) + 1;
  return {
    activityId: PEEK_AND_DISCOVER_ACTIVITY_ID,
    sessionId,
    roundId: `round-${ordinal}`,
    stepId: `word-${ordinal}`,
  };
}

export function selectPeekAndDiscoverContent(
  options: PeekAndDiscoverSelectionOptions,
): PeekAndDiscoverContentItem {
  const recentIds = new Set(
    options.progress.recentContentIds.filter(isPeekAndDiscoverContentId),
  );
  const selectionIndex = normalizeSelectionIndex(options.selectionIndex);
  const startIndex = selectionIndex % PEEK_AND_DISCOVER_CONTENT.length;
  const nonRecent = PEEK_AND_DISCOVER_CONTENT.filter((item) => !recentIds.has(item.id));
  const freshnessPool = nonRecent.length > 0 ? nonRecent : PEEK_AND_DISCOVER_CONTENT;
  const diversePool = options.previousCategory === undefined || options.previousCategory === null
    ? freshnessPool
    : freshnessPool.filter((item) => item.category !== options.previousCategory);
  const pool = diversePool.length > 0 ? diversePool : freshnessPool;
  const allowedIds = new Set(pool.map((item) => item.id));

  for (let offset = 0; offset < PEEK_AND_DISCOVER_CONTENT.length; offset += 1) {
    const candidate = PEEK_AND_DISCOVER_CONTENT[
      (startIndex + offset) % PEEK_AND_DISCOVER_CONTENT.length
    ];
    if (candidate && allowedIds.has(candidate.id)) {
      return candidate;
    }
  }

  const fallback = PEEK_AND_DISCOVER_CONTENT[0];
  if (!fallback) {
    throw new Error('Peek and Discover requires at least one vocabulary concept.');
  }
  return fallback;
}

export function buildPeekAndDiscoverMandatorySegment(
  content: PeekAndDiscoverContentItem,
  locale: SpeechLocale,
): PeekAndDiscoverMandatorySegments {
  const exactWord = exactWordForLocale(content.concept, locale);
  return [{
    text: exactWord,
    locale,
    recordedText: exactWord,
  }];
}

export function buildPeekAndDiscoverReadinessRequirements(
  round: Pick<PeekAndDiscoverRound, 'scope' | 'locale' | 'localeLock' | 'content' | 'exactWord'>,
): CommunicationContentRequirements {
  return {
    contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
    scope: round.scope,
    locale: round.locale,
    localeLock: round.localeLock,
    recordingKeys: [round.exactWord],
    images: [{ kind: 'url', value: round.content.imageUrl }],
  };
}

export function buildPeekAndDiscoverRound(
  options: PeekAndDiscoverRoundBuilderOptions,
): PeekAndDiscoverRound {
  const content = selectPeekAndDiscoverContent({
    progress: options.progress,
    previousCategory: options.previousCategory,
    selectionIndex: options.roundIndex,
  });
  const locale = resolvePeekAndDiscoverLocale(options.settings, options.roundIndex);
  const localeLock = createCommunicationLocaleLock(options.scope, locale, 'round');
  const exactWord = exactWordForLocale(content.concept, locale);
  const mandatorySegments = buildPeekAndDiscoverMandatorySegment(content, locale);

  const round: PeekAndDiscoverRound = {
    scope: { ...options.scope },
    locale,
    localeLock,
    content,
    roundIndex: normalizeSelectionIndex(options.roundIndex),
    exactWord,
    mandatorySegments,
    readiness: {
      contentVersion: PEEK_AND_DISCOVER_CONTENT_VERSION,
      scope: { ...options.scope },
      locale,
      localeLock,
      recordingKeys: [exactWord],
      images: [{ kind: 'url', value: content.imageUrl }],
    },
  };

  return round;
}
