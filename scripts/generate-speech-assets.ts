import type { AccessToken } from '@azure/identity';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { collectRecordedSpeechCatalog } from '../src/content/recordedSpeechCatalog.js';
import type { RecordedSpeechCatalogEntry } from '../src/content/recordedSpeechCatalog.js';
import type { SpeechLocale } from '../src/domain/types.js';
import { RECORDED_NARRATION_VOICE_NAMES } from '../src/domain/narrationVoice.js';
import {
  buildSpeechSsml,
  NEURAL_VOICES,
  readSpeechEnvironment,
} from './speechSsml.js';
import { SpeechTokenProvider } from './speechAuthorization.js';

const SAMPLE_RATE = 24_000;
const BIT_RATE = '64k';
const GAP_SECONDS = 0.18;
const PLAYBACK_TAIL_SECONDS = 0.06;
const SYNTHESIS_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 5;
const outputDirectory = resolve('public/speech');
const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);

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
  };
}

interface GeneratedClip {
  path: string;
  duration: number;
}

interface ExistingLocaleAssets {
  manifest: RecordedSpeechManifest;
  spritePath: string;
  regenerateMatch: string;
}

function run(command: string, args: string[]): { stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function probeAudio(path: string): AudioProbe {
  return JSON.parse(run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration',
    '-of', 'json',
    path,
  ]).stdout) as AudioProbe;
}

function verifyAudio(path: string, expectedCodec: string): number {
  const probe = probeAudio(path);
  const stream = probe.streams?.[0];
  const duration = Number(probe.format?.duration);

  if (
    stream?.codec_name !== expectedCodec
    || stream.sample_rate !== String(SAMPLE_RATE)
    || stream.channels !== 1
    || !Number.isFinite(duration)
    || duration <= 0.1
  ) {
    throw new Error(`Invalid generated audio stream: ${path}`);
  }

  return duration;
}

function verifyAudible(path: string): void {
  const analysis = run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i', path,
    '-af', 'volumedetect',
    '-f', 'null',
    '-',
  ]).stderr;
  const maximumVolume = analysis.match(/max_volume:\s+([-\w.]+)\s+dB/)?.[1];

  if (!maximumVolume || maximumVolume === '-inf') {
    throw new Error(`Generated clip is silent: ${path}`);
  }
}

function manifestKey(locale: SpeechLocale, text: string): string {
  return `${locale}\u0000${text}`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1_000, 15_000);
  }
  return Math.min(500 * (2 ** attempt), 8_000);
}

class SpeechAuthorizer {
  private readonly tokenProvider = new SpeechTokenProvider();
  private token: AccessToken | undefined;

  constructor(private readonly resourceId: string) {}

  async getAuthorizationHeader(): Promise<string> {
    this.token = await this.tokenProvider.getAccessToken();

    return `Bearer aad#${this.resourceId}#${this.token.token}`;
  }
}

async function synthesize(
  endpoint: string,
  authorizer: SpeechAuthorizer,
  locale: SpeechLocale,
  spokenText: string,
): Promise<Uint8Array> {
  const ssml = buildSpeechSsml(locale, spokenText);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: await authorizer.getAuthorizationHeader(),
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
          'User-Agent': 'sean-learning-adventure-speech-assets',
        },
        body: ssml,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      const retryable =
        error instanceof TypeError
        || (error instanceof Error && error.name === 'AbortError');
      if (!retryable || attempt === MAX_ATTEMPTS - 1) {
        throw error;
      }
      await delay(Math.min(500 * (2 ** attempt), 8_000));
      continue;
    }
    clearTimeout(timeout);

    if (response.ok) {
      return new Uint8Array(await response.arrayBuffer());
    }
    if (transientStatuses.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
      await delay(retryDelay(response, attempt));
      continue;
    }

    const requestId = response.headers.get('x-requestid') ?? 'unavailable';
    throw new Error(
      `Azure Speech synthesis failed with HTTP ${response.status} (${response.statusText}); request ID ${requestId}.`,
    );
  }

  throw new Error('Azure Speech synthesis exhausted all retry attempts.');
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index] as T, index);
      }
    },
  );
  await Promise.all(workers);
}

