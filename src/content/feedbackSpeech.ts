import type { LocalizedSpeechLine } from '../services/speech';

export function buildSortingMissModelLine(
  rule: 'color' | 'shape',
  labelHe: string,
  labelEn: string,
  cue: string,
): LocalizedSpeechLine {
  return rule === 'color'
    ? {
        he: `הצבע הוא ${labelHe}. שמים בסל ה${labelHe}.`,
        en: `The color is ${labelEn}. Put it in the ${labelEn} basket.`,
        pauseAfterMs: 220,
        cue,
      }
    : {
        he: `הצורה היא ${labelHe}. שמים בסל עם ${labelHe}.`,
        en: `The shape is a ${labelEn}. Put it in the basket with the ${labelEn}.`,
        pauseAfterMs: 220,
        cue,
      };
}

export function buildPuzzleMissModelLine(
  missCount: number,
  cue: string,
): LocalizedSpeechLine {
  return missCount >= 2
    ? {
        he: 'החתיכה מתאימה למקום המואר. נסה שם.',
        en: 'The piece fits in the glowing spot. Try there.',
        pauseAfterMs: 220,
        cue,
      }
    : {
        he: 'כמעט. נסה מקום אחר.',
        en: 'Almost. Try another spot.',
        pauseAfterMs: 220,
      };
}
