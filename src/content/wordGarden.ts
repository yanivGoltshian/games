import type { DomainProgress, EnglishVoiceLocale, LanguageMode } from '../domain/types';
import type { SpeechSegment } from '../services/speech';

export const GARDEN_FRUITS = [
  {
    id: 'cherries',
    he: 'דובדבנים',
    spokenHe: 'דּוּבְדְּבָנִים',
    withHe: 'ודובדבנים',
    withSpokenHe: 'וְדּוּבְדְּבָנִים',
    en: 'cherries',
    image: '/assets/vocabulary/cherries.webp',
  },
  {
    id: 'dates',
    he: 'תמרים',
    spokenHe: 'תְּמָרִים',
    withHe: 'ותמרים',
    withSpokenHe: 'וּתְמָרִים',
    en: 'dates',
    image: '/assets/vocabulary/dates.webp',
  },
  {
    id: 'strawberries',
    he: 'תותים',
    spokenHe: 'תּוּתִים',
    withHe: 'ותותים',
    withSpokenHe: 'וְתּוּתִים',
    en: 'strawberries',
    image: '/assets/vocabulary/strawberry.webp',
  },
] as const;

export type GardenFruit = (typeof GARDEN_FRUITS)[number];
export const GARDEN_CHILDREN = [
  { id: 'sean', he: 'שון', spokenHe: 'שׁוֹן', en: 'Sean', verbHe: 'בוחר', spokenVerbHe: 'בּוֹחֵר' },
  { id: 'hadar', he: 'הדר', spokenHe: 'הָדָר', en: 'Hadar', verbHe: 'בוחר', spokenVerbHe: 'בּוֹחֵר' },
  { id: 'noa', he: 'נועה', spokenHe: 'נוֹעָה', en: 'Noa', verbHe: 'בוחרת', spokenVerbHe: 'בּוֹחֶרֶת' },
] as const;
export type GardenChild = (typeof GARDEN_CHILDREN)[number];
export type GardenConnector = 'and' | 'also' | 'with';
export const GARDEN_CONNECTORS: readonly GardenConnector[] = ['and', 'also', 'with'];

export interface GardenLine {
  he: string;
  spokenHe: string;
  en: string;
}

export const GARDEN_INVITATION: GardenLine = {
  he: 'בואו נקטוף יחד',
  spokenHe: 'בּוֹאוּ נִקְטוֹף יַחַד',
  en: 'Let’s pick together',
};

export const GARDEN_ASK: GardenLine = {
  he: 'מה שון מבקש?',
  spokenHe: 'מָה שׁוֹן מְבַקֵּשׁ?',
  en: 'What does Sean want?',
};

export const GARDEN_PERSIMMON_WORD: GardenLine = {
  he: 'אפרסמון',
  spokenHe: 'אֲפַרְסְמוֹן',
  en: 'persimmon',
};

export const GARDEN_PERSIMMON_IMAGE = '/assets/vocabulary/persimmons.webp';

export const GARDEN_BANANA_WORDS: readonly GardenLine[] = [
  { he: 'הילד', spokenHe: 'הַיֶּלֶד', en: 'The child' },
  { he: 'אוכל', spokenHe: 'אוֹכֵל', en: 'eats' },
  { he: 'בננה', spokenHe: 'בָּנָנָה', en: 'a banana' },
];

export const GARDEN_BANANA_SENTENCE: GardenLine = {
  he: 'הילד אוכל בננה',
  spokenHe: 'הַיֶּלֶד אוֹכֵל בָּנָנָה',
  en: 'The child eats a banana',
};

export const GARDEN_EFFORT: GardenLine = {
  he: 'שמעתי קול',
  spokenHe: 'שָׁמַעְתִּי קוֹל',
  en: 'I heard a sound',
};

