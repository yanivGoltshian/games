import { learningConcepts } from './concepts';

export const MEMORY_GARDEN_CONCEPTS = [
  { id: 'persimmon', he: 'אפרסמון', spokenHe: 'אֲפַרְסְמוֹן', en: 'persimmon', image: '/assets/garden/persimmon.webp', introducedAtLevel: 1, category: 'fruit' },
  { id: 'dates', he: 'תמרים', spokenHe: 'תְּמָרִים', en: 'dates', image: '/assets/garden/dates.webp', introducedAtLevel: 2, category: 'fruit' },
  { id: 'garden-token', he: 'אסימון', spokenHe: 'אֲסִימוֹן', en: 'token', image: '/assets/garden/token.webp', introducedAtLevel: 2, category: 'object' },
  { id: 'watering-can', he: 'משפך', spokenHe: 'מַשְׁפֵּךְ', en: 'watering can', image: '/assets/garden/watering-can.webp', introducedAtLevel: 2, category: 'object' },
] as const;

export const EARLY_MEMORY_GARDEN_WORDS = ['persimmon', 'dates', 'watering-can'] as const;

export const MEMORY_GARDEN_ART: Readonly<Record<string, string>> = {
  banana: '/assets/garden/banana.webp',
  ...Object.fromEntries(MEMORY_GARDEN_CONCEPTS.map((concept) => [concept.id, concept.image])),
};

export const memoryConcepts = [...learningConcepts, ...MEMORY_GARDEN_CONCEPTS];

export function getMemoryConcept(id: string) {
  return memoryConcepts.find((concept) => concept.id === id);
}
