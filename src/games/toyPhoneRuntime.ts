import type { SpeechLocale, ToddlerSettings } from '../domain/types';

export const TOY_PHONE_TUTORIAL_RING_MS = 650;
export const TOY_PHONE_TUTORIAL_ANSWER_MS = 450;
export const TOY_PHONE_IDLE_RING_MS = 600;
export const TOY_PHONE_ANSWERING_MS = 320;
export const TOY_PHONE_REWARD_MS = 850;
export const TOY_PHONE_REST_MS = 1_000;
export const TOY_PHONE_EFFORT_TARGET_MS = 300;
export const TOY_PHONE_TEMPLATE_COUNT = 6;

export function selectToyPhoneTemplateOffset(randomValue = Math.random()): number {
  const bounded = Number.isFinite(randomValue)
    ? Math.max(0, Math.min(0.999_999, randomValue))
    : 0;
  return Math.floor(bounded * TOY_PHONE_TEMPLATE_COUNT);
}

export function selectToyPhoneLocale(settings: ToddlerSettings): SpeechLocale {
  return settings.languageMode === 'en'
    ? settings.englishVoiceLocale
    : 'he-IL';
}
