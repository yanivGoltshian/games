import { describe, expect, it } from 'vitest';
import {
  getHebrewPronunciation,
  getHebrewPronunciationSkeleton,
  hasNiqqud,
  HEBREW_PRONUNCIATIONS,
  stripNiqqud,
} from './hebrewPronunciation';

const criticalPronunciations: Readonly<Record<string, string>> = {
  'שש': 'שֵׁשׁ',
  'שישה כדורים': 'שִׁישָׁה כַּדּוּרִים',
  'שתי בננות': 'שְׁתֵּי בָּנָנוֹת',
  'עשרה תפוחים': 'עֲשָׂרָה תַּפּוּחִים',
  'כוס': 'כּוֹס',
  'כפית': 'כַּפִּית',
  'רכבת': 'רַכֶּבֶת',
  'שתי כוסות': 'שְׁתֵּי כּוֹסוֹת',
  'שלוש כפיות': 'שָׁלוֹשׁ כַּפִּיּוֹת',
  'שתי רכבות': 'שְׁתֵּי רַכָּבוֹת',
  'שני כיסאות': 'שְׁנֵי כִּיסְאוֹת',
  'שני עצים': 'שְׁנֵי עֵצִים',
  'הצורה היא משולש. שמים בסל עם משולש.':
    'הַצּוּרָה הִיא מְשׁוּלָשׁ. שָׂמִים בַּסַּל עִם מְשׁוּלָשׁ.',
  'נחבר את הרפתקת מטוסי ההצלה':
    'נְחַבֵּר אֶת הַרְפַּתְקַת מְטוֹסֵי הַהַצָּלָה',
  'שון, אתה אלוף בלנסות. בוא ננסה שוב.':
    'שׁוֹן, אַתָּה אַלּוּף בְּלְנַסּוֹת. בּוֹא נְנַסֶּה שׁוּב.',
};

describe('Hebrew pronunciation rules', () => {
  it('only adds niqqud and preserves every source skeleton exactly', () => {
    for (const [source, spoken] of Object.entries(HEBREW_PRONUNCIATIONS)) {
      expect(hasNiqqud(source), `source "${source}" must stay unpointed`).toBe(false);
      expect(hasNiqqud(spoken), `spoken "${source}" must be pointed`).toBe(true);
      expect(stripNiqqud(spoken).normalize('NFC')).toBe(getHebrewPronunciationSkeleton(source));
      expect(spoken).toBe(spoken.normalize('NFC'));
      expect(spoken, `cantillation is not allowed in "${source}"`).not.toMatch(/[\u0591-\u05AF]/);
    }
  });

  it.each(Object.entries(criticalPronunciations))(
    'keeps the reviewed pronunciation for %s',
    (source, spoken) => {
      expect(getHebrewPronunciation(source)).toBe(spoken);
    },
  );
});
