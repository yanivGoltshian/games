import type { EnglishVoiceLocale, SpeechLocale, ToddlerSettings } from './types';

export type NarrationVoiceClassification = 'child' | 'adult';

export interface NarrationVoiceProfile {
  azureName: string;
  classification: NarrationVoiceClassification;
  webSpeechNameHints: readonly string[];
  parentLabel: string;
}

export const DEFAULT_ENGLISH_VOICE_LOCALE: EnglishVoiceLocale = 'en-US';

export const NARRATION_VOICE_PROFILES: Readonly<Record<SpeechLocale, NarrationVoiceProfile>> = {
  'he-IL': {
    azureName: 'he-IL-HilaNeural',
    classification: 'adult',
    webSpeechNameHints: ['hila', 'carmit', 'carmel'],
    parentLabel: 'עברית: Hila, קול נשי מאושר',
  },
  'en-US': {
    azureName: 'en-US-AnaNeural',
    classification: 'child',
    webSpeechNameHints: ['ana', 'samantha', 'ava', 'allison', 'susan'],
    parentLabel: 'English (US): Ana, child voice',
  },
  'en-GB': {
    azureName: 'en-GB-MaisieNeural',
    classification: 'child',
    webSpeechNameHints: ['maisie', 'daniel', 'serena', 'martha'],
    parentLabel: 'English (UK): Maisie, child voice',
  },
};

export const RECORDED_NARRATION_VOICE_NAMES: Readonly<Record<SpeechLocale, string>> = {
  'he-IL': NARRATION_VOICE_PROFILES['he-IL'].azureName,
  'en-US': NARRATION_VOICE_PROFILES['en-US'].azureName,
  'en-GB': NARRATION_VOICE_PROFILES['en-GB'].azureName,
};

export function englishNarrationVoiceForSettings(
  settings: Pick<ToddlerSettings, 'englishVoiceLocale'>,
): NarrationVoiceProfile {
  return NARRATION_VOICE_PROFILES[settings.englishVoiceLocale];
}
