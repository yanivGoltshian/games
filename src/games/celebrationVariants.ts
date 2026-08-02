import { hashSeed } from '../domain/rng';

export const CELEBRATION_VARIANTS = [
  'puppy-confetti',
  'cake-candles',
  'balloons',
  'rainbow-hop',
  'trophy-spark',
] as const;

export type CelebrationVariant =
  | (typeof CELEBRATION_VARIANTS)[number]
  | 'memory-fireworks';

export function selectCelebrationVariant(
  seed: string | number,
  previousVariant: CelebrationVariant | null = null,
): (typeof CELEBRATION_VARIANTS)[number] {
  const pool = previousVariant === null
    ? CELEBRATION_VARIANTS
    : CELEBRATION_VARIANTS.filter((variant) => variant !== previousVariant);

  return pool[hashSeed(seed) % pool.length]!;
}
