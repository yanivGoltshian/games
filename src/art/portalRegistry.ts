import type { DomainKey } from '../domain/types';
import type { ArtProps } from './a11y';
import {
  CountingPortalArt,
  ListeningPortalArt,
  MemoryPortalArt,
  PuzzlePortalArt,
  SortingPortalArt,
} from './portals';

export const PORTAL_ART: Record<DomainKey, (props: ArtProps) => React.JSX.Element> = {
  listening: ListeningPortalArt,
  counting: CountingPortalArt,
  sorting: SortingPortalArt,
  puzzle: PuzzlePortalArt,
  memory: MemoryPortalArt,
};