async function generateLocale(
  locale: SpeechLocale,
  entries: readonly RecordedSpeechCatalogEntry[],
  manifest: RecordedSpeechManifest,
  endpoint: string,
  authorizer: SpeechAuthorizer,
  existing?: ExistingLocaleAssets,
): Promise<void> {
  const tempDirectory = mkdtempSync(join(tmpdir(), `sean-speech-${locale}-`));

  try {
    const silencePath = join(tempDirectory, 'silence.wav');
    run('ffmpeg', [
      '-loglevel', 'error',
      '-y',
      '-f', 'lavfi',
      '-i', `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
      '-t', String(GAP_SECONDS),
      '-c:a', 'pcm_s16le',
      silencePath,
    ]);

    let existingPcmPath: string | undefined;
    if (existing) {
      existingPcmPath = join(tempDirectory, 'existing.wav');
      verifyAudio(existing.spritePath, 'mp3');
      run('ffmpeg', [
        '-loglevel', 'error',
        '-y',
        '-i', existing.spritePath,
        '-ar', String(SAMPLE_RATE),
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        existingPcmPath,
      ]);
      verifyAudio(existingPcmPath, 'pcm_s16le');
    }

    const clips = new Array<GeneratedClip>(entries.length);
    await mapWithConcurrency(
      entries,
      SYNTHESIS_CONCURRENCY,
      async (entry, index) => {
        const spokenText = entry.spokenText ?? entry.text;
        const prefix = String(index).padStart(3, '0');
        const responsePath = join(tempDirectory, `${prefix}-azure.wav`);
        const normalizedPath = join(tempDirectory, `${prefix}.wav`);
        const shouldRegenerate = !existing || entry.text.includes(existing.regenerateMatch);
        if (shouldRegenerate) {
          const audio = await synthesize(endpoint, authorizer, locale, spokenText);
          writeFileSync(responsePath, audio);
          run('ffmpeg', [
            '-loglevel', 'error',
            '-y',
            '-i', responsePath,
            '-ar', String(SAMPLE_RATE),
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            normalizedPath,
          ]);
        } else {
          const clip = existing.manifest.entries[manifestKey(locale, entry.text)];
          if (!clip || !existingPcmPath) {
            throw new Error(`Existing speech assets are missing ${locale}: ${entry.text}`);
          }
          const sourceDuration = clip.duration - PLAYBACK_TAIL_SECONDS;
          if (sourceDuration <= 0.1) {
            throw new Error(`Existing speech clip is too short to reuse: ${locale}: ${entry.text}`);
          }
          run('ffmpeg', [
            '-loglevel', 'error',
            '-y',
            '-ss', String(clip.offset),
            '-t', String(sourceDuration),
            '-i', existingPcmPath,
            '-ar', String(SAMPLE_RATE),
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            normalizedPath,
          ]);
        }
        const duration = verifyAudio(normalizedPath, 'pcm_s16le');
        verifyAudible(normalizedPath);
        clips[index] = { path: normalizedPath, duration };
      },
    );

    let offset = 0;
    const concatPaths: string[] = [];
    entries.forEach((entry, index) => {
      const clip = clips[index];
      if (!clip) {
        throw new Error(`Missing synthesized clip ${locale} index ${index}.`);
      }
      manifest.entries[manifestKey(locale, entry.text)] = {
        src: `/speech/${locale}.mp3`,
        offset: Number(offset.toFixed(6)),
        duration: Number((clip.duration + PLAYBACK_TAIL_SECONDS).toFixed(6)),
      };
      offset += clip.duration + GAP_SECONDS;
      concatPaths.push(clip.path, silencePath);
    });

    const concatListPath = join(tempDirectory, 'concat.txt');
    writeFileSync(
      concatListPath,
      concatPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n'),
    );
    const spritePath = join(outputDirectory, `${locale}.mp3`);
    run('ffmpeg', [
      '-loglevel', 'error',
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-ar', String(SAMPLE_RATE),
      '-ac', '1',
      '-c:a', 'libmp3lame',
      '-b:a', BIT_RATE,
      spritePath,
    ]);
    const spriteDuration = verifyAudio(spritePath, 'mp3');
    verifyAudible(spritePath);
    if (spriteDuration < offset - 0.02) {
      throw new Error(`Audio sprite is shorter than its manifest timeline: ${spritePath}`);
    }
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const { resourceId, region } = readSpeechEnvironment();
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const authorizer = new SpeechAuthorizer(resourceId);
  const catalog = collectRecordedSpeechCatalog();
  const grouped: Partial<Record<SpeechLocale, RecordedSpeechCatalogEntry[]>> = {};
  for (const entry of catalog) {
    (grouped[entry.locale] ??= []).push(entry);
  }
  const regenerateMatch = process.env.AZURE_SPEECH_REGENERATE_MATCH?.trim();
  let manifest: RecordedSpeechManifest = {
    version: 2,
    voices: { ...RECORDED_NARRATION_VOICE_NAMES },
    entries: {},
  };

  mkdirSync(outputDirectory, { recursive: true });
  if (regenerateMatch) {
    const manifestPath = join(outputDirectory, 'manifest.json');
    const existingManifest = JSON.parse(
      readFileSync(manifestPath, 'utf8'),
    ) as RecordedSpeechManifest;
    const locale: SpeechLocale = 'he-IL';
    const localeEntries = grouped[locale] ?? [];
    const selectedEntries = localeEntries.filter((entry) => entry.text.includes(regenerateMatch));
    if (selectedEntries.length === 0) {
      throw new Error(`No Hebrew speech entries match: ${regenerateMatch}`);
    }
    manifest = {
      version: 2,
      voices: { ...RECORDED_NARRATION_VOICE_NAMES },
      entries: { ...existingManifest.entries },
    };
    console.log(
      `Regenerating ${selectedEntries.length} matching ${locale} clips with ${NEURAL_VOICES[locale].name}`,
    );
    await generateLocale(locale, localeEntries, manifest, endpoint, authorizer, {
      manifest: existingManifest,
      spritePath: join(outputDirectory, `${locale}.mp3`),
      regenerateMatch,
    });
  } else {
    for (const locale of Object.keys(NEURAL_VOICES) as SpeechLocale[]) {
      const localeEntries = grouped[locale] ?? [];
      console.log(
        `Generating ${localeEntries.length} ${locale} clips with ${NEURAL_VOICES[locale].name}`,
      );
      await generateLocale(locale, localeEntries, manifest, endpoint, authorizer);
    }
  }
  writeFileSync(
    join(outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  if (regenerateMatch) {
    console.log(
      `Rebuilt the he-IL sprite and preserved ${catalog.length} manifest clips.`,
    );
  } else {
    console.log(
      `Generated ${catalog.length} clips across ${Object.keys(NEURAL_VOICES).length} audio sprites.`,
    );
  }
}

await main();
