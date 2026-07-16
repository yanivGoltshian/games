import type {
  HebrewGrammaticalGender,
  LearningConcept,
  PuzzleScene,
  SortingItemDefinition,
} from '../domain/types';

interface QuantityInput {
  order: number;
  gender: HebrewGrammaticalGender;
  singular: string;
  singularSpoken: string;
  plural: string;
  pluralSpoken: string;
  singularEn: string;
  pluralEn: string;
  countedPlural?: string;
  countedPluralSpoken?: string;
}

function quantity(input: QuantityInput): NonNullable<LearningConcept['quantity']> {
  return {
    order: input.order,
    he: {
      singular: input.singular,
      singularSpoken: input.singularSpoken,
      plural: input.plural,
      pluralSpoken: input.pluralSpoken,
      countedPlural: input.countedPlural ?? input.plural,
      countedPluralSpoken: input.countedPluralSpoken ?? input.pluralSpoken,
      gender: input.gender,
    },
    en: {
      singular: input.singularEn,
      plural: input.pluralEn,
    },
  };
}

/**
 * Stable concept ids double as photo-library lookup keys (see src/art/objects.tsx)
 * so content, speech, progression, and imagery all reference the same
 * identity. Do not rename an id without checking domain/rounds.ts, progression
 * history shape, and the art registry.
 */
