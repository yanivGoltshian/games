import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectRecordedSpeechCatalog } from '../src/content/recordedSpeechCatalog.js';
import type { SpeechLocale } from '../src/domain/types.js';
import { RECORDED_NARRATION_VOICE_NAMES } from '../src/domain/narrationVoice.js';

const SAMPLE_RATE = 24_000;
const BYTES_PER_SAMPLE = 2;
const MINIMUM_PEAK = 128;
const MAXIMUM_TAIL_RMS = 350;
const TAIL_SECONDS = 0.04;
const speechDirectory = resolve('public/speech');
const SPRITE_BOUNDARY_TOLERANCE_SECONDS = 0.02;
const CONTAINER_DURATION_TOLERANCE_SECONDS = 0.08;
const EXPECTED_SPRITES = {
  '/speech/he-IL.mp3': {
    count: 490,
    bytes: 9_994_221,
    sha256: '988bfaf69ce7ee9ef0ef6a5992b5c0c660fa80782ba78a3191894aa75233f7a2',
  },
  '/speech/en-US.mp3': {
    count: 490,
    bytes: 9_698_925,
    sha256: 'b9869f1f7fcaa7bd44394be6cba310c3e2cbf2f2ccf6f08f3a47cfcf3cbce089',
  },
  '/speech/en-GB.mp3': {
    count: 490,
    bytes: 9_036_525,
    sha256: '0cab2bba2b6db842c20c80a749d5ad7de6f7babb6aadadeb65a0536fcff38113',
  },
} as const;

interface ManifestClip {
  src: string;
  offset: number;
  duration: number;
}

interface RecordedSpeechManifest {
  version: number;
  voices: Record<SpeechLocale, string>;
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
    size?: string;
  };
}

interface SpriteProbe {
  duration: number;
  size: number;
}

interface Mp3InfoHeader {
  bytes: number;
  duration: number;
  frameCount: number;
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

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
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

function probeSprite(path: string): SpriteProbe {
  const probe = JSON.parse(runText('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration,size',
    '-of', 'json',
    path,
  ])) as AudioProbe;
  const stream = probe.streams?.[0];
  const duration = Number(probe.format?.duration);
  const size = Number(probe.format?.size);

  if (
    stream?.codec_name !== 'mp3'
    || stream.sample_rate !== String(SAMPLE_RATE)
    || stream.channels !== 1
    || !Number.isFinite(duration)
    || duration <= 0
    || !Number.isFinite(size)
    || size <= 0
  ) {
    throw new Error(`Invalid audio sprite format: ${path}`);
  }
  return { duration, size };
}

function syncSafeSize(buffer: Buffer, offset: number): number {
  return (
    (buffer[offset]! << 21)
    | (buffer[offset + 1]! << 14)
    | (buffer[offset + 2]! << 7)
    | buffer[offset + 3]!
  );
}

function id3v2Size(buffer: Buffer): number {
  if (buffer.subarray(0, 3).toString('ascii') !== 'ID3') {
    return 0;
  }
  const footerSize = (buffer[5]! & 0x10) === 0x10 ? 10 : 0;
  return 10 + syncSafeSize(buffer, 6) + footerSize;
}

function mpegSampleRate(versionBits: number, sampleRateIndex: number): number {
  const baseRates = [44_100, 48_000, 32_000] as const;
  const base = baseRates[sampleRateIndex];
  if (!base) {
    throw new Error('Invalid MP3 sample-rate index.');
  }
  if (versionBits === 3) {
    return base;
  }
  if (versionBits === 2) {
    return base / 2;
  }
  if (versionBits === 0) {
    return base / 4;
  }
  throw new Error('Invalid MP3 version.');
}

function parseMp3InfoHeader(path: string, buffer: Buffer): Mp3InfoHeader {
  const id3Size = id3v2Size(buffer);
  const frameStart = id3Size;
  if (
    frameStart + 4 >= buffer.length
    || buffer[frameStart] !== 0xff
    || (buffer[frameStart + 1]! & 0xe0) !== 0xe0
  ) {
    throw new Error(`MP3 sprite is missing an initial frame header: ${path}`);
  }

  const versionBits = (buffer[frameStart + 1]! >> 3) & 0x03;
  const layerBits = (buffer[frameStart + 1]! >> 1) & 0x03;
  const bitrateIndex = (buffer[frameStart + 2]! >> 4) & 0x0f;
  const sampleRateIndex = (buffer[frameStart + 2]! >> 2) & 0x03;
  const channelMode = (buffer[frameStart + 3]! >> 6) & 0x03;
  if (layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 0x0f) {
    throw new Error(`Invalid MP3 layer or bitrate in ${path}`);
  }

  const sampleRate = mpegSampleRate(versionBits, sampleRateIndex);
  const samplesPerFrame = versionBits === 3 ? 1152 : 576;
  const sideInfoBytes = versionBits === 3
    ? (channelMode === 3 ? 17 : 32)
    : (channelMode === 3 ? 9 : 17);
  const infoOffset = frameStart + 4 + sideInfoBytes;
  const tag = buffer.subarray(infoOffset, infoOffset + 4).toString('ascii');
  if (tag !== 'Info' && tag !== 'Xing') {
    throw new Error(`MP3 sprite is missing an Info/Xing frame: ${path}`);
  }

  const flags = buffer.readUInt32BE(infoOffset + 4);
  let cursor = infoOffset + 8;
  let frameCount: number | undefined;
  let bytes: number | undefined;
  if ((flags & 0x01) === 0x01) {
    frameCount = buffer.readUInt32BE(cursor);
    cursor += 4;
  }
  if ((flags & 0x02) === 0x02) {
    bytes = buffer.readUInt32BE(cursor);
  }
  if (!frameCount || !bytes) {
    throw new Error(`MP3 Info/Xing frame is missing frame or byte counts: ${path}`);
  }
  const expectedBytes = buffer.length - id3Size;
  if (bytes !== expectedBytes) {
    throw new Error(`MP3 Info/Xing byte count mismatch for ${path}: ${bytes} !== ${expectedBytes}`);
  }

  return {
    bytes,
    frameCount,
    duration: frameCount * samplesPerFrame / sampleRate,
  };
}

