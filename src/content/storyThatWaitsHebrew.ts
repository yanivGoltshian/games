/**
 * Human-review gate for Story That Waits Hebrew recording production.
 *
 * Keys are immutable, unpointed runtime/recorded lookup text. Values are the
 * fully pointed synthesis source staged for review. These sentences remain
 * outside the recorded catalog until language review approves the full set.
 * Review must cover pronunciation, standard Israeli stress, masculine
 * agreement, and natural child-directed sentence prosody.
 */
export const STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS = {
  'ברווז רואה כדור.': 'בַּרְוָז רוֹאֶה כַּדּוּר.',
  'ברווז נוגע בכדור.': 'בַּרְוָז נוֹגֵעַ בַּכַּדּוּר.',
  'הכדור מתגלגל אל הברווז.': 'הַכַּדּוּר מִתְגַּלְגֵּל אֶל הַבַּרְוָז.',
  'ברווז מחבק את הכדור.': 'בַּרְוָז מְחַבֵּק אֶת הַכַּדּוּר.',
  'ארנב רואה גזר.': 'אַרְנָב רוֹאֶה גֶּזֶר.',
  'ארנב מרים את הגזר.': 'אַרְנָב מֵרִים אֶת הַגֶּזֶר.',
  'ארנב מריח את הגזר.': 'אַרְנָב מֵרִיחַ אֶת הַגֶּזֶר.',
  'ארנב אוכל את הגזר.': 'אַרְנָב אוֹכֵל אֶת הַגֶּזֶר.',
  'אוטובוס נוסע אל העץ.': 'אוֹטוֹבּוּס נוֹסֵעַ אֶל הָעֵץ.',
  'אוטובוס עוצר ליד העץ.': 'אוֹטוֹבּוּס עוֹצֵר לְיַד הָעֵץ.',
  'אוטובוס נוסע אל הפרח.': 'אוֹטוֹבּוּס נוֹסֵעַ אֶל הַפֶּרַח.',
  'אוטובוס נח ליד הפרח.': 'אוֹטוֹבּוּס נָח לְיַד הַפֶּרַח.',
  'חתול רואה נעל.': 'חָתוּל רוֹאֶה נַעַל.',
  'חתול מזיז את הנעל.': 'חָתוּל מֵזִיז אֶת הַנַּעַל.',
  'חתול מוצא כוס.': 'חָתוּל מוֹצֵא כּוֹס.',
  'חתול יושב ליד הכוס.': 'חָתוּל יוֹשֵׁב לְיַד הַכּוֹס.',
} as const satisfies Readonly<Record<string, string>>;

export const STORY_THAT_WAITS_HEBREW_DISPLAY_TEXTS =
  STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS;

export type StoryThatWaitsHebrewLookupText =
  keyof typeof STORY_THAT_WAITS_HEBREW_PRODUCTION_TEXTS;

export const STORY_THAT_WAITS_HEBREW_REVIEW_GATE = {
  status: 'pending-human-review',
  generationAllowed: false,
  requiredChecks: [
    'pronunciation',
    'stress',
    'masculine-agreement',
    'natural-prosody',
  ],
} as const;
