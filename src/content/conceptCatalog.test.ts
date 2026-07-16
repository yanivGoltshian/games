import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  conceptPuzzleScenes,
  learningConcepts,
  type LearningConceptId,
} from './concepts';
import {
  getHebrewPronunciationSkeleton,
  hasNiqqud,
  stripNiqqud,
} from './hebrewPronunciation';

const NEW_CONCEPT_IDS = [
  'duck',
  'rabbit',
  'elephant',
  'strawberry',
  'orange',
  'carrot',
  'cup',
  'spoon',
  'chair',
  'bus',
  'train',
  'airplane',
  'flower',
  'tree',
] as const satisfies readonly LearningConceptId[];

function webpDimensions(buffer: Buffer): { width: number; height: number } {
  expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(buffer.subarray(8, 12).toString('ascii')).toBe('WEBP');
  expect(buffer.subarray(12, 16).toString('ascii')).toBe('VP8 ');
  expect(buffer.subarray(23, 26)).toEqual(Buffer.from([0x9d, 0x01, 0x2a]));
  return {
    width: buffer.readUInt16LE(26) & 0x3fff,
    height: buffer.readUInt16LE(28) & 0x3fff,
  };
}

describe('authoritative learning concept catalog', () => {
  it('keeps stable unique ids and exactly the approved expansion concepts', () => {
    const ids = learningConcepts.map((concept) => concept.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(21);
    expect(ids).toEqual(expect.arrayContaining([...NEW_CONCEPT_IDS]));
  });

  it('keeps visual Hebrew unpointed and every spoken Hebrew label fully pointed', () => {
    for (const concept of learningConcepts) {
      expect(concept.he).not.toBe('');
      expect(concept.en).not.toBe('');
      expect(concept.category).not.toBe('');
      expect(hasNiqqud(concept.he), concept.id).toBe(false);
      expect(hasNiqqud(concept.spokenHe), concept.id).toBe(true);
      expect(stripNiqqud(concept.spokenHe).normalize('NFC'))
        .toBe(getHebrewPronunciationSkeleton(concept.he));
      expect(concept.spokenHe).toBe(concept.spokenHe.normalize('NFC'));
    }
  });

  it('keeps complete gender, singular, plural, and counted-noun metadata', () => {
    for (const concept of learningConcepts.filter((item) => item.quantity !== null)) {
      const quantity = concept.quantity;
      expect(quantity.he.singular).toBe(concept.he);
      expect(quantity.he.singularSpoken).toBe(concept.spokenHe);
      expect(['masculine', 'feminine']).toContain(quantity.he.gender);
      expect(quantity.he.plural).not.toBe('');
      expect(quantity.he.countedPlural).not.toBe('');
      expect(quantity.en.singular).toBe(concept.en);
      expect(quantity.en.plural).not.toBe('');
      expect(stripNiqqud(quantity.he.pluralSpoken))
        .toBe(getHebrewPronunciationSkeleton(quantity.he.plural));
      expect(stripNiqqud(quantity.he.countedPluralSpoken))
        .toBe(getHebrewPronunciationSkeleton(quantity.he.countedPlural));
    }
  });

  it('maps every concept to one local opaque 900x900 WebP asset', () => {
    const expectedFiles = learningConcepts.map((concept) => basename(concept.image)).sort();
    const actualFiles = readdirSync(resolve('public/assets/vocabulary'))
      .filter((name) => name.endsWith('.webp'))
      .sort();
    expect(actualFiles).toEqual(expectedFiles);

    for (const concept of learningConcepts) {
      const path = resolve('public', concept.image.slice(1));
      const stats = statSync(path);
      const buffer = readFileSync(path);
      expect(stats.size).toBeGreaterThan(5_000);
      expect(stats.size).toBeLessThan(250_000);
      expect(webpDimensions(buffer)).toEqual({ width: 900, height: 900 });
    }
  });

  it('makes every approved new concept countable and available as an object puzzle', () => {
    const newConcepts = learningConcepts.filter(
      (concept): concept is typeof concept & { id: (typeof NEW_CONCEPT_IDS)[number] } => (
        NEW_CONCEPT_IDS.includes(concept.id as (typeof NEW_CONCEPT_IDS)[number])
      ),
    );
    expect(newConcepts).toHaveLength(NEW_CONCEPT_IDS.length);
    expect(newConcepts.every((concept) => concept.quantity !== null)).toBe(true);
    expect(newConcepts.every((concept) => concept.puzzle)).toBe(true);
    expect(conceptPuzzleScenes.map((scene) => scene.image.kind === 'concept' && scene.image.conceptId).sort())
      .toEqual([...NEW_CONCEPT_IDS].sort());
  });
});
