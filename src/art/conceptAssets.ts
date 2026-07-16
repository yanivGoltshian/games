export const REALISTIC_CONCEPT_ASSETS = {
  apple: '/assets/vocabulary/apple.webp',
  ball: '/assets/vocabulary/ball.webp',
  banana: '/assets/vocabulary/banana.webp',
  car: '/assets/vocabulary/car.webp',
  cat: '/assets/vocabulary/cat.webp',
  dog: '/assets/vocabulary/dog.webp',
  shoe: '/assets/vocabulary/shoe.webp',
} as const;

export type RealisticConceptId = keyof typeof REALISTIC_CONCEPT_ASSETS;

export const REALISTIC_CONCEPT_IDS = Object.keys(REALISTIC_CONCEPT_ASSETS) as RealisticConceptId[];

export function hasRealisticConceptAsset(conceptId: string): conceptId is RealisticConceptId {
  return Object.hasOwn(REALISTIC_CONCEPT_ASSETS, conceptId);
}