export const learningConcepts = [
  {
    id: 'ball',
    category: 'toy',
    he: 'כדור',
    spokenHe: 'כַּדּוּר',
    en: 'ball',
    image: '/assets/vocabulary/ball.webp',
    introducedAtLevel: 1,
    puzzle: false,
    quantity: quantity({
      order: 1,
      gender: 'masculine',
      singular: 'כדור',
      singularSpoken: 'כַּדּוּר',
      plural: 'כדורים',
      pluralSpoken: 'כַּדּוּרִים',
      singularEn: 'ball',
      pluralEn: 'balls',
    }),
    audio: {},
  },
  {
    id: 'car',
    category: 'transport',
    he: 'אוטו',
    spokenHe: 'אוֹטוֹ',
    en: 'car',
    image: '/assets/vocabulary/car.webp',
    introducedAtLevel: 1,
    puzzle: false,
    quantity: null,
    audio: {},
  },
  {
    id: 'banana',
    category: 'fruit',
    he: 'בננה',
    spokenHe: 'בָּנָנָה',
    en: 'banana',
    image: '/assets/vocabulary/banana.webp',
    introducedAtLevel: 1,
    puzzle: false,
    quantity: quantity({
      order: 2,
      gender: 'feminine',
      singular: 'בננה',
      singularSpoken: 'בָּנָנָה',
      plural: 'בננות',
      pluralSpoken: 'בָּנָנוֹת',
      singularEn: 'banana',
      pluralEn: 'bananas',
    }),
    audio: {},
  },
  {
    id: 'apple',
    category: 'fruit',
    he: 'תפוח',
    spokenHe: 'תַּפּוּחַ',
    en: 'apple',
    image: '/assets/vocabulary/apple.webp',
    introducedAtLevel: 1,
    puzzle: false,
    quantity: quantity({
      order: 0,
      gender: 'masculine',
      singular: 'תפוח',
      singularSpoken: 'תַּפּוּחַ',
      plural: 'תפוחים',
      pluralSpoken: 'תַּפּוּחִים',
      singularEn: 'apple',
      pluralEn: 'apples',
    }),
    audio: {},
  },
  {
    id: 'shoe',
    category: 'clothing',
    he: 'נעל',
    spokenHe: 'נַעַל',
    en: 'shoe',
    image: '/assets/vocabulary/shoe.webp',
    introducedAtLevel: 2,
    puzzle: false,
    quantity: null,
    audio: {},
  },
  {
    id: 'dog',
    category: 'animal',
    he: 'כלב',
    spokenHe: 'כֶּלֶב',
    en: 'dog',
    image: '/assets/vocabulary/dog.webp',
    introducedAtLevel: 1,
    puzzle: false,
    quantity: null,
    audio: {},
  },
  {
    id: 'cat',
    category: 'animal',
    he: 'חתול',
    spokenHe: 'חָתוּל',
    en: 'cat',
    image: '/assets/vocabulary/cat.webp',
    introducedAtLevel: 1,
    puzzle: false,
    quantity: null,
    audio: {},
  },
  {
    id: 'duck',
    category: 'animal',
    he: 'ברווז',
    spokenHe: 'בַּרְוָז',
    en: 'duck',
    image: '/assets/vocabulary/duck.webp',
    introducedAtLevel: 2,
    puzzle: true,
    quantity: quantity({
      order: 3,
      gender: 'masculine',
      singular: 'ברווז',
      singularSpoken: 'בַּרְוָז',
      plural: 'ברווזים',
      pluralSpoken: 'בַּרְוָזִים',
      singularEn: 'duck',
      pluralEn: 'ducks',
    }),
    audio: {},
  },
  {
    id: 'rabbit',
    category: 'animal',
    he: 'ארנב',
    spokenHe: 'אַרְנָב',
    en: 'rabbit',
    image: '/assets/vocabulary/rabbit.webp',
    introducedAtLevel: 2,
    puzzle: true,
    quantity: quantity({
      order: 4,
      gender: 'masculine',
      singular: 'ארנב',
      singularSpoken: 'אַרְנָב',
      plural: 'ארנבים',
      pluralSpoken: 'אַרְנָבִים',
      singularEn: 'rabbit',
      pluralEn: 'rabbits',
    }),
    audio: {},
  },
  {
    id: 'elephant',
    category: 'animal',
    he: 'פיל',
    spokenHe: 'פִּיל',
    en: 'elephant',
    image: '/assets/vocabulary/elephant.webp',
    introducedAtLevel: 3,
    puzzle: true,
    quantity: quantity({
      order: 5,
      gender: 'masculine',
      singular: 'פיל',
      singularSpoken: 'פִּיל',
      plural: 'פילים',
      pluralSpoken: 'פִּילִים',
      singularEn: 'elephant',
      pluralEn: 'elephants',
    }),
    audio: {},
  },
  {
    id: 'strawberry',
    category: 'fruit',
    he: 'תות',
    spokenHe: 'תּוּת',
    en: 'strawberry',
    image: '/assets/vocabulary/strawberry.webp',
    introducedAtLevel: 2,
    puzzle: true,
    quantity: quantity({
      order: 6,
      gender: 'masculine',
      singular: 'תות',
      singularSpoken: 'תּוּת',
      plural: 'תותים',
      pluralSpoken: 'תּוּתִים',
      singularEn: 'strawberry',
      pluralEn: 'strawberries',
    }),
    audio: {},
  },
  {
    id: 'orange',
    category: 'fruit',
    he: 'תפוז',
    spokenHe: 'תַּפּוּז',
    en: 'orange',
    image: '/assets/vocabulary/orange.webp',
    introducedAtLevel: 2,
    puzzle: true,
    quantity: quantity({
      order: 7,
      gender: 'masculine',
      singular: 'תפוז',
      singularSpoken: 'תַּפּוּז',
      plural: 'תפוזים',
      pluralSpoken: 'תַּפּוּזִים',
      singularEn: 'orange',
      pluralEn: 'oranges',
    }),
    audio: {},
  },
  {
    id: 'carrot',
    category: 'vegetable',
    he: 'גזר',
    spokenHe: 'גֶּזֶר',
    en: 'carrot',
    image: '/assets/vocabulary/carrot.webp',
    introducedAtLevel: 2,
    puzzle: true,
    quantity: quantity({
      order: 8,
      gender: 'masculine',
      singular: 'גזר',
      singularSpoken: 'גֶּזֶר',
      plural: 'גזרים',
      pluralSpoken: 'גְּזָרִים',
      singularEn: 'carrot',
      pluralEn: 'carrots',
    }),
    audio: {},
  },
  {
    id: 'cup',
    category: 'tableware',
    he: 'כוס',
    spokenHe: 'כּוֹס',
    en: 'cup',
    image: '/assets/vocabulary/cup.webp',
    introducedAtLevel: 2,
    puzzle: true,
    quantity: quantity({
      order: 9,
      gender: 'feminine',
      singular: 'כוס',
      singularSpoken: 'כּוֹס',
      plural: 'כוסות',
      pluralSpoken: 'כּוֹסוֹת',
      singularEn: 'cup',
      pluralEn: 'cups',
    }),
    audio: {},
  },
  {
    id: 'spoon',
    category: 'tableware',
    he: 'כפית',
    spokenHe: 'כַּפִּית',
    en: 'spoon',
    image: '/assets/vocabulary/spoon.webp',
    introducedAtLevel: 3,
    puzzle: true,
    quantity: quantity({
      order: 10,
      gender: 'feminine',
      singular: 'כפית',
      singularSpoken: 'כַּפִּית',
      plural: 'כפיות',
      pluralSpoken: 'כַּפִּיּוֹת',
      singularEn: 'spoon',
      pluralEn: 'spoons',
    }),
    audio: {},
  },
  {
    id: 'chair',
    category: 'furniture',
    he: 'כיסא',
    spokenHe: 'כִּיסֵּא',
    en: 'chair',
    image: '/assets/vocabulary/chair.webp',
    introducedAtLevel: 2,
    puzzle: true,
    quantity: quantity({
      order: 11,
      gender: 'masculine',
      singular: 'כיסא',
      singularSpoken: 'כִּיסֵּא',
      plural: 'כיסאות',
      pluralSpoken: 'כִּיסְאוֹת',
      singularEn: 'chair',
      pluralEn: 'chairs',
    }),
    audio: {},
  },
  {
    id: 'bus',
    category: 'transport',
    he: 'אוטובוס',
    spokenHe: 'אוֹטוֹבּוּס',
    en: 'bus',
    image: '/assets/vocabulary/bus.webp',
    introducedAtLevel: 3,
    puzzle: true,
    quantity: quantity({
      order: 12,
      gender: 'masculine',
      singular: 'אוטובוס',
      singularSpoken: 'אוֹטוֹבּוּס',
      plural: 'אוטובוסים',
      pluralSpoken: 'אוֹטוֹבּוּסִים',
      singularEn: 'bus',
      pluralEn: 'buses',
    }),
    audio: {},
  },
  {
    id: 'train',
    category: 'transport',
    he: 'רכבת',
    spokenHe: 'רַכֶּבֶת',
    en: 'train',
    image: '/assets/vocabulary/train.webp',
    introducedAtLevel: 3,
    puzzle: true,
    quantity: quantity({
      order: 13,
      gender: 'feminine',
      singular: 'רכבת',
      singularSpoken: 'רַכֶּבֶת',
      plural: 'רכבות',
      pluralSpoken: 'רַכָּבוֹת',
      singularEn: 'train',
      pluralEn: 'trains',
    }),
    audio: {},
  },
  {
    id: 'airplane',
    category: 'transport',
    he: 'מטוס',
    spokenHe: 'מָטוֹס',
    en: 'airplane',
    image: '/assets/vocabulary/airplane.webp',
    introducedAtLevel: 3,
    puzzle: true,
    quantity: quantity({
      order: 14,
      gender: 'masculine',
      singular: 'מטוס',
      singularSpoken: 'מָטוֹס',
      plural: 'מטוסים',
      pluralSpoken: 'מְטוֹסִים',
      singularEn: 'airplane',
      pluralEn: 'airplanes',
    }),
    audio: {},
  },
  {
    id: 'flower',
    category: 'nature',
    he: 'פרח',
    spokenHe: 'פֶּרַח',
    en: 'flower',
    image: '/assets/vocabulary/flower.webp',
    introducedAtLevel: 3,
    puzzle: true,
    quantity: quantity({
      order: 15,
      gender: 'masculine',
      singular: 'פרח',
      singularSpoken: 'פֶּרַח',
      plural: 'פרחים',
      pluralSpoken: 'פְּרָחִים',
      singularEn: 'flower',
      pluralEn: 'flowers',
    }),
    audio: {},
  },
  {
    id: 'tree',
    category: 'nature',
    he: 'עץ',
    spokenHe: 'עֵץ',
    en: 'tree',
    image: '/assets/vocabulary/tree.webp',
    introducedAtLevel: 3,
    puzzle: true,
    quantity: quantity({
      order: 16,
      gender: 'masculine',
      singular: 'עץ',
      singularSpoken: 'עֵץ',
      plural: 'עצים',
      pluralSpoken: 'עֵצִים',
      singularEn: 'tree',
      pluralEn: 'trees',
    }),
    audio: {},
  },
] as const satisfies readonly LearningConcept[];

