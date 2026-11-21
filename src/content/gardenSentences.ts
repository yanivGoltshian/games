import { createSeededRandom } from '../domain/rng';
import { GARDEN_STORIES } from './gardenStories';
export { GARDEN_NEXT_SENTENCE, GARDEN_SENTENCE_QUESTION, GARDEN_SENTENCE_SPEECH_LINES } from './gardenStories';

export const GARDEN_DEFAULT_AVATAR = '/assets/garden/sean-avatar.webp';
export const GARDEN_DRAWINGS = '/assets/garden/story-art.svg';
const garden = (name: string) => `/assets/garden/${name}.webp`;
const fruit = (name: string) => `/assets/vocabulary/${name}.webp`;
type Beat = (typeof GARDEN_STORIES)[number]['beats'][number];
interface Pictures {
  subject?: string;
  object: string;
  image?: string;
  aftermath?: string;
  setting?: string;
  motion?: 'eat' | 'bury' | 'water' | 'grow';
}
const pictures: Record<Beat['id'], Pictures> = {
  banana: { object: garden('banana'), image: garden('banana'), aftermath: garden('banana-bitten'), motion: 'eat' },
  'banana-peel': { subject: '#peel', object: '#hand' },
  'banana-bucket': { object: '#bucket-peel' },
  'banana-compost': { subject: '#peel', object: '#compost' },
  dates: { object: garden('dates'), image: garden('dates'), motion: 'eat' },
  'date-plant': { object: garden('date-pit-planted'), motion: 'bury' },
  'date-sprout': { subject: garden('date-palm-seedling'), object: '#soil' },
  'date-palm': { subject: garden('date-palm-seedling'), object: garden('date-palm-tree'), image: garden('date-palm-tree'), setting: garden('date-palm-seedling'), motion: 'grow' },
  'avocado-water': { object: '#pit-water' },
  'avocado-root': { subject: '#rooted-pit', object: '#water' },
  'avocado-shoot': { subject: '#shoot', object: '#pit' },
  'avocado-soil': { object: '#potted-shoot' },
  'berry-water': { object: '#berry-plant', setting: garden('watering-can'), motion: 'water' },
  'berry-flower': { subject: '#flower', object: '#sun' },
  'berry-bee': { subject: '#bee', object: '#flower' },
  'berry-red': { subject: fruit('strawberry'), object: '#berry-plant' },
  'carrot-sow': { object: '#seeds' },
  'carrot-rain': { subject: '#rain', object: '#soil' },
  'carrot-leaves': { subject: '#tops', object: '#soil' },
  'carrot-pull': { object: fruit('carrot') },
  'apple-pick': { object: fruit('apple') },
  'apple-wash': { object: fruit('apple') },
  'apple-drops': { subject: '#drops', object: fruit('apple') },
  'apple-bite': { object: fruit('apple'), image: fruit('apple'), motion: 'eat' },
};
export type GardenSentence = Beat & { story: string; art: Pictures } & Pick<Pictures, 'motion' | 'image' | 'setting' | 'aftermath'>;
const stories = GARDEN_STORIES.map(({ id, beats }) => ({
  id, sentences: beats.map((b): GardenSentence => ({ ...b, story: id, art: pictures[b.id], ...pictures[b.id] })),
}));
export const GARDEN_SENTENCES = stories.flatMap(s => s.sentences);

export function makeGardenVisit(previousFirst?: string, seed = Math.floor(Math.random() * 0x100000000)) {
  const rng = createSeededRandom(seed);
  const order = rng.shuffle(stories);
  if (order[0]?.id === previousFirst && order.length > 1) {
    const other = rng.int(1, order.length - 1);
    [order[0], order[other]] = [order[other]!, order[0]!];
  }
  return order.flatMap(s => s.sentences);
}

export type GardenVoiceLanguage = 'he' | 'en';
const originalModels: Record<string, Record<GardenVoiceLanguage, string>> = {
  banana: { he: 'שון אוכל בננה', en: 'Sean eats a banana' },
  dates: { he: 'שון אוכל תמרים', en: 'Sean eats dates' },
};
export function getGardenVoiceKey(sentence: GardenSentence, language: GardenVoiceLanguage) {
  const text = sentence.model[language];
  return originalModels[sentence.id]?.[language] === text ? `${sentence.id}:sean:${language}`
    : `story:${sentence.id}:${language}:${text}`;
}