export const GARDEN_STAGES = [
  {
    id: 'arrive',
    line: { he: 'הגנן מגיע לגן', spokenHe: 'הַגַּנָּן מַגִּיעַ לַגָּן', en: 'The gardener arrives at the garden' },
    expanded: { he: 'הגנן מגיע עם סל', spokenHe: 'הַגַּנָּן מַגִּיעַ עִם סַל', en: 'The gardener arrives with a basket' },
  },
  {
    id: 'ask',
    line: { he: 'שון מבקש אפרסמון', spokenHe: 'שׁוֹן מְבַקֵּשׁ אֲפַרְסְמוֹן', en: 'Sean asks for a persimmon' },
    expanded: { he: 'שון מבקש אפרסמון כתום', spokenHe: 'שׁוֹן מְבַקֵּשׁ אֲפַרְסְמוֹן כָּתוֹם', en: 'Sean asks for an orange persimmon' },
  },
  {
    id: 'receive',
    line: { he: 'הגנן מושיט אפרסמון', spokenHe: 'הַגַּנָּן מוֹשִׁיט אֲפַרְסְמוֹן', en: 'The gardener hands over a persimmon' },
    expanded: { he: 'שון מקבל אפרסמון מהגנן', spokenHe: 'שׁוֹן מְקַבֵּל אֲפַרְסְמוֹן מֵהַגַּנָּן', en: 'Sean receives a persimmon from the gardener' },
  },
  {
    id: 'exchange',
    line: { he: 'שון נותן אסימון', spokenHe: 'שׁוֹן נוֹתֵן אֲסִימוֹן', en: 'Sean gives a token' },
    expanded: { he: 'שון נותן אסימון לגנן', spokenHe: 'שׁוֹן נוֹתֵן אֲסִימוֹן לַגַּנָּן', en: 'Sean gives a token to the gardener' },
  },
  {
    id: 'accept',
    line: { he: 'הגנן מקבל אסימון', spokenHe: 'הַגַּנָּן מְקַבֵּל אֲסִימוֹן', en: 'The gardener accepts a token' },
    expanded: { he: 'הגנן מקבל אסימון משון', spokenHe: 'הַגַּנָּן מְקַבֵּל אֲסִימוֹן מִשּׁוֹן', en: 'The gardener accepts a token from Sean' },
  },
  {
    id: 'pick',
    line: { he: 'הגנן קוטף דובדבנים', spokenHe: 'הַגַּנָּן קוֹטֵף דּוּבְדְּבָנִים', en: 'The gardener picks cherries' },
    expanded: { he: 'הגנן קוטף דובדבנים ותמרים', spokenHe: 'הַגַּנָּן קוֹטֵף דּוּבְדְּבָנִים וּתְמָרִים', en: 'The gardener picks cherries and dates' },
  },
  {
    id: 'put',
    line: { he: 'הגנן שם תמרים', spokenHe: 'הַגַּנָּן שָׂם תְּמָרִים', en: 'The gardener puts down dates' },
    expanded: { he: 'הגנן שם תמרים בסל', spokenHe: 'הַגַּנָּן שָׂם תְּמָרִים בַּסַּל', en: 'The gardener puts dates in the basket' },
  },
  {
    id: 'carry',
    line: { he: 'הגנן מוביל פירות', spokenHe: 'הַגַּנָּן מוֹבִיל פֵּירוֹת', en: 'The gardener carries fruit' },
    expanded: { he: 'הגנן מוביל פירות הביתה', spokenHe: 'הַגַּנָּן מוֹבִיל פֵּירוֹת הַבַּיְתָה', en: 'The gardener carries fruit home' },
  },
  {
    id: 'wash',
    line: { he: 'הגנן שוטף דובדבנים', spokenHe: 'הַגַּנָּן שׁוֹטֵף דּוּבְדְּבָנִים', en: 'The gardener washes cherries' },
    expanded: { he: 'הגנן שוטף דובדבנים ותמרים', spokenHe: 'הַגַּנָּן שׁוֹטֵף דּוּבְדְּבָנִים וּתְמָרִים', en: 'The gardener washes cherries and dates' },
  },
  {
    id: 'smell',
    line: { he: 'הגנן מריח תמרים', spokenHe: 'הַגַּנָּן מֵרִיחַ תְּמָרִים', en: 'The gardener smells dates' },
    expanded: { he: 'הגנן מריח תמרים טריים', spokenHe: 'הַגַּנָּן מֵרִיחַ תְּמָרִים טְרִיִּים', en: 'The gardener smells fresh dates' },
  },
  {
    id: 'taste',
    line: { he: 'שון טועם תמרים', spokenHe: 'שׁוֹן טוֹעֵם תְּמָרִים', en: 'Sean tastes dates' },
    expanded: { he: 'שון טועם תמרים ודובדבנים', spokenHe: 'שׁוֹן טוֹעֵם תְּמָרִים וְדּוּבְדְּבָנִים', en: 'Sean tastes dates and cherries' },
  },
  {
    id: 'share',
    line: { he: 'נועה נותנת תמרים', spokenHe: 'נוֹעָה נוֹתֶנֶת תְּמָרִים', en: 'Noa gives dates' },
    expanded: { he: 'נועה נותנת תמרים להדר', spokenHe: 'נוֹעָה נוֹתֶנֶת תְּמָרִים לְהָדָר', en: 'Noa gives dates to Hadar' },
  },
  {
    id: 'seed',
    line: { he: 'שון מוציא גרעין', spokenHe: 'שׁוֹן מוֹצִיא גַּרְעִין', en: 'Sean takes out a seed' },
    expanded: { he: 'שון מוציא גרעין מאפרסמון', spokenHe: 'שׁוֹן מוֹצִיא גַּרְעִין מֵאֲפַרְסְמוֹן', en: 'Sean takes a seed out of the persimmon' },
  },
  {
    id: 'bury',
    line: { he: 'נועה טומנת גרעין', spokenHe: 'נוֹעָה טוֹמֶנֶת גַּרְעִין', en: 'Noa buries a seed' },
    expanded: { he: 'נועה טומנת גרעין באדמה', spokenHe: 'נוֹעָה טוֹמֶנֶת גַּרְעִין בָּאֲדָמָה', en: 'Noa buries a seed in the soil' },
  },
  {
    id: 'cover',
    line: { he: 'שון מכסה גרעין', spokenHe: 'שׁוֹן מְכַסֶּה גַּרְעִין', en: 'Sean covers a seed' },
    expanded: { he: 'שון מכסה גרעין באדמה', spokenHe: 'שׁוֹן מְכַסֶּה גַּרְעִין בָּאֲדָמָה', en: 'Sean covers a seed with soil' },
  },
  {
    id: 'water',
    line: { he: 'הגנן שופך מים', spokenHe: 'הַגַּנָּן שׁוֹפֵךְ מַיִם', en: 'The gardener pours water' },
    expanded: { he: 'מים מרטיבים את הזרע', spokenHe: 'מַיִם מַרְטִיבִים אֶת הַזֶּרַע', en: 'Water wets the seed' },
  },
  {
    id: 'sun',
    line: { he: 'השמש מחממת אדמה', spokenHe: 'הַשֶּׁמֶשׁ מְחַמֶּמֶת אֲדָמָה', en: 'The sun warms soil' },
    expanded: { he: 'השמש מחממת את האדמה', spokenHe: 'הַשֶּׁמֶשׁ מְחַמֶּמֶת אֶת הָאֲדָמָה', en: 'The sun warms the soil' },
  },
  {
    id: 'sprout',
    line: { he: 'מהגרעין צומח נבט', spokenHe: 'מֵהַגַּרְעִין צוֹמֵחַ נֶבֶט', en: 'A sprout grows from the seed' },
    expanded: { he: 'מהגרעין צומח נבט ירוק', spokenHe: 'מֵהַגַּרְעִין צוֹמֵחַ נֶבֶט יָרוֹק', en: 'A green sprout grows from the seed' },
  },
  {
    id: 'tree',
    line: { he: 'הנבט גדל לעץ', spokenHe: 'הַנֶּבֶט גָּדֵל לְעֵץ', en: 'The sprout grows into a tree' },
    expanded: { he: 'הנבט גדל לעץ גבוה', spokenHe: 'הַנֶּבֶט גָּדֵל לְעֵץ גָּבוֹהַּ', en: 'The sprout grows into a tall tree' },
  },
  {
    id: 'flower',
    line: { he: 'העץ מצמיח פרחים', spokenHe: 'הָעֵץ מַצְמִיחַ פְּרָחִים', en: 'The tree grows flowers' },
    expanded: { he: 'העץ מצמיח פרחים קטנים', spokenHe: 'הָעֵץ מַצְמִיחַ פְּרָחִים קְטַנִּים', en: 'The tree grows small flowers' },
  },
  {
    id: 'fruit',
    line: { he: 'אפרסמונים גדלים בעץ', spokenHe: 'אֲפַרְסְמוֹנִים גְּדֵלִים בָּעֵץ', en: 'Persimmons grow on the tree' },
    expanded: { he: 'אפרסמונים גדלים בעץ גבוה', spokenHe: 'אֲפַרְסְמוֹנִים גְּדֵלִים בָּעֵץ גָּבוֹהַּ', en: 'Persimmons grow on a tall tree' },
  },
] as const satisfies readonly { id: string; line: GardenLine; expanded: GardenLine }[];

