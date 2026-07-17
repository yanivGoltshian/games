import { learningConcepts, puzzleScenes } from './concepts';
import {
  COUNTING_QUANTITY_FORMS,
  SUPPORTED_COUNTING_CONCEPT_IDS,
  SUPPORTED_COUNTING_COUNTS,
  getCountAloudSpokenWord,
  getCountAloudWord,
  getCountingQuestion,
  getCountingQuestionSpoken,
} from './countingQuantity';
import { STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS } from './storyThatWaitsHebrew';

/**
 * Hebrew pronunciation layer for the recorded-speech fallback.
 *
 * The visual UI text and the recorded-speech manifest keys stay UNPOINTED so the
 * runtime lookup keeps working exactly as before. Only the offline generator uses
 * the pointed `spokenText` below when it drives Azure neural speech, guaranteeing
 * pronunciation (shin/sin, gendered numbers, dagesh, definite gutturals) without
 * ever changing the base consonants of the source string.
 *
 * Usually the pointed form only adds niqqud. A reviewed full-spelling noun may
 * contract to its canonical pointed spelling (for example ברווז -> בַּרְוָז);
 * getHebrewPronunciationSkeleton derives those explicit catalog exceptions.
 */

/** Hebrew niqqud + dagesh + shin/sin dots (excludes base letters and maqaf). */
const NIQQUD_PATTERN = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;

/** Remove every niqqud mark, returning the bare consonant skeleton. */
export function stripNiqqud(value: string): string {
  return value.normalize('NFC').replace(NIQQUD_PATTERN, '');
}

/** True when the string carries at least one niqqud mark. */
export function hasNiqqud(value: string): boolean {
  NIQQUD_PATTERN.lastIndex = 0;
  return NIQQUD_PATTERN.test(value.normalize('NFC'));
}

export function getHebrewPronunciationSkeleton(source: string): string {
  const replacements = learningConcepts.flatMap((concept) => {
    const pairs = [[concept.he, stripNiqqud(concept.spokenHe)]] as Array<[string, string]>;
    if (concept.quantity) {
      pairs.push(
        [concept.quantity.he.plural, stripNiqqud(concept.quantity.he.pluralSpoken)],
        [concept.quantity.he.countedPlural, stripNiqqud(concept.quantity.he.countedPluralSpoken)],
      );
    }
    return pairs;
  }).filter(([visual, spoken]) => visual !== spoken)
    .sort(([left], [right]) => right.length - left.length);

  return replacements.reduce(
    (skeleton, [visual, spoken]) => skeleton.replaceAll(visual, spoken),
    source.normalize('NFC'),
  );
}

export const HEBREW_UNLOCK_PRIMER = {
  sourceText: 'שלום שון',
  spokenText: 'שָׁלוֹם שׁוֹן',
} as const;

function collectCatalogPronunciations(): Record<string, string> {
  const pronunciations: Record<string, string> = {};
  const add = (source: string, spoken: string): void => {
    pronunciations[source] = spoken;
  };

  learningConcepts.forEach((concept) => {
    add(concept.he, concept.spokenHe);
    add(`איפה ${concept.he}?`, `אֵיפֹה ${concept.spokenHe}?`);
  });

  puzzleScenes.forEach((scene) => {
    add(scene.titleHe, scene.titleHeSpoken);
    add(scene.promptHe, scene.promptHeSpoken);
  });

  SUPPORTED_COUNTING_CONCEPT_IDS.forEach((conceptId) => {
    add(getCountingQuestion('he', conceptId), getCountingQuestionSpoken(conceptId));
    SUPPORTED_COUNTING_COUNTS.forEach((count) => {
      const quantity = COUNTING_QUANTITY_FORMS[conceptId][count];
      add(quantity.he, quantity.heSpoken);
      add(`יש כאן ${quantity.he}.`, `יֵשׁ כָּאן ${quantity.heSpoken}.`);
    });
  });

  SUPPORTED_COUNTING_COUNTS.forEach((count) => {
    add(getCountAloudWord('he', count), getCountAloudSpokenWord(count));
  });

  return pronunciations;
}

/**
 * Manually, context-aware niqqud for every catalog phrase and staged production
 * phrase. Keys are exact unpointed source strings (never edit them); values are
 * pointed synthesis text. A staged phrase still requires its own release gate.
 */