export type LearningConceptDefinition = (typeof learningConcepts)[number];
export type LearningConceptId = LearningConceptDefinition['id'];
export type CountingConceptDefinition = Extract<LearningConceptDefinition, { quantity: object }>;
export type CountingConceptId = CountingConceptDefinition['id'];

export const countingConcepts = learningConcepts.filter(
  (concept): concept is CountingConceptDefinition => concept.quantity !== null,
).toSorted((left, right) => left.quantity.order - right.quantity.order);
export const countingConceptIds: readonly CountingConceptId[] = countingConcepts.map(
  (concept) => concept.id,
);

export function getLearningConcept(id: string): LearningConceptDefinition | undefined {
  return learningConcepts.find((concept) => concept.id === id);
}

export function requireLearningConcept(id: string): LearningConceptDefinition {
  const concept = getLearningConcept(id);
  if (!concept) {
    throw new Error(`Unknown concept: ${id}`);
  }
  return concept;
}

export const sortingItems: SortingItemDefinition[] = [
  { id: 'red-circle', colorId: 'red', shapeId: 'circle', he: 'עיגול אדום', en: 'red circle' },
  { id: 'red-square', colorId: 'red', shapeId: 'square', he: 'ריבוע אדום', en: 'red square' },
  { id: 'red-triangle', colorId: 'red', shapeId: 'triangle', he: 'משולש אדום', en: 'red triangle' },
  { id: 'blue-circle', colorId: 'blue', shapeId: 'circle', he: 'עיגול כחול', en: 'blue circle' },
  { id: 'blue-square', colorId: 'blue', shapeId: 'square', he: 'ריבוע כחול', en: 'blue square' },
  { id: 'blue-star', colorId: 'blue', shapeId: 'star', he: 'כוכב כחול', en: 'blue star' },
  { id: 'green-circle', colorId: 'green', shapeId: 'circle', he: 'עיגול ירוק', en: 'green circle' },
  { id: 'green-triangle', colorId: 'green', shapeId: 'triangle', he: 'משולש ירוק', en: 'green triangle' },
  { id: 'green-star', colorId: 'green', shapeId: 'star', he: 'כוכב ירוק', en: 'green star' },
  { id: 'yellow-square', colorId: 'yellow', shapeId: 'square', he: 'ריבוע צהוב', en: 'yellow square' },
  { id: 'yellow-triangle', colorId: 'yellow', shapeId: 'triangle', he: 'משולש צהוב', en: 'yellow triangle' },
  { id: 'yellow-star', colorId: 'yellow', shapeId: 'star', he: 'כוכב צהוב', en: 'yellow star' },
];

