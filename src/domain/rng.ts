export interface SeededRandom {
  next: () => number;
  int: (minInclusive: number, maxInclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
  shuffle: <T>(items: readonly T[]) => T[];
}

function xmur3(input: string): number {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return (hash ^= hash >>> 16) >>> 0;
}

export function hashSeed(seed: string | number): number {
  return typeof seed === 'number' ? seed >>> 0 : xmur3(seed);
}

export function createSeededRandom(seed: string | number): SeededRandom {
  let state = hashSeed(seed) || 0x6d2b79f5;

  const next = (): number => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (minInclusive: number, maxInclusive: number): number => {
    const min = Math.ceil(minInclusive);
    const max = Math.floor(maxInclusive);
    return Math.floor(next() * (max - min + 1)) + min;
  };

  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array.');
    }
    return items[int(0, items.length - 1)]!;
  };

  const shuffle = <T,>(items: readonly T[]): T[] => {
    const clone = [...items];
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const swapIndex = int(0, index);
      [clone[index], clone[swapIndex]] = [clone[swapIndex]!, clone[index]!];
    }
    return clone;
  };

  return { next, int, pick, shuffle };
}

export function pickWeightedUnique<T extends string>(
  ids: readonly T[],
  weights: Record<string, number>,
  count: number,
  random: SeededRandom,
): T[] {
  const pool = [...ids];
  const picked: T[] = [];

  while (pool.length > 0 && picked.length < count) {
    const totalWeight = pool.reduce((sum, id) => sum + Math.max(0.01, weights[id] ?? 1), 0);
    let cursor = random.next() * totalWeight;
    let chosenIndex = 0;

    for (let index = 0; index < pool.length; index += 1) {
      cursor -= Math.max(0.01, weights[pool[index]!] ?? 1);
      if (cursor <= 0) {
        chosenIndex = index;
        break;
      }
    }

    picked.push(pool.splice(chosenIndex, 1)[0]!);
  }

  return picked;
}
