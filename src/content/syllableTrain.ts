import type { SpeechLocale, ToddlerSettings } from '../domain/types';
import type { InstalledCommunicationContent } from '../services/communicationAssetReadiness';
import { requireLearningConcept } from './concepts';

export const WORD_TRAIN_CONTENT_VERSION = 'word-train-v2' as const;

export const WORD_TRAIN_CONCEPT_IDS = [
  'ball',
  'apple',
  'cat',
  'dog',
  'orange',
  'carrot',
  'airplane',
  'flower',
  'car',
  'shoe',
] as const;

export const WORD_TRAIN_LOCALES = ['he-IL', 'en-US', 'en-GB'] as const;

export type WordTrainConceptId = (typeof WORD_TRAIN_CONCEPT_IDS)[number];

export interface SyllableTrainWord {
  contentVersion: typeof WORD_TRAIN_CONTENT_VERSION;
  conceptId: WordTrainConceptId;
  image: string;
  recordings: Readonly<Record<SpeechLocale, string>>;
}

export const SYLLABLE_TRAIN_WORDS: readonly SyllableTrainWord[] =
  WORD_TRAIN_CONCEPT_IDS.map((conceptId) => {
    const concept = requireLearningConcept(conceptId);
    return {
      contentVersion: WORD_TRAIN_CONTENT_VERSION,
      conceptId,
      image: concept.image,
      recordings: {
        'he-IL': concept.he,
        'en-US': concept.en,
        'en-GB': concept.en,
      },
    };
  });

export const WORD_TRAIN_INSTALLED_CONTENT: InstalledCommunicationContent = {
  contentVersion: WORD_TRAIN_CONTENT_VERSION,
  images: SYLLABLE_TRAIN_WORDS.map((word) => ({ kind: 'url', value: word.image })),
};

export function requireSyllableTrainWord(conceptId: string): SyllableTrainWord {
  const word = SYLLABLE_TRAIN_WORDS.find((entry) => entry.conceptId === conceptId);
  if (!word) {
    throw new Error(`Unknown word-train concept: ${conceptId}`);
  }
  return word;
}

export function selectWordTrainLocale(settings: ToddlerSettings): SpeechLocale {
  return settings.languageMode === 'en' ? settings.englishVoiceLocale : 'he-IL';
}

export class WordTrainRoundLocaleLock {
  private roundId: string | null = null;
  private locale: SpeechLocale | null = null;

  forRound(roundId: string, settings: ToddlerSettings): SpeechLocale {
    if (this.roundId !== roundId || this.locale === null) {
      this.roundId = roundId;
      this.locale = selectWordTrainLocale(settings);
    }
    return this.locale;
  }
}
