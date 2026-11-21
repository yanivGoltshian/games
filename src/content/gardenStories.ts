import type { GardenLine } from './wordGarden';

// Author the reading and caption together. Some fully pointed words have a
// different conventional unpointed spelling (e.g. דְּלִי / דלי).
const line = (spokenHe: string, en: string, he = spokenHe.replace(/[\u0591-\u05bd\u05bf-\u05c7]/gu, '')): GardenLine =>
  ({ he, spokenHe, en });

const SEAN = line('שׁוֹן', 'Sean');
const WHO = line('מִי בַּתְּמוּנָה?', 'Who is in the picture?');
const WHAT = line('מָה בַּתְּמוּנָה?', 'What is in the picture?');
const DOES = line('מָה הוּא עוֹשֶׂה?', 'What is he doing?');
const EATING = line('מָה הוּא אוֹכֵל?', 'What is he eating?');
const WHERE = line('אֵיפֹה?', 'Where?');
const WHERE_TO = line('לְאָן?', 'Where to?');
const THEN = line('וְאָז', 'Then');
const LATER = line('אַחַר כָּךְ', 'After that');
const OVER_TIME = line('עִם הַזְּמַן', 'Over time');
const EATS = line('אוֹכֵל', 'eats');
const PEEL = line('הַקְּלִיפָּה', 'The peel');
const SPROUT = line('הַנֵּבֶט', 'The sprout');

function beat(id: string, subject: GardenLine, action: GardenLine, object: GardenLine,
  actionQuestion: GardenLine, objectQuestion: GardenLine, connector?: GardenLine) {
  const words = [subject, action, object] as const;
  const parts = connector ? [connector, ...words] : words;
  const model = {
    he: parts.map(p => p.he).join(' '),
    spokenHe: parts.map(p => p.spokenHe).join(' '),
    en: parts.map(p => connector && p === subject && p !== SEAN ? p.en[0]!.toLowerCase() + p.en.slice(1) : p.en).join(' '),
  };
  return { id, isSean: subject === SEAN, words, model, connector,
    questions: [subject === SEAN ? WHO : WHAT, actionQuestion, objectQuestion] as const };
}

