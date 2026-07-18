import type { SpeechLocale } from '../domain/types';
import { recordedSpeechManifestKey } from '../services/recordedSpeech';

export const TOY_PHONE_CONTENT_VERSION = 'toy-phone-v1';
export const TOY_PHONE_LOCALES = ['he-IL', 'en-US', 'en-GB'] as const satisfies readonly SpeechLocale[];
export const TOY_PHONE_CALLER_IDS = ['duck', 'rabbit', 'cat', 'dog', 'elephant', 'mascot'] as const;
export const TOY_PHONE_OBJECT_IDS = ['ball', 'apple', 'banana', 'car', 'shoe', 'orange'] as const;
export const TOY_PHONE_TURN_IDS = ['greeting', 'request', 'goodbye'] as const;

export const TOY_PHONE_SHELF_META = {
  titleHe: 'טֵלֵפוֹן צַעֲצוּעַ',
  subtitleHe: 'עוֹנִים לַטֵּלֵפוֹן וּמַרְאִים מָה שֶׁהַחָבֵר מְבַקֵּשׁ',
  titleEn: 'Toy Phone',
  subtitleEn: 'Answer the phone and show what your friend asks for',
} as const;

export type ToyPhoneCallerId = (typeof TOY_PHONE_CALLER_IDS)[number];
export type ToyPhoneObjectId = (typeof TOY_PHONE_OBJECT_IDS)[number];
export type ToyPhoneTurnId = (typeof TOY_PHONE_TURN_IDS)[number];

export interface ToyPhoneUtterance {
  turn: ToyPhoneTurnId;
  text: string;
  /**
   * Exact recorded-speech manifest key. Locale is part of the key, so natural
   * US and UK wording still requires separate reviewed recordings.
   */
  recordingKey: string;
}

export interface ToyPhoneConversation {
  id: string;
  locale: SpeechLocale;
  callerId: ToyPhoneCallerId;
  objectId: ToyPhoneObjectId;
  greeting: ToyPhoneUtterance;
  request: ToyPhoneUtterance;
  goodbye: ToyPhoneUtterance;
}

function utterance(
  locale: SpeechLocale,
  turn: ToyPhoneTurnId,
  text: string,
): ToyPhoneUtterance {
  return {
    turn,
    text,
    recordingKey: recordedSpeechManifestKey(locale, text),
  };
}

function conversation(
  locale: SpeechLocale,
  id: string,
  callerId: ToyPhoneCallerId,
  objectId: ToyPhoneObjectId,
  greeting: string,
  request: string,
  goodbye: string,
): ToyPhoneConversation {
  return {
    id,
    locale,
    callerId,
    objectId,
    greeting: utterance(locale, 'greeting', greeting),
    request: utterance(locale, 'request', request),
    goodbye: utterance(locale, 'goodbye', goodbye),
  };
}

/**
 * Human-review and recording inventory for Toy Phone.
 *
 * Every entry is one complete, natural sentence or short complete social
 * utterance. Runtime playback uses exactly one entry at a time and never joins
 * fragments. The recorded speech catalog includes this inventory only as one
 * reviewed 54-clip pack so no locale or conversation can ship partially.
 */
