import {
  getLearningConcept,
  learningConcepts,
  type LearningConceptId,
} from '../content/concepts';

export type RealisticConceptId = LearningConceptId;

export const REALISTIC_CONCEPT_IDS: readonly RealisticConceptId[] = learningConcepts.map(
  (concept) => concept.id,
);

export function hasRealisticConceptAsset(conceptId: string): conceptId is RealisticConceptId {
  return getLearningConcept(conceptId) !== undefined;
}

export function conceptAssetHref(conceptId: string): string {
  const concept = getLearningConcept(conceptId);
  if (!concept) {
    throw new Error(`Missing realistic asset for concept: ${conceptId}`);
  }
  return concept.image;
}