export type GardenStage = (typeof GARDEN_STAGES)[number]['id'];

export function createGardenRound(progress: DomainProgress, seed: string) {
  const choices = progress.successes > 0 || progress.level > 1 ? GARDEN_FRUITS : GARDEN_FRUITS.slice(0, 2);
  const offset = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0) % choices.length;
  return {
    fruits: [...choices.slice(offset), ...choices.slice(0, offset)],
    stages: progress.successes % 2 === 1
      ? [
        ...GARDEN_STAGES.slice(0, 6),
        GARDEN_STAGES[8]!,
        GARDEN_STAGES[6]!,
        GARDEN_STAGES[7]!,
        GARDEN_STAGES[9]!,
        GARDEN_STAGES[11]!,
        GARDEN_STAGES[10]!,
        ...GARDEN_STAGES.slice(12),
      ]
      : GARDEN_STAGES,
  };
}

export function gardenChildPhrase(child: GardenChild, first: GardenFruit, second?: GardenFruit): GardenLine {
  if (!second) {
    return {
      he: `${child.he} ${child.verbHe} ${first.he}`,
      spokenHe: `${child.spokenHe} ${child.spokenVerbHe} ${first.spokenHe}`,
      en: `${child.en} chooses ${first.en}`,
    };
  }
  return {
    he: `${child.he} ${child.verbHe} גם ${second.he}`,
    spokenHe: `${child.spokenHe} ${child.spokenVerbHe} גַּם ${second.spokenHe}`,
    en: `${child.en} also chooses ${second.en}`,
  };
}

