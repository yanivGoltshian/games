import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectRecordedSpeechCatalog } from '../src/content/recordedSpeechCatalog.js';
import type { SpeechLocale } from '../src/domain/types.js';

const SAMPLE_RATE = 24_000;
const BYTES_PER_SAMPLE = 2;
const MINIMUM_PEAK = 128;
const MAXIMUM_TAIL_RMS = 350;
const TAIL_SECONDS = 0.04;
const speechDirectory = resolve('public/speech');

interface ManifestClip {
  src: string;
  offset: number;
  duration: number;
}

interface RecordedSpeechManifest {
  version: number;
  entries: Record<string, ManifestClip>;
}

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

function runText(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function decodeSprite(path: string): Buffer {
  const result = spawnSync('ffmpeg', [
    '-loglevel', 'error',
    '-i', path,
    '-ar', String(SAMPLE_RATE),
    '-ac', '1',
    '-f', 's16le',
    '-c:a', 'pcm_s16le',
    '-',
  ], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed to decode ${path}: ${result.stderr.toString('utf8')}`);
  }
  return result.stdout;
}

function probeSprite(path: string): number {
  const probe = JSON.parse(runText('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration',
    '-of', 'json',
    path,
  ])) as AudioProbe;
  const stream = probe.streams?.[0];
  const duration = Number(probe.format?.duration);

  if (
    stream?.codec_name !== 'mp3'
    || stream.sample_rate !== String(SAMPLE_RATE)
    || stream.channels !== 1
    || !Number.isFinite(duration)
    || duration <= 0
  ) {
    throw new Error(`Invalid audio sprite format: ${path}`);
  }
  return duration;
}

function sampleBounds(clip: ManifestClip): { start: number; end: number; tailStart: number } {
  const start = Math.round(clip.offset * SAMPLE_RATE);
  const end = Math.round((clip.offset + clip.duration) * SAMPLE_RATE);
  const tailStart = Math.max(start, end - Math.round(TAIL_SECONDS * SAMPLE_RATE));
  return { start, end, tailStart };
}

function verifyClip(
  key: string,
  clip: ManifestClip,
  pcm: Buffer,
  spriteDuration: number,
): void {
  if (
    !Number.isFinite(clip.offset)
    || !Number.isFinite(clip.duration)
    || clip.offset < 0
    || clip.duration <= 0.1
    || clip.offset + clip.duration > spriteDuration + 0.02
  ) {
    throw new Error(`Invalid manifest boundary for ${key}.`);
  }

  const { start, end, tailStart } = sampleBounds(clip);
  if (end * BYTES_PER_SAMPLE > pcm.length) {
    throw new Error(`Manifest clip exceeds decoded sprite for ${key}.`);
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
    throw new Error(`Manifest clip is silent for ${key}.`);
  }
  if (tailRms > MAXIMUM_TAIL_RMS) {
    throw new Error(`Manifest clip has no quiet tail and may be cut off for ${key}.`);
  }
}

const manifest = JSON.parse(
  readFileSync(resolve(speechDirectory, 'manifest.json'), 'utf8'),
) as RecordedSpeechManifest;
const catalog = collectRecordedSpeechCatalog();
const expectedKeys = catalog.map(({ locale, text }) => `${locale}\u0000${text}`).sort();
const actualKeys = Object.keys(manifest.entries).sort();

if (
  expectedKeys.length !== actualKeys.length
  || expectedKeys.some((key, index) => key !== actualKeys[index])
) {
  throw new Error('Speech manifest keys do not exactly match the recorded speech catalog.');
}

for (const locale of ['he-IL', 'en-US', 'en-GB'] as const satisfies readonly SpeechLocale[]) {
  const spritePath = resolve(speechDirectory, `${locale}.mp3`);
  const spriteDuration = probeSprite(spritePath);
  const pcm = decodeSprite(spritePath);
  const localeEntries = Object.entries(manifest.entries)
    .filter(([key]) => key.startsWith(`${locale}\u0000`));

  for (const [key, clip] of localeEntries) {
    if (clip.src !== `/speech/${locale}.mp3`) {
      throw new Error(`Manifest clip uses the wrong sprite for ${key}.`);
    }
    verifyClip(key, clip, pcm, spriteDuration);
  }
  console.log(`Validated ${localeEntries.length} ${locale} clips.`);
}

console.log(`Validated ${actualKeys.length} manifest clips and three 24 kHz mono sprites.`);
