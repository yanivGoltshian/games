import type { LearningConcept, ToddlerSettings } from '../domain/types';
import type { SpeechSegment } from '../services/speech';
import type { WordStretchWord } from '../content/wordStretch';

export const WORD_STRETCH_CUE_PREFIX = 'word-stretch:';
export const WORD_STRETCH_PLAYBACK_RATE = 0.34;

function segment(
  text: string,
  recordedText: string,
  locale: SpeechSegment['locale'],
  word: WordStretchWord,
): SpeechSegment {
  return {
    text,
    recordedText,
    locale,
    cue: `${WORD_STRETCH_CUE_PREFIX}${word.conceptId}`,
    stretch: {
      leadSeconds: word.leadSeconds,
      playbackRate: WORD_STRETCH_PLAYBACK_RATE,
    },
  };
}

export function buildWordStretchSegments(
  word: WordStretchWord,
  concept: LearningConcept,
  settings: ToddlerSettings,
): SpeechSegment[] {
  const hebrew = segment(word.stretchedHe, concept.he, 'he-IL', word);
  const english = segment(
    word.stretchedEn,
    concept.en,
    settings.englishVoiceLocale,
    word,
  );

  if (settings.languageMode === 'en') {
    return [english];
  }
  if (settings.languageMode === 'bilingual') {
    return [{ ...hebrew, pauseAfterMs: 220 }, english];
  }
  return [hebrew];
}
