import { hashSeed } from '../domain/rng';

export const CELEBRATION_VARIANTS = [
  'puppy-confetti',
  'cake-candles',
  'balloons',
  'rainbow-hop',
  'trophy-spark',
] as const;

export type CelebrationVariant = (typeof CELEBRATION_VARIANTS)[number];

export function selectCelebrationVariant(
  seed: string | number,
  previousVariant: CelebrationVariant | null = null,
): CelebrationVariant {
  const pool = previousVariant === null
    ? CELEBRATION_VARIANTS
    : CELEBRATION_VARIANTS.filter((variant) => variant !== previousVariant);

  return pool[hashSeed(seed) % pool.length]!;
}