export function gardenPhrase(first: GardenFruit, second?: GardenFruit, connector: GardenConnector = 'and'): GardenLine {
  if (!second) {
    return {
      he: `אני רוצה ${first.he}`,
      spokenHe: `אֲנִי רוֹצֶה ${first.spokenHe}`,
      en: `I want ${first.en}`,
    };
  }
  switch (connector) {
    case 'and':
      return {
        he: `אני רוצה ${first.he} ${second.withHe}`,
        spokenHe: `אֲנִי רוֹצֶה ${first.spokenHe} ${second.withSpokenHe}`,
        en: `I want ${first.en} and ${second.en}`,
      };
    case 'also':
      return {
        he: `גם ${first.he} וגם ${second.he}`,
        spokenHe: `גַּם ${first.spokenHe} וְגַם ${second.spokenHe}`,
        en: `Both ${first.en} and ${second.en}`,
      };
    case 'with':
      return {
        he: `${first.he} עם ${second.he} בעגלה`,
        spokenHe: `${first.spokenHe} עִם ${second.spokenHe} בָּעֲגָלָה`,
        en: `${capitalize(first.en)} with ${second.en} in the cart`,
      };
  }
}

function capitalize(word: string): string {
  return word[0]!.toUpperCase() + word.slice(1);
}

export function gardenSegments(
  line: GardenLine,
  mode: LanguageMode,
  englishVoiceLocale: EnglishVoiceLocale,
): SpeechSegment[] {
  const hebrew: SpeechSegment = { text: line.he, locale: 'he-IL' };
  const english: SpeechSegment = { text: line.en, locale: englishVoiceLocale };
  return mode === 'he' ? [hebrew] : mode === 'en' ? [english] : [
    { ...hebrew, pauseAfterMs: 260 },
    english,
  ];
}