export const GARDEN_STORIES = [
  { id: 'banana', beats: [
    beat('banana', SEAN, EATS, line('בָּנָנָה', 'a banana'), DOES, EATING),
    beat('banana-peel', PEEL, line('נִשְׁאֶרֶת', 'stays'), line('בַּיָּד שֶׁל שׁוֹן', 'in Sean’s hand'),
      line('מָה קוֹרֶה לַקְּלִיפָּה?', 'What happens to the peel?'), WHERE),
    beat('banana-bucket', SEAN, line('שָׂם', 'puts'), line('אֶת הַקְּלִיפָּה בַּדְּלִי', 'the peel in the bucket'),
      DOES, line('מָה הוּא שָׂם בַּדְּלִי?', 'What does he put in the bucket?'), THEN),
    beat('banana-compost', PEEL, line('מִתְפָּרֶקֶת', 'breaks down'), line('בַּקּוֹמְפּוֹסְט', 'in the compost'),
      line('מָה קוֹרֶה לַקְּלִיפָּה?', 'What happens to the peel?'), WHERE, OVER_TIME),
  ] },
  { id: 'date', beats: [
    beat('dates', SEAN, EATS, line('תְּמָרִים', 'dates'), DOES, EATING),
    beat('date-plant', SEAN, line('טוֹמֵן', 'plants'), line('גַּרְעִין בָּאֲדָמָה', 'a date seed in the soil'),
      DOES, line('מָה הוּא טוֹמֵן?', 'What does he plant?'), LATER),
    beat('date-sprout', line('נֵבֶט יָרוֹק', 'A green sprout'), line('יוֹצֵא', 'comes up'), line('מֵהָאֲדָמָה', 'from the soil'),
      line('מָה עוֹשֶׂה הַנֵּבֶט?', 'What does the sprout do?'), line('מֵאֵיפֹה יוֹצֵא הַנֵּבֶט?', 'Where does the sprout come from?')),
    beat('date-palm', SPROUT, line('גָּדֵל', 'grows'), line('וְהוֹפֵךְ לְדֶקֶל', 'into a palm tree'),
      line('מָה קוֹרֶה לַנֵּבֶט?', 'What happens to the sprout?'), line('לְמָה הוֹפֵךְ הַנֵּבֶט?', 'What does the sprout grow into?'),
      line('עִם הַשָּׁנִים', 'Over the years')),
  ] },
  { id: 'avocado', beats: [
    beat('avocado-water', SEAN, line('שָׂם', 'puts'), line('גַּרְעִין אָבוֹקָדוֹ בַּמַּיִם', 'an avocado pit in water'),
      DOES, line('מָה הוּא שָׂם בַּמַּיִם?', 'What does he put in the water?')),
    beat('avocado-root', line('שׁוֹרֶשׁ לָבָן', 'A white root'), line('צוֹמֵחַ', 'grows'), line('לְתוֹךְ הַמַּיִם', 'down into the water'),
      line('מָה עוֹשֶׂה הַשּׁוֹרֶשׁ?', 'What does the root do?'), WHERE_TO),
    beat('avocado-shoot', line('נֵבֶט קָטָן', 'A little shoot'), line('מֵצִיץ', 'peeks out'), line('מֵהַגַּרְעִין', 'of the pit'),
      line('מָה עוֹשֶׂה הַנֵּבֶט?', 'What does the sprout do?'), line('מֵאֵיפֹה מֵצִיץ הַנֵּבֶט?', 'Where does the shoot peek out from?'), THEN),
    beat('avocado-soil', SEAN, line('שׁוֹתֵל', 'plants'), line('אֶת הַנֵּבֶט בָּאֲדָמָה', 'the sprout in the soil'),
      DOES, line('מָה הוּא שׁוֹתֵל?', 'What does he plant?'), line('עַכְשָׁו', 'Now', 'עכשיו')),
  ] },
  { id: 'strawberry', beats: [
    beat('berry-water', SEAN, line('מַשְׁקֶה', 'waters'), line('אֶת שְׁתִיל הַתּוּת', 'the strawberry plant'),
      DOES, line('מָה הוּא מַשְׁקֶה?', 'What does he water?')),
    beat('berry-flower', line('פֶּרַח לָבָן', 'A white flower'), line('נִפְתָּח', 'opens'), line('בַּשֶּׁמֶשׁ', 'in the sunshine'),
      line('מָה קוֹרֶה לַפֶּרַח?', 'What happens to the flower?'), WHERE, THEN),
    beat('berry-bee', line('דְּבוֹרָה', 'A bee'), line('נוֹחֶתֶת', 'lands'), line('עַל הַפֶּרַח', 'on the flower'),
      line('מָה עוֹשָׂה הַדְּבוֹרָה?', 'What does the bee do?'), WHERE),
    beat('berry-red', line('תּוּת קָטָן', 'A little strawberry'), line('מַאֲדִים', 'turns red'), line('עַל הַשְּׁתִיל', 'on the plant'),
      line('מָה קוֹרֶה לַתּוּת?', 'What happens to the strawberry?'), WHERE, LATER),
  ] },
  { id: 'carrot', beats: [
    beat('carrot-sow', SEAN, line('זוֹרֵעַ', 'sows'), line('זִרְעֵי גֶּזֶר', 'carrot seeds'),
      DOES, line('מָה הוּא זוֹרֵעַ?', 'What does he sow?')),
    beat('carrot-rain', line('הַגֶּשֶׁם', 'The rain'), line('מַרְטִיב', 'wets'), line('אֶת הָאֲדָמָה', 'the soil'),
      line('מָה עוֹשֶׂה הַגֶּשֶׁם?', 'What does the rain do?'), line('מָה נִרְטָב?', 'What gets wet?')),
    beat('carrot-leaves', line('עָלִים יְרוּקִּים', 'Green leaves', 'עלים ירוקים'), line('מְבַצְבְּצִים', 'peek out'), line('מֵהָאֲדָמָה', 'of the soil'),
      line('מָה עוֹשִׂים הֶעָלִים?', 'What do the leaves do?'), line('מֵאֵיפֹה מְבַצְבְּצִים הֶעָלִים?', 'Where do the leaves peek out from?'), THEN),
    beat('carrot-pull', SEAN, line('מוֹשֵׁךְ', 'pulls'), line('גֶּזֶר מֵהָאֲדָמָה', 'a carrot from the soil'),
      DOES, line('מָה הוּא מוֹשֵׁךְ?', 'What does he pull?'), line('לְבַסּוֹף', 'Finally')),
  ] },
] as const;

export const GARDEN_SENTENCE_QUESTION = line('אֶפְשָׁר לְהַגִּיד אֶת כָּל הַמִּשְׁפָּט?', 'Can you say the whole sentence?');
export const GARDEN_NEXT_SENTENCE = line('עוֹד מִשְׁפָּט', 'Another sentence');
export const GARDEN_SENTENCE_SPEECH_LINES = [
  GARDEN_SENTENCE_QUESTION, GARDEN_NEXT_SENTENCE,
  ...GARDEN_STORIES.flatMap(({ beats }) => beats.flatMap(b => [...b.questions, ...b.words, b.model])),
];
