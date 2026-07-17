import type { LocalizedSpeechLine } from '../services/speech';

/**
 * "Silly Alien" (החייזר המבולבל) — auditory-discrimination content.
 *
 * The alien drops the first syllable of a familiar word (e.g. says "פוח" instead
 * of "תפוח"); Sean is asked to say the whole word out loud. We detect vocal
 * *effort* through the microphone (never speech-to-text — toddler speech is
 * imprecise), so the exact word never has to be recognised.
 *
 * NOTE FOR THE OFFLINE SPEECH STEP: the Hebrew strings below (the broken words
 * and the narration lines) are intentionally NOT yet wired into
 * `collectRecordedSpeechCatalog()`, so we don't have to run `generate:speech`
 * and spend Azure quota prematurely. Their strict-niqqud pronunciations already
 * live in `hebrewPronunciation.ts`. When we do the audio pass, append these
 * phrases to the catalog and regenerate the manifest.
 */

export interface SillyAlienWord {
  conceptId: string;
  /** Full, correct word — display (unpointed) Hebrew. */
  he: string;
  en: string;
  /** The alien's broken attempt with the first syllable dropped (display). */
  brokenHe: string;
  brokenEn: string;
  /** The first Hebrew letter the alien "swallowed" (display, unpointed). */
  droppedLetterHe: string;
}

/**
 * Each word is a "drop the first sound" gag. The broken forms and dropped
 * letters are chosen so the fix is always adding one clear opening syllable.
 */
export const SILLY_ALIEN_WORDS: readonly SillyAlienWord[] = [
  { conceptId: 'apple', he: 'תפוח', en: 'apple', brokenHe: 'פוח', brokenEn: 'pple', droppedLetterHe: 'ת' },
  { conceptId: 'ball', he: 'כדור', en: 'ball', brokenHe: 'דור', brokenEn: 'all', droppedLetterHe: 'כ' },
  { conceptId: 'banana', he: 'בננה', en: 'banana', brokenHe: 'ננה', brokenEn: 'anana', droppedLetterHe: 'ב' },
  { conceptId: 'cat', he: 'חתול', en: 'cat', brokenHe: 'תול', brokenEn: 'at', droppedLetterHe: 'ח' },
  { conceptId: 'orange', he: 'תפוז', en: 'orange', brokenHe: 'פוז', brokenEn: 'range', droppedLetterHe: 'ת' },
];

/** Alien is embarrassed it dropped the sound. */
export const SILLY_ALIEN_INTRO: LocalizedSpeechLine = {
  he: 'אוי, התבלבלתי!',
  en: 'Oops, I got confused!',
};

/** Narrator hands the fix to Sean. */
export const SILLY_ALIEN_PROMPT: LocalizedSpeechLine = {
  he: 'שון, תגיד לו איך אומרים:',
  en: 'Sean, tell him how to say it:',
};

/** Shown while the microphone is open and listening for effort. */
export const SILLY_ALIEN_LISTENING: LocalizedSpeechLine = {
  he: 'אני מקשיב לך!',
  en: "I'm listening to you!",
};

/** Alien gets it right, thanks to Sean. */
export const SILLY_ALIEN_SUCCESS: LocalizedSpeechLine = {
  he: 'כן! עכשיו אני יודע!',
  en: 'Yes! Now I know!',
};

/** Gentle nudge when we still need a little more voice. */
export const SILLY_ALIEN_RETRY: LocalizedSpeechLine = {
  he: 'בוא ננסה ביחד!',
  en: "Let's try together!",
};

/** Display-only title (never spoken / never routed through the niqqud table). */
export const SILLY_ALIEN_TITLE_HE = 'החייזר המבולבל';

export function requireSillyAlienWord(conceptId: string): SillyAlienWord {
  const word = SILLY_ALIEN_WORDS.find((entry) => entry.conceptId === conceptId);
  if (!word) {
    throw new Error(`Unknown silly-alien word: ${conceptId}`);
  }
  return word;
}
