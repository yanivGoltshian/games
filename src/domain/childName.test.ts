import { describe, expect, it } from 'vitest';
import {
  CHILD_NAME_MAX_LENGTH,
  DEFAULT_CHILD_NAME,
  childGreeting,
  childNameForLanguage,
  normalizeChildName,
  personalizeChildName,
} from './childName';

describe('child name personalization', () => {
  it('defaults blank and non-string values to the Hebrew canonical name', () => {
    expect(normalizeChildName('   ')).toBe(DEFAULT_CHILD_NAME);
    expect(normalizeChildName(null)).toBe(DEFAULT_CHILD_NAME);
  });

  it('trims surrounding whitespace while preserving Unicode and internal words', () => {
    expect(normalizeChildName(' \tנוֹעָה   לִי\n')).toBe('נוֹעָה לִי');
    expect(normalizeChildName('  María José  ')).toBe('María José');
    expect(Array.from(normalizeChildName('🙂'.repeat(CHILD_NAME_MAX_LENGTH + 5)))).toHaveLength(
      CHILD_NAME_MAX_LENGTH,
    );
  });

  it('uses the English product default only for the canonical default name', () => {
    expect(childNameForLanguage(DEFAULT_CHILD_NAME, 'en')).toBe('Sean');
    expect(childGreeting(DEFAULT_CHILD_NAME, 'he')).toBe('שלום שון');
    expect(childGreeting(DEFAULT_CHILD_NAME, 'en')).toBe('Hello Sean');
    expect(childGreeting('נועה', 'en')).toBe('Hello נועה');
  });

  it('uses a configured name verbatim in Hebrew and English copy', () => {
    expect(personalizeChildName('כל הכבוד, שון!', '李 小龙', 'he')).toBe('כל הכבוד, 李 小龙!');
    expect(personalizeChildName('Great job, Sean!', '李 小龙', 'en')).toBe('Great job, 李 小龙!');
  });
});
