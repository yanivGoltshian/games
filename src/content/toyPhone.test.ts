import { describe, expect, it } from 'vitest';
import { recordedSpeechManifestKey } from '../services/recordedSpeech';
import {
  TOY_PHONE_CALLER_IDS,
  TOY_PHONE_CONVERSATIONS,
  TOY_PHONE_LOCALES,
  TOY_PHONE_OBJECT_IDS,
  TOY_PHONE_RECORDING_INVENTORY,
  TOY_PHONE_SHELF_META,
  TOY_PHONE_TURN_IDS,
} from './toyPhone';

const COMPLETE_ENDING = /[.!?]$/u;
const FRAGMENT_MARKER = /(?:\.\.\.|…|\+|\$\{|<[^>]+>|\[[^\]]+\])/u;

describe('Toy Phone recording inventory', () => {
  it('contains exactly six templates and 18 complete utterances per exact locale', () => {
    expect(TOY_PHONE_RECORDING_INVENTORY).toHaveLength(54);
    for (const locale of TOY_PHONE_LOCALES) {
      expect(TOY_PHONE_CONVERSATIONS[locale]).toHaveLength(6);
      const entries = TOY_PHONE_RECORDING_INVENTORY.filter((entry) => entry.locale === locale);
      expect(entries).toHaveLength(18);
      expect(entries.filter((entry) => entry.turn === 'greeting')).toHaveLength(6);
      expect(entries.filter((entry) => entry.turn === 'request')).toHaveLength(6);
      expect(entries.filter((entry) => entry.turn === 'goodbye')).toHaveLength(6);
    }
  });

  it('uses only complete, bounded, nonempty sentences with no fragment construction markers', () => {
    for (const entry of TOY_PHONE_RECORDING_INVENTORY) {
      expect(entry.text.trim(), entry.recordingKey).toBe(entry.text);
      expect(entry.text.length, entry.recordingKey).toBeGreaterThan(2);
      expect(entry.text.length, entry.recordingKey).toBeLessThanOrEqual(64);
      expect(entry.text.split(/\s+/u).length, entry.recordingKey).toBeLessThanOrEqual(9);
      expect(entry.text, entry.recordingKey).toMatch(COMPLETE_ENDING);
      expect(entry.text, entry.recordingKey).not.toMatch(FRAGMENT_MARKER);
    }
  });

  it('keeps every exact locale recording key unique, including separate US and UK keys', () => {
    const keys = TOY_PHONE_RECORDING_INVENTORY.map((entry) => entry.recordingKey);
    expect(new Set(keys).size).toBe(54);
    for (const entry of TOY_PHONE_RECORDING_INVENTORY) {
      expect(entry.recordingKey).toBe(recordedSpeechManifestKey(entry.locale, entry.text));
    }

    const us = TOY_PHONE_RECORDING_INVENTORY.filter((entry) => entry.locale === 'en-US');
    const ukKeys = new Set(
      TOY_PHONE_RECORDING_INVENTORY
        .filter((entry) => entry.locale === 'en-GB')
        .map((entry) => entry.recordingKey),
    );
    for (const entry of us) {
      expect(ukKeys).not.toContain(entry.recordingKey);
    }
  });

  it('uses only the approved callers, objects, and three complete turn types', () => {
    const approvedCallers = new Set<string>(TOY_PHONE_CALLER_IDS);
    const approvedObjects = new Set<string>(TOY_PHONE_OBJECT_IDS);
    const approvedTurns = new Set<string>(TOY_PHONE_TURN_IDS);
    for (const entry of TOY_PHONE_RECORDING_INVENTORY) {
      expect(approvedCallers).toContain(entry.callerId);
      expect(approvedObjects).toContain(entry.objectId);
      expect(approvedTurns).toContain(entry.turn);
    }
  });

  it('locks the reviewed Hebrew wording and grammar exactly', () => {
    expect(TOY_PHONE_CONVERSATIONS['he-IL'].map((entry) => [
      entry.greeting.text,
      entry.request.text,
      entry.goodbye.text,
    ])).toEqual([
      ['שלום! אני הברווז.', 'אפשר להראות לי את הכדור?', 'תודה! להתראות!'],
      ['היי! אני הארנב.', 'אפשר להראות לי את התפוח?', 'תודה רבה! ביי ביי!'],
      ['שלום לך! אני החתול.', 'אפשר להראות לי את הבננה?', 'איזה יופי! להתראות!'],
      ['היי לך! אני הכלב.', 'אפשר להראות לי את האוטו?', 'תודה שעזרת לי! ביי ביי!'],
      ['שלום שלום! אני הפיל.', 'אפשר להראות לי את הנעל?', 'נהדר! נתראה בפעם הבאה!'],
      ['היי! אני הכלבלב, החבר שלך.', 'אפשר להראות לי את התפוז?', 'היה לי כיף! להתראות!'],
    ]);
  });

  it('keeps display-only Hebrew shelf metadata fully pointed without changing speech keys', () => {
    expect(TOY_PHONE_SHELF_META).toMatchObject({
      titleHe: 'טֵלֵפוֹן צַעֲצוּעַ',
      subtitleHe: 'עוֹנִים לַטֵּלֵפוֹן וּמַרְאִים מָה שֶׁהַחָבֵר מְבַקֵּשׁ',
    });
    expect(TOY_PHONE_RECORDING_INVENTORY.map((entry) => entry.text)).not.toContain(
      TOY_PHONE_SHELF_META.titleHe,
    );
  });
});
