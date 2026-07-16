export const DOMAIN_KEYS = ['listening', 'counting', 'sorting', 'puzzle', 'memory', 'numberPairs'] as const;

export type DomainKey = (typeof DOMAIN_KEYS)[number];
export type LanguageMode = 'he' | 'en' | 'bilingual';
export type EnglishVoiceLocale = 'en-US' | 'en-GB';
export type SpeechLocale = 'he-IL' | EnglishVoiceLocale;
export type ColorId = 'red' | 'blue' | 'green' | 'yellow';
export type ShapeId = 'circle' | 'square' | 'triangle' | 'star';
export type SortingRule = 'color' | 'shape';

export interface ToddlerSettings {
  languageMode: LanguageMode;
  englishVoiceLocale: EnglishVoiceLocale;
  soundLevel: number;
  reducedMotion: boolean;
  quietMode: boolean;
}

export interface ConceptStat {
  attempts: number;
  successes: number;
  streak: number;
  mastery: number;
}

export type ProgressionChoice = 'next' | 'replay';

export interface RecentRoundResult {
  completedAt: number;
  level: 1 | 2 | 3;
  success: boolean;
  firstAttempt: boolean;
  attempts: number;
}

export interface DomainProgress {
  attempts: number;
  successes: number;
  streak: number;
  level: 1 | 2 | 3;
  highestLevel: 1 | 2 | 3;
  completedRounds: number;
  firstAttemptSuccesses: number;
  totalAttempts: number;
  mastery: number;
  stars: number;
  lastPracticedAt: number;
  lastProgressionChoice: ProgressionChoice | null;
  recentResults: RecentRoundResult[];
  concepts: Record<string, ConceptStat>;
}

export type DomainProgressMap = Record<DomainKey, DomainProgress>;

export interface AppProgress {
  version: number;
  updatedAt: number;
  totalStars: number;
  settings: ToddlerSettings;
  domains: DomainProgressMap;
}

export interface RecordedRound {
  attempts: number;
  requiredActions?: number;
  concepts: string[];
  success?: boolean;
}

export interface ProgressUpdateSummary {
  starsEarned: number;
  leveledUp: boolean;
  milestone: boolean;
  level: DomainProgress['level'];
  mastery: number;
  firstAttempt: boolean;
  recommendation: LevelRecommendation | null;
}

export interface LevelRecommendation {
  currentLevel: DomainProgress['level'];
  nextLevel: DomainProgress['level'];
}

export interface LearningConcept {
  id: string;
  category: 'animal' | 'object';
  he: string;
  en: string;
  /**
   * V1 service seam: when a stable content id has a matching recorded file
   * here, the speech service can prefer it over platform TTS without any
   * change to callers. See README for the audio-swap explanation.
   */
  audio?: Partial<Record<SpeechLocale, string>>;
}

export interface ListeningRound {
  targetId: string;
  optionIds: string[];
  promptHe: string;
  promptEn: string;
}

export interface CountingRound {
  targetCount: number;
  options: number[];
  countingConceptId: string;
  promptHe: string;
  promptEn: string;
  answerHe: string;
  answerEn: string;
}

export interface SortingItemDefinition {
  id: string;
  colorId: ColorId;
  shapeId: ShapeId;
  he: string;
  en: string;
}

export interface SortingBin {
  id: string;
  labelHe: string;
  labelEn: string;
  rule: SortingRule;
}

export interface SortingRound {
  rule: SortingRule;
  bins: SortingBin[];
  items: SortingItemDefinition[];
  promptHe: string;
  promptEn: string;
}

export interface PuzzleScene {
  id: string;
  titleHe: string;
  titleEn: string;
}

export interface PuzzlePieceRound {
  id: string;
  row: number;
  col: number;
}

export interface PuzzleRound {
  scene: PuzzleScene;
  rows: number;
  cols: number;
  pieces: PuzzlePieceRound[];
  promptHe: string;
  promptEn: string;
}

export interface MemoryCard {
  id: string;
  pairId: string;
  conceptId: string;
}

export interface MemoryRound {
  pairConceptIds: string[];
  cards: MemoryCard[];
  promptHe: string;
  promptEn: string;
}

export interface NumberPairsRound {
  selectedValues: number[];
  topRow: number[];
  bottomRow: number[];
  promptHe: string;
  promptEn: string;
  signature: string;
}
