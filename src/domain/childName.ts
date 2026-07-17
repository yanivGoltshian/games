import type { LanguageMode } from './types';

export const DEFAULT_CHILD_NAME = 'שון';
export const DEFAULT_CHILD_NAME_EN = 'Sean';
export const CHILD_NAME_MAX_LENGTH = 40;

const INTERNAL_WHITESPACE = /\s+/gu;

export function normalizeChildName(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_CHILD_NAME;
  }

  const normalized = value.trim().replace(INTERNAL_WHITESPACE, ' ');
  if (!normalized) {
    return DEFAULT_CHILD_NAME;
  }
  return Array.from(normalized).slice(0, CHILD_NAME_MAX_LENGTH).join('');
}

export function isDefaultChildName(childName: string): boolean {
  return normalizeChildName(childName) === DEFAULT_CHILD_NAME;
}

export function childNameForLanguage(childName: string, language: 'he' | 'en'): string {
  const normalized = normalizeChildName(childName);
  return language === 'en' && isDefaultChildName(normalized)
    ? DEFAULT_CHILD_NAME_EN
    : normalized;
}

export function personalizeChildName(
  text: string,
  childName: string,
  language: 'he' | 'en',
): string {
  const name = childNameForLanguage(childName, language);
  const defaultName = language === 'he' ? DEFAULT_CHILD_NAME : DEFAULT_CHILD_NAME_EN;
  return text.split(defaultName).join(name);
}

export function childGreeting(childName: string, languageMode: LanguageMode): string {
  return languageMode === 'en'
    ? `Hello ${childNameForLanguage(childName, 'en')}`
    : `שלום ${childNameForLanguage(childName, 'he')}`;
}
