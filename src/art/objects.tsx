import type { ArtProps } from './a11y';
import { conceptAssetHref } from './conceptAssets';

export interface ConceptArtProps extends ArtProps {
  conceptId: string;
}

/** Renders a locally bundled, generated studio image for a stable content id. */
export function ConceptArt({ conceptId, label, className }: ConceptArtProps) {
  return (
    <img
      src={conceptAssetHref(conceptId)}
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
