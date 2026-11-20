import { GARDEN_BANANA_WORDS, type GardenLine } from './wordGarden';

const line = (he: string, spokenHe: string, en: string): GardenLine => ({ he, spokenHe, en });

const CHILD = GARDEN_BANANA_WORDS[0]!;
const SEAN = line('שון', 'שׁוֹן', 'Sean');
export const GARDEN_PART_QUESTIONS = [
  line('מי בתמונה?', 'מִי בַּתְּמוּנָה?', 'Who is in the picture?'),
  line('מה הוא עושה?', 'מָה הוּא עוֹשֶׂה?', 'What is he doing?'),
  line('מה זה?', 'מָה זֶה?', 'What is it?'),
] as const;
export const GARDEN_SENTENCE_QUESTION = line('אפשר להגיד את כל המשפט?', 'אֶפְשָׁר לְהַגִּיד אֶת כָּל הַמִּשְׁפָּט?', 'Can you say the whole sentence?');
export const GARDEN_NEXT_SENTENCE = line('עוד משפט', 'עוֹד מִשְׁפָּט', 'Another sentence');

type GardenMotion = 'eat' | 'handoff' | 'germinate' | 'bury' | 'water' | 'grow';
interface SentencePictures {
  motion: GardenMotion;
  image: string;
  aftermath?: string;
  setting?: string;
}

function sentence<const Id extends string>(
  id: Id, action: GardenLine, object: GardenLine, graphics: SentencePictures, objectQuestion = GARDEN_PART_QUESTIONS[2],
) {
  const phrase = (subject: GardenLine) => line(
    `${subject.he} ${action.he} ${object.he}`,
    `${subject.spokenHe} ${action.spokenHe} ${object.spokenHe}`,
    `${subject.en} ${action.en} ${object.en}`,
  );
  return { id, action, object, ...graphics, model: phrase(CHILD), seanModel: phrase(SEAN), objectQuestion };
}

const EATS = GARDEN_BANANA_WORDS[1]!;
const EATING_QUESTION = line('מה הוא אוכל?', 'מָה הוּא אוֹכֵל?', 'What is he eating?');
const SEED = line('גרעין', 'גַּרְעִין', 'a seed');
const SOIL = line('את האדמה', 'אֶת הָאֲדָמָה', 'the soil');
const GROWTH = '/assets/garden';

export const GARDEN_SENTENCES = [
  sentence('banana', EATS, GARDEN_BANANA_WORDS[2]!, {
    motion: 'eat',
    image: '/assets/garden/banana.webp',
    aftermath: '/assets/garden/banana-bitten.webp',
  }, EATING_QUESTION),
  sentence('dates', EATS, line('תמרים', 'תְּמָרִים', 'dates'), {
    motion: 'eat',
    image: '/assets/garden/dates.webp',
  }, EATING_QUESTION),
  sentence('germinate', line('מנביט', 'מַנְבִּיט', 'sprouts'), SEED, {
    motion: 'germinate',
    image: `${GROWTH}/date-pit-germinating.webp`,
  }),
  sentence('bury', line('טומן', 'טוֹמֵן', 'plants'), SEED, {
    motion: 'bury',
    image: `${GROWTH}/date-pit-germinating.webp`,
    setting: `${GROWTH}/date-pit-planted.webp`,
  }),
  sentence('water', line('משקה', 'מַשְׁקֶה', 'waters'), SOIL, {
    motion: 'water',
    image: `${GROWTH}/date-pit-planted.webp`,
    setting: `${GROWTH}/watering-can.webp`,
  }),
  sentence('palm', line('רואה', 'רוֹאֶה', 'sees'), line('דקל תמר', 'דֶּקֶל תָּמָר', 'a date palm'), {
    motion: 'grow',
    image: `${GROWTH}/date-palm-tree.webp`,
    setting: `${GROWTH}/date-palm-seedling.webp`,
  }),
  sentence('token', line('נותן', 'נוֹתֵן', 'gives'), line('אסימון', 'אֲסִימוֹן', 'a token'), {
    motion: 'handoff',
    image: '/assets/garden/token.webp',
  }, line('מה הוא נותן?', 'מָה הוּא נוֹתֵן?', 'What is he giving?')),
  sentence('persimmon', EATS, line('אפרסמון', 'אֲפַרְסְמוֹן', 'a persimmon'), {
    motion: 'eat',
    image: '/assets/garden/persimmon.webp',
  }, EATING_QUESTION),
] as const;

export type GardenSentence = (typeof GARDEN_SENTENCES)[number];
export type GardenVoiceLanguage = 'he' | 'en';

export function getGardenVoiceKey(sentence: GardenSentence, language: GardenVoiceLanguage): string {
  return `${sentence.id}:sean:${language}`;
}

export function getGardenSentenceLines(sentence: GardenSentence) {
  return {
    words: [SEAN, sentence.action, sentence.object] as const,
    model: sentence.seanModel,
  };
}

export const GARDEN_SENTENCE_SPEECH_LINES = [
  ...GARDEN_PART_QUESTIONS, GARDEN_SENTENCE_QUESTION, GARDEN_NEXT_SENTENCE, CHILD, SEAN,
  ...GARDEN_SENTENCES.flatMap((item) => [item.action, item.object, item.objectQuestion, item.model, item.seanModel]),
];