function afinfoDuration(path: string): number | undefined {
  if (process.platform !== 'darwin') {
    return undefined;
  }
  const output = runText('afinfo', [path]);
  const duration = Number(output.match(/estimated duration:\s*([0-9.]+) sec/)?.[1]);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`afinfo did not report a valid duration for ${path}`);
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
    || clip.offset + clip.duration > spriteDuration + SPRITE_BOUNDARY_TOLERANCE_SECONDS
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
const locales = ['he-IL', 'en-US', 'en-GB'] as const satisfies readonly SpeechLocale[];
if (
  manifest.version !== 2
  || locales.some((locale) => (
    manifest.voices?.[locale] !== RECORDED_NARRATION_VOICE_NAMES[locale]
  ))
) {
  throw new Error('Speech manifest does not identify the approved narration voices.');
}
const expectedKeys = catalog.map(({ locale, text }) => `${locale}\u0000${text}`).sort();
const actualKeys = Object.keys(manifest.entries).sort();

if (
  expectedKeys.length !== actualKeys.length
  || expectedKeys.some((key, index) => key !== actualKeys[index])
) {
  throw new Error('Speech manifest keys do not exactly match the recorded speech catalog.');
}

const sprites = new Map<string, Array<[string, ManifestClip]>>();
for (const [key, clip] of Object.entries(manifest.entries)) {
  (sprites.get(clip.src) ?? sprites.set(clip.src, []).get(clip.src)!).push([key, clip]);
}
const expectedSpriteEntries = Object.entries(EXPECTED_SPRITES);
if (
  sprites.size !== expectedSpriteEntries.length
  || expectedSpriteEntries.some(([src, expected]) => sprites.get(src)?.length !== expected.count)
) {
  throw new Error('Speech manifest does not use the expected immutable sprite set.');
}

for (const [src, entries] of expectedSpriteEntries.map(([spriteSrc]) => (
  [spriteSrc, sprites.get(spriteSrc)!] as const
))) {
  const spritePath = resolve(`public${src}`);
  const encoded = readFileSync(spritePath);
  const expected = EXPECTED_SPRITES[src as keyof typeof EXPECTED_SPRITES];
  if (encoded.length !== expected.bytes || sha256(encoded) !== expected.sha256) {
    throw new Error(`Speech sprite bytes changed unexpectedly: ${src}`);
  }

  const ffprobe = probeSprite(spritePath);
  if (ffprobe.size !== encoded.length) {
    throw new Error(`ffprobe size mismatch for ${src}.`);
  }
  const mp3Info = parseMp3InfoHeader(spritePath, encoded);
  if (Math.abs(mp3Info.duration - ffprobe.duration) > CONTAINER_DURATION_TOLERANCE_SECONDS) {
    throw new Error(`MP3 Info/Xing duration disagrees with ffprobe for ${src}.`);
  }
  const afinfo = afinfoDuration(spritePath);
  if (
    afinfo !== undefined
    && Math.abs(afinfo - ffprobe.duration) > CONTAINER_DURATION_TOLERANCE_SECONDS
  ) {
    throw new Error(`afinfo duration disagrees with ffprobe for ${src}.`);
  }

  const pcm = decodeSprite(spritePath);
  const decodedDuration = pcm.length / BYTES_PER_SAMPLE / SAMPLE_RATE;
  if (!Number.isFinite(decodedDuration) || decodedDuration <= 0) {
    throw new Error(`Invalid decoded audio duration: ${spritePath}`);
  }
  const containerDuration = Math.min(ffprobe.duration, afinfo ?? ffprobe.duration);
  const maxManifestEnd = Math.max(...entries.map(([, clip]) => clip.offset + clip.duration));
  if (
    maxManifestEnd > decodedDuration + SPRITE_BOUNDARY_TOLERANCE_SECONDS
    || maxManifestEnd > containerDuration + SPRITE_BOUNDARY_TOLERANCE_SECONDS
  ) {
    throw new Error(`Manifest clips exceed browser-compatible sprite duration: ${src}`);
  }

  const orderedEntries = [...entries].sort(([, left], [, right]) => left.offset - right.offset);
  let previousEnd = -Infinity;
  for (const [key, clip] of orderedEntries) {
    if (clip.offset + 0.005 < previousEnd) {
      throw new Error(`Manifest clips overlap in ${src}: ${key}`);
    }
    previousEnd = clip.offset + clip.duration;
    verifyClip(key, clip, pcm, decodedDuration);
  }
  console.log(
    `Validated ${orderedEntries.length} clips in ${src} `
    + `(ffprobe ${ffprobe.duration.toFixed(6)}s, decoded ${decodedDuration.toFixed(6)}s).`,
  );
}

console.log(`Validated ${actualKeys.length} manifest clips and three 24 kHz mono sprites.`);