export const HEBREW_PRONUNCIATIONS: Readonly<Record<string, string>> = {
  ...collectCatalogPronunciations(),

  // Web Speech unlock primer.
  [HEBREW_UNLOCK_PRIMER.sourceText]: HEBREW_UNLOCK_PRIMER.spokenText,

  // Story That Waits — staged for human review; not yet in the recorded catalog.
  ...STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS,

  // Nouns / concept words.
  'אוטו': 'אוֹטוֹ',
  'בננה': 'בָּנָנָה',
  'חתול': 'חָתוּל',
  'כדור': 'כַּדּוּר',
  'כלב': 'כֶּלֶב',
  'נעל': 'נַעַל',
  'תפוח': 'תַּפּוּחַ',

  // Counting — feminine "count aloud" words (one … ten).
  'אחת': 'אַחַת',
  'שתיים': 'שְׁתַּיִים',
  'שלוש': 'שָׁלוֹשׁ',
  'ארבע': 'אַרְבַּע',
  'חמש': 'חָמֵשׁ',
  'שש': 'שֵׁשׁ',
  'שבע': 'שֶׁבַע',
  'שמונה': 'שְׁמוֹנֶה',
  'תשע': 'תֵּשַׁע',
  'עשר': 'עֶשֶׂר',

  // Colours.
  'עיגול אדום': 'עִיגּוּל אָדוֹם',
  'עיגול ירוק': 'עִיגּוּל יָרוֹק',
  'עיגול כחול': 'עִיגּוּל כָּחוֹל',
  'ריבוע אדום': 'רִיבּוּעַ אָדוֹם',
  'ריבוע כחול': 'רִיבּוּעַ כָּחוֹל',
  'ריבוע צהוב': 'רִיבּוּעַ צָהוֹב',
  'משולש אדום': 'מְשׁוּלָשׁ אָדוֹם',
  'משולש ירוק': 'מְשׁוּלָשׁ יָרוֹק',
  'משולש צהוב': 'מְשׁוּלָשׁ צָהוֹב',
  'כוכב ירוק': 'כּוֹכָב יָרוֹק',
  'כוכב כחול': 'כּוֹכָב כָּחוֹל',
  'כוכב צהוב': 'כּוֹכָב צָהוֹב',

  // "Where is …?" prompts.
  'איפה אוטו?': 'אֵיפֹה אוֹטוֹ?',
  'איפה בננה?': 'אֵיפֹה בָּנָנָה?',
  'איפה חתול?': 'אֵיפֹה חָתוּל?',
  'איפה כדור?': 'אֵיפֹה כַּדּוּר?',
  'איפה כלב?': 'אֵיפֹה כֶּלֶב?',
  'איפה נעל?': 'אֵיפֹה נַעַל?',
  'איפה תפוח?': 'אֵיפֹה תַּפּוּחַ?',

  // Counting questions.
  'כמה בננות יש כאן?': 'כַּמָּה בָּנָנוֹת יֵשׁ כָּאן?',
  'כמה כדורים יש כאן?': 'כַּמָּה כַּדּוּרִים יֵשׁ כָּאן?',
  'כמה תפוחים יש כאן?': 'כַּמָּה תַּפּוּחִים יֵשׁ כָּאן?',

  // Bare quantity phrases — masculine (balls / apples), feminine (bananas).
  'כדור אחד': 'כַּדּוּר אֶחָד',
  'שני כדורים': 'שְׁנֵי כַּדּוּרִים',
  'שלושה כדורים': 'שְׁלוֹשָׁה כַּדּוּרִים',
  'ארבעה כדורים': 'אַרְבָּעָה כַּדּוּרִים',
  'חמישה כדורים': 'חֲמִישָׁה כַּדּוּרִים',
  'שישה כדורים': 'שִׁישָׁה כַּדּוּרִים',
  'שבעה כדורים': 'שִׁבְעָה כַּדּוּרִים',
  'שמונה כדורים': 'שְׁמוֹנָה כַּדּוּרִים',
  'תשעה כדורים': 'תִּשְׁעָה כַּדּוּרִים',
  'עשרה כדורים': 'עֲשָׂרָה כַּדּוּרִים',
  'תפוח אחד': 'תַּפּוּחַ אֶחָד',
  'שני תפוחים': 'שְׁנֵי תַּפּוּחִים',
  'שלושה תפוחים': 'שְׁלוֹשָׁה תַּפּוּחִים',
  'ארבעה תפוחים': 'אַרְבָּעָה תַּפּוּחִים',
  'חמישה תפוחים': 'חֲמִישָׁה תַּפּוּחִים',
  'שישה תפוחים': 'שִׁישָׁה תַּפּוּחִים',
  'שבעה תפוחים': 'שִׁבְעָה תַּפּוּחִים',
  'שמונה תפוחים': 'שְׁמוֹנָה תַּפּוּחִים',
  'תשעה תפוחים': 'תִּשְׁעָה תַּפּוּחִים',
  'עשרה תפוחים': 'עֲשָׂרָה תַּפּוּחִים',
  'בננה אחת': 'בָּנָנָה אַחַת',
  'שתי בננות': 'שְׁתֵּי בָּנָנוֹת',
  'שלוש בננות': 'שָׁלוֹשׁ בָּנָנוֹת',
  'ארבע בננות': 'אַרְבַּע בָּנָנוֹת',
  'חמש בננות': 'חָמֵשׁ בָּנָנוֹת',
  'שש בננות': 'שֵׁשׁ בָּנָנוֹת',
  'שבע בננות': 'שֶׁבַע בָּנָנוֹת',
  'שמונה בננות': 'שְׁמוֹנֶה בָּנָנוֹת',
  'תשע בננות': 'תֵּשַׁע בָּנָנוֹת',
  'עשר בננות': 'עֶשֶׂר בָּנָנוֹת',

  // "There are N here." statements.
  'יש כאן כדור אחד.': 'יֵשׁ כָּאן כַּדּוּר אֶחָד.',
  'יש כאן שני כדורים.': 'יֵשׁ כָּאן שְׁנֵי כַּדּוּרִים.',
  'יש כאן שלושה כדורים.': 'יֵשׁ כָּאן שְׁלוֹשָׁה כַּדּוּרִים.',
  'יש כאן ארבעה כדורים.': 'יֵשׁ כָּאן אַרְבָּעָה כַּדּוּרִים.',
  'יש כאן חמישה כדורים.': 'יֵשׁ כָּאן חֲמִישָׁה כַּדּוּרִים.',
  'יש כאן שישה כדורים.': 'יֵשׁ כָּאן שִׁישָׁה כַּדּוּרִים.',
  'יש כאן שבעה כדורים.': 'יֵשׁ כָּאן שִׁבְעָה כַּדּוּרִים.',
  'יש כאן שמונה כדורים.': 'יֵשׁ כָּאן שְׁמוֹנָה כַּדּוּרִים.',
  'יש כאן תשעה כדורים.': 'יֵשׁ כָּאן תִּשְׁעָה כַּדּוּרִים.',
  'יש כאן עשרה כדורים.': 'יֵשׁ כָּאן עֲשָׂרָה כַּדּוּרִים.',
  'יש כאן תפוח אחד.': 'יֵשׁ כָּאן תַּפּוּחַ אֶחָד.',
  'יש כאן שני תפוחים.': 'יֵשׁ כָּאן שְׁנֵי תַּפּוּחִים.',
  'יש כאן שלושה תפוחים.': 'יֵשׁ כָּאן שְׁלוֹשָׁה תַּפּוּחִים.',
  'יש כאן ארבעה תפוחים.': 'יֵשׁ כָּאן אַרְבָּעָה תַּפּוּחִים.',
  'יש כאן חמישה תפוחים.': 'יֵשׁ כָּאן חֲמִישָׁה תַּפּוּחִים.',
  'יש כאן שישה תפוחים.': 'יֵשׁ כָּאן שִׁישָׁה תַּפּוּחִים.',
  'יש כאן שבעה תפוחים.': 'יֵשׁ כָּאן שִׁבְעָה תַּפּוּחִים.',
  'יש כאן שמונה תפוחים.': 'יֵשׁ כָּאן שְׁמוֹנָה תַּפּוּחִים.',
  'יש כאן תשעה תפוחים.': 'יֵשׁ כָּאן תִּשְׁעָה תַּפּוּחִים.',
  'יש כאן עשרה תפוחים.': 'יֵשׁ כָּאן עֲשָׂרָה תַּפּוּחִים.',
  'יש כאן בננה אחת.': 'יֵשׁ כָּאן בָּנָנָה אַחַת.',
  'יש כאן שתי בננות.': 'יֵשׁ כָּאן שְׁתֵּי בָּנָנוֹת.',
  'יש כאן שלוש בננות.': 'יֵשׁ כָּאן שָׁלוֹשׁ בָּנָנוֹת.',
  'יש כאן ארבע בננות.': 'יֵשׁ כָּאן אַרְבַּע בָּנָנוֹת.',
  'יש כאן חמש בננות.': 'יֵשׁ כָּאן חָמֵשׁ בָּנָנוֹת.',
  'יש כאן שש בננות.': 'יֵשׁ כָּאן שֵׁשׁ בָּנָנוֹת.',
  'יש כאן שבע בננות.': 'יֵשׁ כָּאן שֶׁבַע בָּנָנוֹת.',
  'יש כאן שמונה בננות.': 'יֵשׁ כָּאן שְׁמוֹנֶה בָּנָנוֹת.',
  'יש כאן תשע בננות.': 'יֵשׁ כָּאן תֵּשַׁע בָּנָנוֹת.',
  'יש כאן עשר בננות.': 'יֵשׁ כָּאן עֶשֶׂר בָּנָנוֹת.',

  // Sorting prompts.
  'בוא נמיין לפי צבע': 'בּוֹא נְמַיֵּין לְפִי צֶבַע',
  'בוא נמיין לפי צורה': 'בּוֹא נְמַיֵּין לְפִי צוּרָה',
  'בוא נספור יחד.': 'בּוֹא נִסְפּוֹר יַחַד.',

  // Sorting miss-model lines (colour).
  'הצבע הוא אדום. שמים בסל האדום.': 'הַצֶּבַע הוּא אָדוֹם. שָׂמִים בַּסַּל הָאָדוֹם.',
  'הצבע הוא ירוק. שמים בסל הירוק.': 'הַצֶּבַע הוּא יָרוֹק. שָׂמִים בַּסַּל הַיָּרוֹק.',
  'הצבע הוא כחול. שמים בסל הכחול.': 'הַצֶּבַע הוּא כָּחוֹל. שָׂמִים בַּסַּל הַכָּחוֹל.',
  'הצבע הוא צהוב. שמים בסל הצהוב.': 'הַצֶּבַע הוּא צָהוֹב. שָׂמִים בַּסַּל הַצָּהוֹב.',

  // Sorting miss-model lines (shape).
  'הצורה היא כוכב. שמים בסל עם כוכב.': 'הַצּוּרָה הִיא כּוֹכָב. שָׂמִים בַּסַּל עִם כּוֹכָב.',
  'הצורה היא משולש. שמים בסל עם משולש.': 'הַצּוּרָה הִיא מְשׁוּלָשׁ. שָׂמִים בַּסַּל עִם מְשׁוּלָשׁ.',
  'הצורה היא עיגול. שמים בסל עם עיגול.': 'הַצּוּרָה הִיא עִיגּוּל. שָׂמִים בַּסַּל עִם עִיגּוּל.',
  'הצורה היא ריבוע. שמים בסל עם ריבוע.': 'הַצּוּרָה הִיא רִיבּוּעַ. שָׂמִים בַּסַּל עִם רִיבּוּעַ.',

  // Puzzle miss-model lines + puzzle rebuild titles.
  'החתיכה מתאימה למקום המואר. נסה שם.': 'הַחֲתִיכָה מַתְאִימָה לַמָּקוֹם הַמּוּאָר. נַסֵּה שָׁם.',
  'כמעט. נסה מקום אחר.': 'כִּמְעַט. נַסֵּה מָקוֹם אַחֵר.',
  'נעזור לאוטו לחזור להיות שלם': 'נַעֲזוֹר לָאוֹטוֹ לַחֲזוֹר לִהְיוֹת שָׁלֵם',
  'נעזור לחתול לחזור להיות שלם': 'נַעֲזוֹר לֶחָתוּל לַחֲזוֹר לִהְיוֹת שָׁלֵם',
  'נעזור לכלב לחזור להיות שלם': 'נַעֲזוֹר לַכֶּלֶב לַחֲזוֹר לִהְיוֹת שָׁלֵם',
  'נעזור לתפוח לחזור להיות שלם': 'נַעֲזוֹר לַתַּפּוּחַ לַחֲזוֹר לִהְיוֹת שָׁלֵם',
  'מסיבת היער הכחולה': 'מְסִיבַּת הַיַּעַר הַכְּחוּלָּה',
  'הרפתקת מטוסי ההצלה': 'הַרְפַּתְקַת מְטוֹסֵי הַהַצָּלָה',
  'גינת הגזר הענק': 'גִּינַּת הַגֶּזֶר הָעֲנָק',
  'נחבר את מסיבת היער הכחולה': 'נְחַבֵּר אֶת מְסִיבַּת הַיַּעַר הַכְּחוּלָּה',
  'נחבר את הרפתקת מטוסי ההצלה': 'נְחַבֵּר אֶת הַרְפַּתְקַת מְטוֹסֵי הַהַצָּלָה',
  'נחבר את גינת הגזר הענק': 'נְחַבֵּר אֶת גִּינַּת הַגֶּזֶר הָעֲנָק',

  // Memory game guidance.
  'בוא נחפש איפה הזוג מתחבא.': 'בּוֹא נְחַפֵּשׂ אֵיפֹה הַזּוּג מִתְחַבֵּא.',
  'נחפש יחד את הזוג.': 'נְחַפֵּשׂ יַחַד אֶת הַזּוּג.',
  'נמשיך לחפש את הזוג.': 'נַמְשִׁיךְ לְחַפֵּשׂ אֶת הַזּוּג.',
  'פותחים שני קלפים ומחפשים זוג': 'פּוֹתְחִים שְׁנֵי קְלָפִים וּמְחַפְּשִׂים זוּג',

  // Number pairs game and automatic progression.
  'זוגות מספרים': 'זוּגוֹת מִסְפָּרִים',
  'מתאימים מספרים זהים בשתי שורות': 'מַתְאִימִים מִסְפָּרִים זֵהִים בִּשְׁתֵּי שׁוּרוֹת',
  'לחץ על הזוגות': 'לְחַץ עַל הַזּוּגוֹת',
  'עברת שלב!': 'עָבַרְתָּ שָׁלָב!',
  'עכשיו יותר מספרים': 'עַכְשָׁיו יוֹתֵר מִסְפָּרִים',
  'זכית בגביע!': 'זָכִיתָ בַּגָּבִיעַ!',

  // Praise + milestone praise.
  'הצלחת!': 'הִצְלַחְתָּ!',
  'יופי!': 'יוֹפִי!',
  'כל הכבוד, שון!': 'כָּל הַכָּבוֹד, שׁוֹן!',
  'מעולה!': 'מְעוּלֶה!',
  'איזה כיף, שון עולה שלב!': 'אֵיזֶה כֵּיף, שׁוֹן עוֹלֶה שָׁלָב!',
  'שון מתמיד כל כך יפה, איזה אלוף!':
    'שׁוֹן מַתְמִיד כָּל כָּךְ יָפֶה, אֵיזֶה אַלּוּף!',

  // Retry encouragement (standard + memory + Sean-personalised).
  'ביחד ובנחת, נמשיך לחפש.': 'בְּיַחַד וּבְנַחַת, נַמְשִׁיךְ לְחַפֵּשׂ.',
  'יופי שהמשכת לחפש. ננסה עוד זוג.': 'יוֹפִי שֶׁהִמְשַׁכְתָּ לְחַפֵּשׂ. נְנַסֶּה עוֹד זוּג.',
  'יופי שניסית, חמודי. תמשיך ככה.': 'יוֹפִי שֶׁנִּיסִיתָ, חֲמוּדִי. תַּמְשִׁיךְ כָּכָה.',
  'כמעט, שון. בוא נמשיך.': 'כִּמְעַט, שׁוֹן. בּוֹא נַמְשִׁיךְ.',
  'כמעט. נמצא את הזוג.': 'כִּמְעַט. נִמְצָא אֶת הַזּוּג.',
  'בוא נמשיך.': 'בּוֹא נַמְשִׁיךְ.',
  'נמשיך ביחד.': 'נַמְשִׁיךְ בְּיַחַד.',
  'עוד ניסיון קטן.': 'עוֹד נִיסָּיוֹן קָטָן.',
  'אני איתך, חמודי. בוא ננסה עוד פעם.': 'אֲנִי אִיתְּךָ, חֲמוּדִי. בּוֹא נְנַסֶּה עוֹד פַּעַם.',
  'ניסיון יפה, שון! נמשיך לנסות.': 'נִיסָּיוֹן יָפֶה, שׁוֹן! נַמְשִׁיךְ לְנַסּוֹת.',
  'שון, אהבתי שניסית. נמשיך לנסות.': 'שׁוֹן, אָהַבְתִּי שֶׁנִּיסִיתָ. נַמְשִׁיךְ לְנַסּוֹת.',
  'שון, אתה אלוף בלחפש. נמשיך יחד.': 'שׁוֹן, אַתָּה אַלּוּף בִּלְחַפֵּשׂ. נַמְשִׁיךְ יַחַד.',
  'שון, אתה אלוף בלנסות. בוא נמשיך.': 'שׁוֹן, אַתָּה אַלּוּף בְּלְנַסּוֹת. בּוֹא נַמְשִׁיךְ.',
  'שון, אתה אלוף בלנסות. ניקח רגע ונמשיך.':
    'שׁוֹן, אַתָּה אַלּוּף בְּלְנַסּוֹת. נִיקַּח רֶגַע וּנַמְשִׁיךְ.',
  'שון, אתה אלוף בלנסות. נמשיך ביחד.':
    'שׁוֹן, אַתָּה אַלּוּף בְּלְנַסּוֹת. נַמְשִׁיךְ בְּיַחַד.',
  'שון, אתה יכול. עוד ניסיון קטן.': 'שׁוֹן, אַתָּה יָכוֹל. עוֹד נִיסָּיוֹן קָטָן.',
  'שון, בוא נמשיך לחפש את הזוג.': 'שׁוֹן, בּוֹא נַמְשִׁיךְ לְחַפֵּשׂ אֶת הַזּוּג.',
  'שון, ביחד ובנחת, בוא נמשיך לנסות.': 'שׁוֹן, בְּיַחַד וּבְנַחַת, בּוֹא נַמְשִׁיךְ לְנַסּוֹת.',
  'שון, יופי שניסית, חמודי. עוד ניסיון קטן.':
    'שׁוֹן, יוֹפִי שֶׁנִּיסִיתָ, חֲמוּדִי. עוֹד נִיסָּיוֹן קָטָן.',
  'שון, כל ניסיון עוזר לנו ללמוד. בוא נמשיך.':
    'שׁוֹן, כָּל נִיסָּיוֹן עוֹזֵר לָנוּ לִלְמוֹד. בּוֹא נַמְשִׁיךְ.',

  // Silly Alien (החייזר המבולבל) — broken words + narration.
  // Staged for the offline speech pass; not yet in the recorded catalog.
  'פוח': 'פּוּחַ',
  'דור': 'דּוּר',
  'ננה': 'נָנָה',
  'תול': 'תּוּל',
  'פוז': 'פּוּז',
  'אוי, התבלבלתי!': 'אוֹי, הִתְבַּלְבַּלְתִּי!',
  'שון, תגיד לו איך אומרים:': 'שׁוֹן, תַּגִּיד לוֹ אֵיךְ אוֹמְרִים:',
  'אני מקשיב לך!': 'אֲנִי מַקְשִׁיב לְךָ!',
  'כן! עכשיו אני יודע!': 'כֵּן! עַכְשָׁיו אֲנִי יוֹדֵעַ!',
  'בוא ננסה ביחד!': 'בּוֹא נְנַסֶּה בְּיַחַד!',
};

/**
 * Pointed pronunciation for a Hebrew source string. Falls back to the source
 * unchanged when no mapping exists; the catalog integrity test guarantees the
 * table stays complete, so the fallback never ships silently.
 */
export function getHebrewPronunciation(source: string): string {
  return HEBREW_PRONUNCIATIONS[source] ?? source;
}