export const TOY_PHONE_CONVERSATIONS = {
  'he-IL': [
    conversation('he-IL', 'duck-ball', 'duck', 'ball',
      'שלום! אני הברווז.',
      'אפשר להראות לי את הכדור?',
      'תודה! להתראות!'),
    conversation('he-IL', 'rabbit-apple', 'rabbit', 'apple',
      'היי! אני הארנב.',
      'אפשר להראות לי את התפוח?',
      'תודה רבה! ביי ביי!'),
    conversation('he-IL', 'cat-banana', 'cat', 'banana',
      'שלום לך! אני החתול.',
      'אפשר להראות לי את הבננה?',
      'איזה יופי! להתראות!'),
    conversation('he-IL', 'dog-car', 'dog', 'car',
      'היי לך! אני הכלב.',
      'אפשר להראות לי את האוטו?',
      'תודה שעזרת לי! ביי ביי!'),
    conversation('he-IL', 'elephant-shoe', 'elephant', 'shoe',
      'שלום שלום! אני הפיל.',
      'אפשר להראות לי את הנעל?',
      'נהדר! נתראה בפעם הבאה!'),
    conversation('he-IL', 'mascot-orange', 'mascot', 'orange',
      'היי! אני הכלבלב, החבר שלך.',
      'אפשר להראות לי את התפוז?',
      'היה לי כיף! להתראות!'),
  ],
  'en-US': [
    conversation('en-US', 'duck-ball', 'duck', 'ball',
      "Hello! I'm the duck.",
      'Can you show me the ball?',
      'Thank you! Bye-bye!'),
    conversation('en-US', 'rabbit-apple', 'rabbit', 'apple',
      "Hi! I'm the rabbit.",
      'Will you show me the apple?',
      'Thanks a lot! See you!'),
    conversation('en-US', 'cat-banana', 'cat', 'banana',
      "Hello there! I'm the cat.",
      'Can I see the banana?',
      'That was lovely! Goodbye!'),
    conversation('en-US', 'dog-car', 'dog', 'car',
      "Hi there! I'm the dog.",
      'Will you show me the car?',
      'Thanks for helping me! Bye!'),
    conversation('en-US', 'elephant-shoe', 'elephant', 'shoe',
      "Hello, hello! I'm the elephant.",
      'Can I see the shoe?',
      'Wonderful! See you next time!'),
    conversation('en-US', 'mascot-orange', 'mascot', 'orange',
      "Hi! I'm your puppy friend.",
      'Can you show me the orange?',
      'That was fun! Goodbye!'),
  ],
  'en-GB': [
    conversation('en-GB', 'duck-ball', 'duck', 'ball',
      "Hello! I'm the duck.",
      'Can you show me the ball?',
      'Thank you! Bye-bye!'),
    conversation('en-GB', 'rabbit-apple', 'rabbit', 'apple',
      "Hi! I'm the rabbit.",
      'Will you show me the apple?',
      'Thanks a lot! See you!'),
    conversation('en-GB', 'cat-banana', 'cat', 'banana',
      "Hello there! I'm the cat.",
      'Can I see the banana?',
      'That was lovely! Goodbye!'),
    conversation('en-GB', 'dog-car', 'dog', 'car',
      "Hi there! I'm the dog.",
      'Will you show me the car?',
      'Thanks for helping me! Bye!'),
    conversation('en-GB', 'elephant-shoe', 'elephant', 'shoe',
      "Hello, hello! I'm the elephant.",
      'Can I see the shoe?',
      'Wonderful! See you next time!'),
    conversation('en-GB', 'mascot-orange', 'mascot', 'orange',
      "Hi! I'm your puppy friend.",
      'Can you show me the orange?',
      'That was fun! Goodbye!'),
  ],
} as const satisfies Readonly<Record<SpeechLocale, readonly ToyPhoneConversation[]>>;

export interface ToyPhoneRecordingInventoryEntry {
  locale: SpeechLocale;
  conversationId: string;
  callerId: ToyPhoneCallerId;
  objectId: ToyPhoneObjectId;
  turn: ToyPhoneTurnId;
  text: string;
  recordingKey: string;
}

export const TOY_PHONE_RECORDING_INVENTORY: readonly ToyPhoneRecordingInventoryEntry[] =
  TOY_PHONE_LOCALES.flatMap((locale) => (
    TOY_PHONE_CONVERSATIONS[locale].flatMap((entry) => (
      TOY_PHONE_TURN_IDS.map((turn) => ({
        locale,
        conversationId: entry.id,
        callerId: entry.callerId,
        objectId: entry.objectId,
        turn,
        text: entry[turn].text,
        recordingKey: entry[turn].recordingKey,
      }))
    ))
  ));

export function getToyPhoneConversation(
  locale: SpeechLocale,
  index: number,
): ToyPhoneConversation {
  const conversations = TOY_PHONE_CONVERSATIONS[locale];
  const safeIndex = Number.isFinite(index)
    ? Math.abs(Math.trunc(index)) % conversations.length
    : 0;
  return conversations[safeIndex]!;
}

export function getToyPhoneRecordingTexts(locale: SpeechLocale): string[] {
  return TOY_PHONE_RECORDING_INVENTORY
    .filter((entry) => entry.locale === locale)
    .map((entry) => entry.text);
}
