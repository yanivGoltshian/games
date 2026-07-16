import type { ArtProps } from './a11y';
import { REALISTIC_CONCEPT_ASSETS, hasRealisticConceptAsset } from './conceptAssets';

export interface ConceptArtProps extends ArtProps {
  conceptId: string;
}

/** Renders a locally bundled, generated studio image for a stable content id. */
export function ConceptArt({ conceptId, label, className }: ConceptArtProps) {
  if (!hasRealisticConceptAsset(conceptId)) {
    throw new Error(`Missing realistic asset for concept: ${conceptId}`);
  }

  return (
    <img
      src={REALISTIC_CONCEPT_ASSETS[conceptId]}
      alt={label ?? ''}
      aria-hidden={label ? undefined : 'true'}
      className={`concept-photo ${className ?? ''}`.trim()}
      data-art-id={`photo-${conceptId}`}
      data-content-id={conceptId}
      draggable={false}
      decoding="async"
      width="900"
      height="900"
    />
  );
}
