import { learningConcepts, sortingItems } from './concepts';

export const MEMORY_GARDEN_CONCEPTS = [
  { id: 'persimmon', he: 'אפרסמון', spokenHe: 'אֲפַרְסְמוֹן', en: 'persimmon', image: '/assets/garden/persimmon.webp', introducedAtLevel: 1, category: 'fruit' },
  { id: 'dates', he: 'תמרים', spokenHe: 'תְּמָרִים', en: 'dates', image: '/assets/garden/dates.webp', introducedAtLevel: 2, category: 'fruit' },
  { id: 'garden-token', he: 'אסימון', spokenHe: 'אֲסִימוֹן', en: 'token', image: '/assets/garden/token.webp', introducedAtLevel: 2, category: 'object' },
  { id: 'watering-can', he: 'משפך', spokenHe: 'מַשְׁפֵּךְ', en: 'watering can', image: '/assets/garden/watering-can.webp', introducedAtLevel: 2, category: 'object' },
] as const;

export const MEMORY_GARDEN_ART: Readonly<Record<string, string>> = {
  banana: '/assets/garden/banana.webp',
  ...Object.fromEntries(MEMORY_GARDEN_CONCEPTS.map((concept) => [concept.id, concept.image])),
};

const memoryConcepts = [
  ...learningConcepts,
  ...MEMORY_GARDEN_CONCEPTS,
  ...sortingItems.map((item) => ({ ...item, category: 'shape' as const, introducedAtLevel: 3 })),
];

const gardenIds = new Set(['watering-can', 'tree', 'flower', 'carrot', 'strawberry', 'apple', 'orange', 'persimmon', 'dates']);
type MemoryTopic = 'emotion' | 'fruit' | 'transport' | 'animal' | 'garden' | 'shape';

// First topic on reaching each size; the second gives restarts and capped wins a different board.
const topicsByPairCount: Readonly<Record<number, readonly [MemoryTopic, MemoryTopic]>> = {
  2: ['emotion', 'fruit'],
  3: ['fruit', 'animal'],
  4: ['transport', 'emotion'],
  5: ['animal', 'fruit'],
  6: ['emotion', 'fruit'],
  7: ['garden', 'shape'],
  8: ['shape', 'garden'],
};

export function memoryTopicPool(pairCount: number, level: number, previousIds: readonly string[]): string[] {
  const topics = topicsByPairCount[pairCount];
  if (!topics) throw new Error(`No Memory topics for ${pairCount} pairs`);
  const poolFor = (topic: MemoryTopic) => memoryConcepts.filter((concept) =>
    concept.introducedAtLevel <= level && (topic === 'garden' ? gardenIds.has(concept.id) : concept.category === topic),
  ).map((concept) => concept.id);
  const first = poolFor(topics[0]);
  const pool = previousIds.length === pairCount && previousIds.every((id) => first.includes(id))
    ? poolFor(topics[1]) : first;
  if (pool.length < pairCount) throw new Error(`Not enough distinct Memory concepts for ${pairCount} pairs`);
  return pool;
}

export function getMemoryConcept(id: string) {
  return memoryConcepts.find((concept) => concept.id === id);
}
