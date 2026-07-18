import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  STORY_THAT_WAITS_AUDIO_PACK_ID,
  STORY_THAT_WAITS_PACK_MANIFEST_PATH,
  STORY_THAT_WAITS_PRODUCTION_LEDGER_PATH,
  STORY_THAT_WAITS_SAMPLE_RATE,
  STORY_THAT_WAITS_SPRITES,
  collectStoryThatWaitsSpeechSources,
  storyThatWaitsSourceHash,
  unicodeCodePoints,
  type StoryThatWaitsPackManifest,
} from './storyThatWaitsSpeechPack.js';

const BYTES_PER_SAMPLE = 2;
const MINIMUM_PEAK = 128;
const MAXIMUM_TAIL_RMS = 350;
const TAIL_SECONDS = 0.04;

interface AudioProbe {
  streams?: Array<{
    codec_name?: string;
    sample_rate?: string;
    channels?: number;
  }>;
  format?: {
    duration?: string;
  };
}

interface LedgerRequest {
  recordingKey: string;
  manifestKey: string;
  locale: string;
  lookupText: string;
  submittedText: string;
  submittedCodePoints: string[];
  submittedCharacterCount: number;
  voice: string;
  responseRequestId: string | null;
  responseRequestIdHeader: string | null;
  normalizedClipSha256: string;
  clipOffset: number;
  clipDuration: number;
}

interface ProductionLedger {
  schemaVersion: number;
  packId: string;
  sourceHash: string;
  requestCount: number;
  requestsByLocale: Record<string, number>;
  azure: {
    sku: string;
    outputFormat: string;
    requestIdsAbsent: number;
  };
  billing: {
    currency: string;
    billedCost: number;
    submittedCharacterCount: number;
  };
  sprites: Array<{
    locale: keyof typeof STORY_THAT_WAITS_SPRITES;
    path: string;
    byteLength: number;
    duration: number;
    sha256: string;
  }>;
  manifest: {
    sha256: string;
    entryCount: number;
  };
  requests: LedgerRequest[];
}

function run(command: string, args: string[], encoding: BufferEncoding | null = 'utf8'): Buffer | string {
  const result = spawnSync(command, args, {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : result.stderr;
    const stdout = Buffer.isBuffer(result.stdout)
      ? result.stdout.toString('utf8')
      : result.stdout;
    throw new Error(`${command} failed: ${stderr || stdout}`);
  }
  return result.stdout;
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function probeSprite(path: string): number {
  const output = run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration',
    '-of', 'json',
    path,
  ]);
  const probe = JSON.parse(String(output)) as AudioProbe;
  const stream = probe.streams?.[0];
  const duration = Number(probe.format?.duration);
  if (
    stream?.codec_name !== 'mp3'
    || stream.sample_rate !== String(STORY_THAT_WAITS_SAMPLE_RATE)
    || stream.channels !== 1
    || !Number.isFinite(duration)
    || duration <= 0
  ) {
    throw new Error(`Invalid immutable Story sprite: ${path}`);
  }
  return duration;
}

function decodeSprite(path: string): Buffer {
  const output = run('ffmpeg', [
    '-loglevel', 'error',
    '-i', path,
    '-ar', String(STORY_THAT_WAITS_SAMPLE_RATE),
    '-ac', '1',
    '-f', 's16le',
    '-c:a', 'pcm_s16le',
    '-',
  ], null);
  if (!Buffer.isBuffer(output)) {
    throw new Error(`Unable to decode Story sprite: ${path}`);
  }
  return output;
}

function verifyClip(
  key: string,
  offset: number,
  duration: number,
  pcm: Buffer,
  spriteDuration: number,
): void {
  if (
    !Number.isFinite(offset)
    || !Number.isFinite(duration)
    || offset < 0
    || duration <= 0.1
    || offset + duration > spriteDuration + 0.02
  ) {
    throw new Error(`Invalid Story manifest boundary for ${key}.`);
  }
  const start = Math.round(offset * STORY_THAT_WAITS_SAMPLE_RATE);
  const end = Math.round((offset + duration) * STORY_THAT_WAITS_SAMPLE_RATE);
  const tailStart = Math.max(
    start,
    end - Math.round(TAIL_SECONDS * STORY_THAT_WAITS_SAMPLE_RATE),
  );
  if (end * BYTES_PER_SAMPLE > pcm.length) {
    throw new Error(`Story manifest clip exceeds decoded sprite for ${key}.`);
  }

  let peak = 0;
  let tailSumSquares = 0;
  let tailSamples = 0;
  for (let sample = start; sample < end; sample += 1) {
    const value = Math.abs(pcm.readInt16LE(sample * BYTES_PER_SAMPLE));
    peak = Math.max(peak, value);
    if (sample >= tailStart) {
      tailSumSquares += value * value;
      tailSamples += 1;
    }
  }
  const tailRms = Math.sqrt(tailSumSquares / Math.max(tailSamples, 1));
  if (peak < MINIMUM_PEAK) {
    throw new Error(`Story manifest clip is silent for ${key}.`);
  }
  if (tailRms > MAXIMUM_TAIL_RMS) {
    throw new Error(`Story manifest clip has no quiet tail for ${key}.`);
  }
}

