import type { LocalizedSpeechLine } from '../services/speech';
import { requireLearningConcept } from './concepts';

/**
 * "Syllable Train" (רכבת ההברות) — a physical word-building game.
 *
 * A familiar word arrives as a train whose cars are its syllables. The
 * locomotive already carries the first syllable (e.g. "כַּ" of "כַּדּוּר"); Sean
 * drags the loose car ("דּוּר") to couple it. On a successful coupling the train
 * drives off and the narrator says the whole, continuous word — turning the
 * internal structure of the word into something tangible and assembleable.
 *
 * OFFLINE SPEECH CONTRACT (important):
 * The ONLY string this game ever narrates is the whole word — `he` (unpointed)
 * and `en` — both taken verbatim from the learning concept, so both are already
 * present in the recorded manifest (`collectRecordedSpeechCatalog` adds every
 * `concept.he` / `concept.en`). Therefore this module is deliberately NOT wired
 * into the catalog and needs no manifest regeneration.
 *
 * The pointed syllable splits (`firstHe` / `restHe`) and the English splits
 * (`firstEn` / `restEn`) are DISPLAY ONLY. Isolated syllables are not recorded
 * and cannot be synthesised offline, so they are never spoken — the emphasis on
 * the first car is carried visually (a pulse) plus a non-speech tone.
 */

/** Hand-authored split. Only the syllable pieces are authored here; the whole
 * word, its pointed form, and the English word are derived from the concept so
 * the narrated strings can never drift out of the recorded manifest. */
interface SyllableTrainSplit {
  conceptId: string;
  /** Pointed first syllable (locomotive). Concatenating the pieces must equal
   * the concept's pointed `spokenHe`. Display only. */
  firstHe: string;
  /** Pointed remaining syllable(s) (loose car). Display only. */
  restHe: string;
  /** English onset / first chunk. Display only. */
  firstEn: string;
  /** English rime / remaining chunk. Display only. */
  restEn: string;
}

export interface SyllableTrainWord {
  conceptId: string;
  /** Unpointed whole word — narrated, and always present in the manifest. */
  he: string;
  /** Pointed whole word for display only. */
  pointedHe: string;
  /** English whole word — narrated, and always present in the manifest. */
  en: string;
  firstHe: string;
  restHe: string;
  firstEn: string;
  restEn: string;
}

/**
 * Two-syllable words whose pointed split is unambiguous. Every pointed split
 * concatenates exactly to the concept's `spokenHe` (verified below), and every
 * concept id owns a recorded whole-word clip and a vocabulary image.
 */
const SYLLABLE_TRAIN_SPLITS: readonly SyllableTrainSplit[] = [
  { conceptId: 'ball', firstHe: 'כַּ', restHe: 'דּוּר', firstEn: 'b', restEn: 'all' },
  { conceptId: 'apple', firstHe: 'תַּ', restHe: 'פּוּחַ', firstEn: 'ap', restEn: 'ple' },
  { conceptId: 'cat', firstHe: 'חָ', restHe: 'תוּל', firstEn: 'c', restEn: 'at' },
  { conceptId: 'dog', firstHe: 'כֶּ', restHe: 'לֶב', firstEn: 'd', restEn: 'og' },
  { conceptId: 'orange', firstHe: 'תַּ', restHe: 'פּוּז', firstEn: 'or', restEn: 'ange' },
  { conceptId: 'carrot', firstHe: 'גֶּ', restHe: 'זֶר', firstEn: 'car', restEn: 'rot' },
  { conceptId: 'airplane', firstHe: 'מָ', restHe: 'טוֹס', firstEn: 'air', restEn: 'plane' },
  { conceptId: 'flower', firstHe: 'פֶּ', restHe: 'רַח', firstEn: 'flo', restEn: 'wer' },
  { conceptId: 'car', firstHe: 'אוֹ', restHe: 'טוֹ', firstEn: 'c', restEn: 'ar' },
  { conceptId: 'shoe', firstHe: 'נַ', restHe: 'עַל', firstEn: 'sh', restEn: 'oe' },
];

export const SYLLABLE_TRAIN_WORDS: readonly SyllableTrainWord[] = SYLLABLE_TRAIN_SPLITS.map(
  (split) => {
    const concept = requireLearningConcept(split.conceptId);
    const pointedHe = split.firstHe + split.restHe;
    if (pointedHe !== concept.spokenHe) {
      throw new Error(
        `Syllable split for "${split.conceptId}" is "${pointedHe}" but the concept is pronounced "${concept.spokenHe}"`,
      );
    }
    return {
      conceptId: split.conceptId,
      he: concept.he,
      pointedHe: concept.spokenHe,
      en: concept.en,
      firstHe: split.firstHe,
      restHe: split.restHe,
      firstEn: split.firstEn,
      restEn: split.restEn,
    };
  },
);

/** Display-only prompt shown on the stage (never spoken / never in the manifest). */
export const SYLLABLE_TRAIN_PROMPT: LocalizedSpeechLine = {
  he: 'חברו את הקרונות',
  en: 'Couple the train cars',
};

/** Display-only title (never spoken / never routed through the niqqud table). */
export const SYLLABLE_TRAIN_TITLE_HE = 'רכבת ההברות';

export function requireSyllableTrainWord(conceptId: string): SyllableTrainWord {
  const word = SYLLABLE_TRAIN_WORDS.find((entry) => entry.conceptId === conceptId);
  if (!word) {
    throw new Error(`Unknown syllable-train word: ${conceptId}`);
  }
  return word;
}
