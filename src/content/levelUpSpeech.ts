export interface LevelUpSpeechLine {
  he: string;
  en: string;
  recordedFallbackHe?: string;
  recordedFallbackEn?: string;
}

export const LEVEL_UP_SPEECH: readonly LevelUpSpeechLine[] = [
  { he: 'עברת שלב!', en: 'You moved up a level!' },
  {
    he: 'כל הכבוד, שון!',
    en: 'Great job, Sean!',
    recordedFallbackHe: 'עברת שלב!',
    recordedFallbackEn: 'You moved up a level!',
  },
  { he: 'זכית בגביע!', en: 'You won a trophy!' },
];

export const MORE_NUMBERS_SPEECH: LevelUpSpeechLine = {
  he: 'עכשיו יותר מספרים',
  en: 'Now more numbers',
};
