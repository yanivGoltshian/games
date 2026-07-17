import { selectPraise, type PraiseTier } from '../content/praise';
import { personalizeChildName } from '../domain/childName';
import { buildPersonalizedPhraseSegments, type SpeechSegment } from '../services/speech';
import type { ToddlerSettings } from '../domain/types';

export interface PraiseSelection {
  segments: SpeechSegment[];
  /** Primary on-screen text: Hebrew unless the child is in English-only mode. */
  displayText: string;
}

/**
 * Builds the locale-aware praise line(s) for the success overlay. English
 * learning mode speaks/show English praise, Hebrew speaks/shows Hebrew, and
 * bilingual mode follows the same Hebrew-then-English order used for every
 * other prompt so the experience stays consistent.
 */
export function selectPraiseSegments(settings: ToddlerSettings, tier: PraiseTier, seed: string): PraiseSelection {
  const he = selectPraise('he', tier, seed);
  const en = selectPraise('en', tier, seed);
  const segments = buildPersonalizedPhraseSegments({
    he: he.text,
    en: en.text,
    ...(he.recordedFallbackText ? { recordedFallbackHe: he.recordedFallbackText } : {}),
    ...(en.recordedFallbackText ? { recordedFallbackEn: en.recordedFallbackText } : {}),
  }, settings);
  const displayText = settings.languageMode === 'en'
    ? personalizeChildName(en.text, settings.childName, 'en')
    : personalizeChildName(he.text, settings.childName, 'he');
  return { segments, displayText };
}
