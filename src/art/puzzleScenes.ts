import type { PuzzleScene } from '../domain/types';
import { REALISTIC_CONCEPT_ASSETS, hasRealisticConceptAsset } from './conceptAssets';

/** Puzzle pieces slice the same generated local image into a coherent scene. */
export function sceneBackgroundImage(scene: PuzzleScene): string {
  if (!hasRealisticConceptAsset(scene.id)) {
    throw new Error(`Missing realistic puzzle scene asset: ${scene.id}`);
  }

  return `url("${REALISTIC_CONCEPT_ASSETS[scene.id]}")`;
}
