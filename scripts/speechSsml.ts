import type { SpeechLocale } from '../src/domain/types.js';

export interface SpeechEnvironment {
  resourceId: string;
  region: string;
}

export interface NeuralVoice {
  name: string;
  rate: string;
  pitch: string;
}

export const NEURAL_VOICES: Readonly<Record<SpeechLocale, NeuralVoice>> = {
  'he-IL': {
    name: 'he-IL-HilaNeural',
    rate: '-8%',
    pitch: '+3%',
  },
  'en-US': {
    name: 'en-US-AnaNeural',
    rate: '-8%',
    pitch: '+3%',
  },
  'en-GB': {
    name: 'en-GB-MaisieNeural',
    rate: '-8%',
    pitch: '+3%',
  },
};

const SPEECH_RESOURCE_ID_PATTERN =
  /^\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.CognitiveServices\/accounts\/[^/]+$/i;
const SPEECH_REGION_PATTERN = /^[a-z0-9]+$/;

const punctuationPauses = new Map<string, number>([
  [',', 120],
  [';', 160],
  [':', 160],
  ['.', 240],
  ['!', 240],
  ['?', 260],
]);

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function addNaturalPauses(text: string): string {
  const chunks: string[] = [];
  let cursor = 0;

  for (const match of text.matchAll(/[,;:.!?]/g)) {
    const punctuationIndex = match.index;
    const punctuation = match[0];
    chunks.push(escapeXml(text.slice(cursor, punctuationIndex + punctuation.length)));
    chunks.push(`<break time="${punctuationPauses.get(punctuation)}ms"/>`);
    cursor = punctuationIndex + punctuation.length;
  }

  chunks.push(escapeXml(text.slice(cursor)));
  return chunks.join('');
}

export function buildSpeechSsml(locale: SpeechLocale, spokenText: string): string {
  const voice = NEURAL_VOICES[locale];
  const speech = addNaturalPauses(spokenText.normalize('NFC'));

  return [
    `<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis">`,
    `<voice name="${voice.name}">`,
    `<prosody rate="${voice.rate}" pitch="${voice.pitch}">`,
    speech,
    '<break time="100ms"/>',
    '</prosody>',
    '</voice>',
    '</speak>',
  ].join('');
}

export function readSpeechEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): SpeechEnvironment {
  const resourceId = environment.AZURE_SPEECH_RESOURCE_ID?.trim().replace(/\/+$/, '');
  const region = environment.AZURE_SPEECH_REGION?.trim().toLowerCase();

  if (!resourceId || !SPEECH_RESOURCE_ID_PATTERN.test(resourceId)) {
    throw new Error(
      'AZURE_SPEECH_RESOURCE_ID must be a Cognitive Services account resource ID.',
    );
  }
  if (!region || !SPEECH_REGION_PATTERN.test(region)) {
    throw new Error('AZURE_SPEECH_REGION must be an Azure region name such as swedencentral.');
  }

  return { resourceId, region };
}
