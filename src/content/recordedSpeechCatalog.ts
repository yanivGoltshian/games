import {
  COUNTING_QUANTITY_FORMS,
  SUPPORTED_COUNTING_CONCEPT_IDS,
  SUPPORTED_COUNTING_COUNTS,
  getCountAloudWord,
  getCountingQuestion,
} from './countingQuantity';
import { learningConcepts, puzzleScenes, sortingItems } from './concepts';
import { buildPuzzleMissModelLine, buildSortingMissModelLine } from './feedbackSpeech';
import {
  MILESTONE_PRAISE_EN,
  MILESTONE_PRAISE_HE,
  PRAISE_EN,
  PRAISE_HE,
} from './praise';
import {
  RETRY_EN_MEMORY_REPEATED,
  RETRY_EN_MEMORY_STANDARD,
  RETRY_EN_NUMBER_PAIRS_REPEATED,
  RETRY_EN_NUMBER_PAIRS_STANDARD,
  RETRY_EN_REPEATED,
  RETRY_EN_STANDARD,
  RETRY_HE_MEMORY_REPEATED,
  RETRY_HE_MEMORY_STANDARD,
  RETRY_HE_NUMBER_PAIRS_REPEATED,
  RETRY_HE_NUMBER_PAIRS_STANDARD,
  RETRY_HE_REPEATED,
  RETRY_HE_STANDARD,
} from './retry';
import { buildCountingMissModel } from '../domain/countingFeedback';
import {
  SORTING_COLOR_LABELS,
  SORTING_SHAPE_LABELS,
} from '../domain/rounds';
import { getHebrewPronunciation } from './hebrewPronunciation';
import type { SpeechLocale } from '../domain/types';

export interface RecordedSpeechCatalogEntry {
  locale: SpeechLocale;
  /**
   * Unpointed source text. This is the runtime lookup key and the manifest key,
   * and it is also the on-screen visual text. It must never contain niqqud.
   */
  text: string;
  /**
   * Pointed pronunciation used only when synthesizing the recorded clip with
   * Azure neural speech. Present for Hebrew entries so vowelization is unambiguous. Stripping
   * its niqqud yields `text` exactly. Absent for locales that need no pointing.
   */
  spokenText?: string;
}

export function collectRecordedSpeechCatalog(): RecordedSpeechCatalogEntry[] {
  const entries = new Map<string, RecordedSpeechCatalogEntry>();
  const add = (locale: SpeechLocale, text: string): void => {
    const entry: RecordedSpeechCatalogEntry = { locale, text };
    if (locale === 'he-IL') {
      entry.spokenText = getHebrewPronunciation(text);
    }
    entries.set(`${locale}\u0000${text}`, entry);
  };
  const addPair = (he: string, en: string): void => {
    add('he-IL', he);
    add('en-US', en);
    add('en-GB', en);
  };

  learningConcepts.forEach((concept) => addPair(concept.he, concept.en));
  sortingItems.forEach((item) => addPair(item.he, item.en));
  puzzleScenes.forEach((scene) => {
    addPair(scene.titleHe, scene.titleEn);
    addPair(
      `נחבר את ${scene.titleHe}`,
      `Let’s rebuild the ${scene.titleEn}`,
    );
  });

  learningConcepts.forEach((concept) => {
    addPair(`איפה ${concept.he}?`, `Where is the ${concept.en}?`);
  });

  SUPPORTED_COUNTING_CONCEPT_IDS.forEach((conceptId) => {
    addPair(
      getCountingQuestion('he', conceptId),
      getCountingQuestion('en', conceptId),
    );
    SUPPORTED_COUNTING_COUNTS.forEach((count) => {
      const quantity = COUNTING_QUANTITY_FORMS[conceptId][count];
      addPair(quantity.he, quantity.en);
      for (const missCount of [1, 2]) {
        buildCountingMissModel(conceptId, count, missCount).lines.forEach((line) => {
          addPair(line.he, line.en);
        });
      }
    });
  });
  SUPPORTED_COUNTING_COUNTS.forEach((count) => {
    addPair(getCountAloudWord('he', count), getCountAloudWord('en', count));
  });

  addPair('בוא נמיין לפי צבע', 'Let’s sort by color');
  addPair('בוא נמיין לפי צורה', 'Let’s sort by shape');
  Object.entries(SORTING_COLOR_LABELS).forEach(([id, label]) => {
    const line = buildSortingMissModelLine('color', label.he, label.en, `sort-zone:${id}`);
    addPair(line.he, line.en);
  });
  Object.entries(SORTING_SHAPE_LABELS).forEach(([id, label]) => {
    const line = buildSortingMissModelLine('shape', label.he, label.en, `sort-zone:${id}`);
    addPair(line.he, line.en);
  });

  const firstPuzzleMiss = buildPuzzleMissModelLine(1, 'puzzle-slot:any');
  const repeatedPuzzleMiss = buildPuzzleMissModelLine(2, 'puzzle-slot:any');
  addPair(firstPuzzleMiss.he, firstPuzzleMiss.en);
  addPair(repeatedPuzzleMiss.he, repeatedPuzzleMiss.en);
  addPair('פותחים שני קלפים ומחפשים זוג', 'Open two cards and find a pair');
  addPair('זוגות מספרים', 'Number pairs');
  addPair('מתאימים מספרים זהים בשתי שורות', 'Match identical numbers in two rows');
  addPair('לחץ על הזוגות', 'Press the pairs');
  addPair('עברת שלב!', 'You moved up a level!');
  addPair('עכשיו יותר מספרים', 'Now more numbers');
  addPair('זכית בגביע!', 'You won a trophy!');

  [
    ...PRAISE_HE,
    ...MILESTONE_PRAISE_HE,
    ...RETRY_HE_STANDARD,
    ...RETRY_HE_REPEATED,
    ...RETRY_HE_MEMORY_STANDARD,
    ...RETRY_HE_MEMORY_REPEATED,
    ...RETRY_HE_NUMBER_PAIRS_STANDARD,
    ...RETRY_HE_NUMBER_PAIRS_REPEATED,
  ].forEach((line) => add('he-IL', line.text));
  [
    ...PRAISE_EN,
    ...MILESTONE_PRAISE_EN,
    ...RETRY_EN_STANDARD,
    ...RETRY_EN_REPEATED,
    ...RETRY_EN_MEMORY_STANDARD,
    ...RETRY_EN_MEMORY_REPEATED,
    ...RETRY_EN_NUMBER_PAIRS_STANDARD,
    ...RETRY_EN_NUMBER_PAIRS_REPEATED,
  ].forEach((line) => {
    add('en-US', line.text);
    add('en-GB', line.text);
  });

  return [...entries.values()].sort((left, right) => (
    left.locale.localeCompare(right.locale)
    || left.text.localeCompare(right.text)
  ));
}