const originalPuzzleScenes: readonly PuzzleScene[] = [
  {
    id: 'blue-forest-party',
    titleHe: 'מסיבת היער הכחולה',
    titleHeSpoken: 'מְסִיבַּת הַיַּעַר הַכְּחוּלָּה',
    titleEn: 'blue forest party',
    promptHe: 'נחבר את מסיבת היער הכחולה',
    promptHeSpoken: 'נְחַבֵּר אֶת מְסִיבַּת הַיַּעַר הַכְּחוּלָּה',
    promptEn: 'Let’s rebuild the blue forest party',
    image: { kind: 'original' },
  },
  {
    id: 'rescue-planes',
    titleHe: 'הרפתקת מטוסי ההצלה',
    titleHeSpoken: 'הַרְפַּתְקַת מְטוֹסֵי הַהַצָּלָה',
    titleEn: 'rescue planes adventure',
    promptHe: 'נחבר את הרפתקת מטוסי ההצלה',
    promptHeSpoken: 'נְחַבֵּר אֶת הַרְפַּתְקַת מְטוֹסֵי הַהַצָּלָה',
    promptEn: 'Let’s rebuild the rescue planes adventure',
    image: { kind: 'original' },
  },
  {
    id: 'giant-carrot-garden',
    titleHe: 'גינת הגזר הענק',
    titleHeSpoken: 'גִּינַּת הַגֶּזֶר הָעֲנָק',
    titleEn: 'giant carrot garden',
    promptHe: 'נחבר את גינת הגזר הענק',
    promptHeSpoken: 'נְחַבֵּר אֶת גִּינַּת הַגֶּזֶר הָעֲנָק',
    promptEn: 'Let’s rebuild the giant carrot garden',
    image: { kind: 'original' },
  },
];

export const conceptPuzzleScenes: readonly PuzzleScene[] = learningConcepts
  .filter((concept) => concept.puzzle)
  .map((concept) => ({
    id: `concept-${concept.id}`,
    titleHe: concept.he,
    titleHeSpoken: concept.spokenHe,
    titleEn: concept.en,
    promptHe: `בוא נחבר ${concept.he}`,
    promptHeSpoken: `בּוֹא נְחַבֵּר ${concept.spokenHe}`,
    promptEn: `Let’s put together the ${concept.en}`,
    image: { kind: 'concept', conceptId: concept.id },
  }));

export const puzzleScenes: readonly PuzzleScene[] = [
  ...originalPuzzleScenes,
  ...conceptPuzzleScenes,
];