const sources = collectStoryThatWaitsSpeechSources();
const sourceHash = storyThatWaitsSourceHash(sources);
const manifestBytes = readFileSync(resolve(STORY_THAT_WAITS_PACK_MANIFEST_PATH));
const manifest = JSON.parse(manifestBytes.toString('utf8')) as StoryThatWaitsPackManifest;
const ledger = JSON.parse(
  readFileSync(resolve(STORY_THAT_WAITS_PRODUCTION_LEDGER_PATH), 'utf8'),
) as ProductionLedger;

if (
  manifest.version !== 1
  || manifest.packId !== STORY_THAT_WAITS_AUDIO_PACK_ID
  || manifest.sourceHash !== sourceHash
  || ledger.schemaVersion !== 1
  || ledger.packId !== STORY_THAT_WAITS_AUDIO_PACK_ID
  || ledger.sourceHash !== sourceHash
  || ledger.requestCount !== 48
  || ledger.requests.length !== 48
  || ledger.manifest.entryCount !== 48
) {
  throw new Error('Story pack metadata does not match the approved 48-source inventory.');
}

const expectedManifestKeys = sources.map((source) => source.manifestKey).sort();
const actualManifestKeys = Object.keys(manifest.entries).sort();
if (
  expectedManifestKeys.length !== actualManifestKeys.length
  || expectedManifestKeys.some((key, index) => key !== actualManifestKeys[index])
) {
  throw new Error('Story pack manifest keys do not exactly match the approved inventory.');
}
if (
  createHash('sha256').update(manifestBytes).digest('hex') !== ledger.manifest.sha256
  || ledger.azure.sku !== 'F0'
  || ledger.billing.currency !== 'USD'
  || ledger.billing.billedCost !== 0
) {
  throw new Error('Story pack ledger hash or F0 billing record is invalid.');
}

const ledgerByRecordingKey = new Map(
  ledger.requests.map((request) => [request.recordingKey, request]),
);
if (ledgerByRecordingKey.size !== 48) {
  throw new Error('Story production ledger contains duplicate stable recording keys.');
}

for (const source of sources) {
  const request = ledgerByRecordingKey.get(source.recordingKey);
  const clip = manifest.entries[source.manifestKey];
  if (
    !request
    || !clip
    || request.manifestKey !== source.manifestKey
    || request.locale !== source.locale
    || request.lookupText !== source.lookupText
    || request.submittedText !== source.synthesisText
    || request.voice !== source.voice
    || request.submittedCharacterCount !== Array.from(source.synthesisText).length
    || request.submittedCodePoints.join(' ') !== unicodeCodePoints(source.synthesisText).join(' ')
    || request.clipOffset !== clip.offset
    || request.clipDuration !== clip.duration
    || clip.src !== STORY_THAT_WAITS_SPRITES[source.locale]
  ) {
    throw new Error(`Story production ledger mismatch for ${source.recordingKey}.`);
  }
}

const submittedCharacters = ledger.requests.reduce(
  (total, request) => total + request.submittedCharacterCount,
  0,
);
if (
  ledger.billing.submittedCharacterCount !== submittedCharacters
  || ledger.azure.requestIdsAbsent !== ledger.requests.filter(
    (request) => request.responseRequestId === null,
  ).length
) {
  throw new Error('Story production ledger request accounting is invalid.');
}

for (const sprite of ledger.sprites) {
  const expectedPath = STORY_THAT_WAITS_SPRITES[sprite.locale];
  const path = resolve('public', expectedPath.replace(/^\//u, ''));
  const duration = probeSprite(path);
  if (
    sprite.path !== expectedPath
    || statSync(path).size !== sprite.byteLength
    || sha256File(path) !== sprite.sha256
    || Math.abs(duration - sprite.duration) > 0.000_001
  ) {
    throw new Error(`Story sprite ledger mismatch for ${sprite.locale}.`);
  }
  const pcm = decodeSprite(path);
  const localeSources = sources.filter((source) => source.locale === sprite.locale);
  for (const source of localeSources) {
    const clip = manifest.entries[source.manifestKey];
    if (!clip) {
      throw new Error(`Story sprite is missing ${source.manifestKey}.`);
    }
    verifyClip(source.manifestKey, clip.offset, clip.duration, pcm, duration);
  }
  console.log(`Validated 16 ${sprite.locale} Story clips in ${duration.toFixed(3)} seconds.`);
}

console.log('Validated immutable Story That Waits audio pack: 48 clips, 3 dedicated sprites.');
