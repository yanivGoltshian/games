import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { RECORDED_NARRATION_VOICE_NAMES } from '../src/domain/narrationVoice.js';
import { buildSpeechSsml, readSpeechEnvironment } from './speechSsml.js';
import {
  createSpeechAuthorizationHeader,
  SpeechTokenProvider,
} from './speechAuthorization.js';
import {
  STORY_THAT_WAITS_AUDIO_FORMAT,
  STORY_THAT_WAITS_AUDIO_PACK_ID,
  STORY_THAT_WAITS_PACK_MANIFEST_PATH,
  STORY_THAT_WAITS_PRODUCTION_LEDGER_PATH,
  STORY_THAT_WAITS_SAMPLE_RATE,
  STORY_THAT_WAITS_SPRITES,
  collectStoryThatWaitsSpeechSources,
  storyThatWaitsSourceHash,
  unicodeCodePoints,
  type StoryThatWaitsPackManifest,
  type StoryThatWaitsSpeechSource,
} from './storyThatWaitsSpeechPack.js';

const BIT_RATE = '64k';
const GAP_SECONDS = 0.18;
const PLAYBACK_TAIL_SECONDS = 0.06;
const REQUEST_TIMEOUT_MS = 30_000;
const USER_AGENT = 'sean-learning-adventure-story-that-waits-audio-v1';
const JOURNAL_VERSION = 1;
const outputDirectory = resolve('public/speech');
const manifestPath = resolve(STORY_THAT_WAITS_PACK_MANIFEST_PATH);
const ledgerPath = resolve(STORY_THAT_WAITS_PRODUCTION_LEDGER_PATH);
const workDirectory = resolve(
  process.env.STORY_THAT_WAITS_AUDIO_WORK_DIR?.trim()
    || '.story-that-waits-v1-production',
);
const journalPath = join(workDirectory, 'journal.json');

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

interface JournalRequest {
  recordingKey: string;
  responseRequestId: string | null;
  responseRequestIdHeader: string | null;
  normalizedClipPath: string;
  normalizedClipSha256: string;
  duration: number;
}

interface ProductionJournal {
  version: typeof JOURNAL_VERSION;
  sourceHash: string;
  requests: Record<string, JournalRequest>;
}

interface SpriteResult {
  locale: StoryThatWaitsSpeechSource['locale'];
  stagedPath: string;
  publicPath: string;
  byteLength: number;
  duration: number;
  sha256: string;
}

function run(command: string, args: string[]): { stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function sha256(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
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
    || stream.sample_rate !== String(STORY_THAT_WAITS_SAMPLE_RATE)
    || stream.channels !== 1
    || !Number.isFinite(duration)
    || duration <= 0.1
  ) {
    throw new Error(`Invalid Story audio stream: ${path}`);
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
  const maximumVolume = analysis.match(/max_volume:\s+([-\w.]+)\s+dB/u)?.[1];
  if (!maximumVolume || maximumVolume === '-inf') {
    throw new Error(`Generated Story clip is silent: ${path}`);
  }
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporaryPath, path);
}

function loadJournal(sourceHash: string): ProductionJournal {
  if (!existsSync(journalPath)) {
    return {
      version: JOURNAL_VERSION,
      sourceHash,
      requests: {},
    };
  }
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as ProductionJournal;
  if (journal.version !== JOURNAL_VERSION || journal.sourceHash !== sourceHash) {
    throw new Error('Story audio journal belongs to a different source inventory.');
  }
  return journal;
}

function assertFinalOutputsAbsent(): void {
  const finalPaths = [
    manifestPath,
    ledgerPath,
    ...Object.values(STORY_THAT_WAITS_SPRITES).map((src) => (
      resolve('public', src.replace(/^\//u, ''))
    )),
  ];
  const existing = finalPaths.filter(existsSync);
  if (existing.length > 0) {
    throw new Error(
      `Immutable Story audio output already exists; refusing duplicate generation: ${existing.join(', ')}`,
    );
  }
}

function responseRequestId(response: Response): {
  requestId: string | null;
  header: string | null;
} {
  for (const header of ['x-requestid', 'x-microsoft-requestid', 'apim-request-id']) {
    const value = response.headers.get(header);
    if (value) {
      return { requestId: value, header };
    }
  }
  return { requestId: null, header: null };
}

async function synthesize(
  endpoint: string,
  resourceId: string,
  tokenProvider: SpeechTokenProvider,
  source: StoryThatWaitsSpeechSource,
): Promise<{ bytes: Uint8Array; requestId: string | null; header: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    const token = await tokenProvider.getAccessToken();
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: createSpeechAuthorizationHeader(resourceId, token.token),
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': STORY_THAT_WAITS_AUDIO_FORMAT,
        'User-Agent': USER_AGENT,
      },
      body: buildSpeechSsml(source.locale, source.synthesisText),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const request = responseRequestId(response);
  if (!response.ok) {
    throw new Error(
      `Azure Speech failed for ${source.recordingKey} with HTTP ${response.status}; request ID ${request.requestId ?? 'absent'}.`,
    );
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    requestId: request.requestId,
    header: request.header,
  };
}

async function produceClips(
  endpoint: string,
  resourceId: string,
  sourceHash: string,
  sources: readonly StoryThatWaitsSpeechSource[],
): Promise<ProductionJournal> {
  mkdirSync(workDirectory, { recursive: true });
  const journal = loadJournal(sourceHash);
  const tokenProvider = new SpeechTokenProvider();

  for (const [index, source] of sources.entries()) {
    const completed = journal.requests[source.recordingKey];
    if (completed) {
      if (
        !existsSync(completed.normalizedClipPath)
        || sha256File(completed.normalizedClipPath) !== completed.normalizedClipSha256
      ) {
        throw new Error(`Story audio journal clip is missing or changed: ${source.recordingKey}`);
      }
      continue;
    }

    const prefix = String(index).padStart(2, '0');
    const rawPath = join(workDirectory, `${prefix}-${source.locale}-azure.wav`);
    const normalizedPath = join(workDirectory, `${prefix}-${source.locale}.wav`);
    const result = await synthesize(endpoint, resourceId, tokenProvider, source);
    writeFileSync(rawPath, result.bytes);
    run('ffmpeg', [
      '-loglevel', 'error',
      '-y',
      '-i', rawPath,
      '-ar', String(STORY_THAT_WAITS_SAMPLE_RATE),
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      normalizedPath,
    ]);
    const duration = verifyAudio(normalizedPath, 'pcm_s16le');
    verifyAudible(normalizedPath);
    const request: JournalRequest = {
      recordingKey: source.recordingKey,
      responseRequestId: result.requestId,
      responseRequestIdHeader: result.header,
      normalizedClipPath: normalizedPath,
      normalizedClipSha256: sha256File(normalizedPath),
      duration,
    };
    journal.requests[source.recordingKey] = request;
    writeJsonAtomic(journalPath, journal);
    rmSync(rawPath, { force: true });
    console.log(`Synthesized ${index + 1}/48 ${source.recordingKey}`);
  }

  return journal;
}

function buildSprites(
  sources: readonly StoryThatWaitsSpeechSource[],
  journal: ProductionJournal,
  manifest: StoryThatWaitsPackManifest,
): SpriteResult[] {
  const silencePath = join(workDirectory, 'silence.wav');
  run('ffmpeg', [
    '-loglevel', 'error',
    '-y',
    '-f', 'lavfi',
    '-i', `anullsrc=r=${STORY_THAT_WAITS_SAMPLE_RATE}:cl=mono`,
    '-t', String(GAP_SECONDS),
    '-c:a', 'pcm_s16le',
    silencePath,
  ]);

  return (Object.keys(STORY_THAT_WAITS_SPRITES) as StoryThatWaitsSpeechSource['locale'][]).map(
    (locale) => {
      const localeSources = sources.filter((source) => source.locale === locale);
      const concatPaths: string[] = [];
      let offset = 0;
      for (const source of localeSources) {
        const clip = journal.requests[source.recordingKey];
        if (!clip) {
          throw new Error(`Missing completed Story audio request: ${source.recordingKey}`);
        }
        manifest.entries[source.manifestKey] = {
          src: STORY_THAT_WAITS_SPRITES[locale],
          offset: Number(offset.toFixed(6)),
          duration: Number((clip.duration + PLAYBACK_TAIL_SECONDS).toFixed(6)),
        };
        offset += clip.duration + GAP_SECONDS;
        concatPaths.push(clip.normalizedClipPath, silencePath);
      }

      const concatListPath = join(workDirectory, `concat-${locale}.txt`);
      writeFileSync(
        concatListPath,
        concatPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n'),
      );
      const publicPath = resolve('public', STORY_THAT_WAITS_SPRITES[locale].replace(/^\//u, ''));
      const stagedPath = join(workDirectory, basename(publicPath));
      run('ffmpeg', [
        '-loglevel', 'error',
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-ar', String(STORY_THAT_WAITS_SAMPLE_RATE),
        '-ac', '1',
        '-c:a', 'libmp3lame',
        '-b:a', BIT_RATE,
        stagedPath,
      ]);
      const duration = verifyAudio(stagedPath, 'mp3');
      verifyAudible(stagedPath);
      if (duration < offset - 0.02) {
        throw new Error(`Story sprite is shorter than its manifest timeline: ${locale}`);
      }
      return {
        locale,
        stagedPath,
        publicPath,
        byteLength: statSync(stagedPath).size,
        duration,
        sha256: sha256File(stagedPath),
      };
    },
  );
}

async function main(): Promise<void> {
  const sources = collectStoryThatWaitsSpeechSources();
  const sourceHash = storyThatWaitsSourceHash(sources);
  if (process.argv.includes('--preflight')) {
    console.log(JSON.stringify({
      packId: STORY_THAT_WAITS_AUDIO_PACK_ID,
      sourceHash,
      requestCount: sources.length,
      requestsByLocale: Object.fromEntries(
        Object.keys(STORY_THAT_WAITS_SPRITES).map((locale) => [
          locale,
          sources.filter((source) => source.locale === locale).length,
        ]),
      ),
    }, null, 2));
    return;
  }

  assertFinalOutputsAbsent();
  if (process.env.STORY_THAT_WAITS_AUDIO_CONFIRM !== sourceHash) {
    throw new Error(
      'STORY_THAT_WAITS_AUDIO_CONFIRM must exactly match the reviewed preflight source hash.',
    );
  }
  const sku = process.env.AZURE_SPEECH_SKU?.trim().toUpperCase();
  if (sku !== 'F0') {
    throw new Error('Story audio production is authorized only against the verified F0 Speech resource.');
  }
  const { resourceId, region } = readSpeechEnvironment();
  const resourceName = resourceId.split('/').at(-1);
  if (!resourceName) {
    throw new Error('Azure Speech resource ID has no resource name.');
  }
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const journal = await produceClips(endpoint, resourceId, sourceHash, sources);
  const manifest: StoryThatWaitsPackManifest = {
    version: 1,
    packId: STORY_THAT_WAITS_AUDIO_PACK_ID,
    sourceHash,
    voices: { ...RECORDED_NARRATION_VOICE_NAMES },
    entries: {},
  };
  const sprites = buildSprites(sources, journal, manifest);
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const sourceCommit = run('git', ['rev-parse', 'HEAD']).stdout;
  const requests = sources.map((source) => {
    const request = journal.requests[source.recordingKey];
    const clip = manifest.entries[source.manifestKey];
    if (!request || !clip) {
      throw new Error(`Story production ledger is incomplete: ${source.recordingKey}`);
    }
    return {
      recordingKey: source.recordingKey,
      manifestKey: source.manifestKey,
      locale: source.locale,
      storyId: source.storyId,
      pageId: source.pageId,
      lookupText: source.lookupText,
      submittedText: source.synthesisText,
      submittedCodePoints: unicodeCodePoints(source.synthesisText),
      submittedCharacterCount: Array.from(source.synthesisText).length,
      voice: source.voice,
      responseRequestId: request.responseRequestId,
      responseRequestIdHeader: request.responseRequestIdHeader,
      normalizedClipSha256: request.normalizedClipSha256,
      clipOffset: clip.offset,
      clipDuration: clip.duration,
    };
  });
  const ledger = {
    schemaVersion: 1,
    packId: STORY_THAT_WAITS_AUDIO_PACK_ID,
    generatedAt: new Date().toISOString(),
    sourceCommit,
    sourceHash,
    requestCount: requests.length,
    requestsByLocale: Object.fromEntries(
      Object.keys(STORY_THAT_WAITS_SPRITES).map((locale) => [
        locale,
        requests.filter((request) => request.locale === locale).length,
      ]),
    ),
    azure: {
      resourceName,
      region,
      sku,
      authentication: 'AzureCliCredential Microsoft Entra bearer token',
      outputFormat: STORY_THAT_WAITS_AUDIO_FORMAT,
      requestIdsAbsent: requests.filter((request) => request.responseRequestId === null).length,
    },
    billing: {
      currency: 'USD',
      billedCost: 0,
      basis: 'All successful synthesis requests used the verified Azure Speech F0 resource.',
      submittedCharacterCount: requests.reduce(
        (total, request) => total + request.submittedCharacterCount,
        0,
      ),
    },
    sprites: sprites.map((sprite) => ({
      locale: sprite.locale,
      path: STORY_THAT_WAITS_SPRITES[sprite.locale],
      byteLength: sprite.byteLength,
      duration: sprite.duration,
      sha256: sprite.sha256,
    })),
    manifest: {
      path: `/${STORY_THAT_WAITS_PACK_MANIFEST_PATH}`,
      sha256: sha256(manifestJson),
      entryCount: Object.keys(manifest.entries).length,
    },
    requests,
  };

  mkdirSync(outputDirectory, { recursive: true });
  for (const sprite of sprites) {
    mkdirSync(dirname(sprite.publicPath), { recursive: true });
    renameSync(sprite.stagedPath, sprite.publicPath);
  }
  writeFileSync(manifestPath, manifestJson);
  writeJsonAtomic(ledgerPath, ledger);
  rmSync(workDirectory, { recursive: true, force: true });
  console.log(`Generated immutable ${STORY_THAT_WAITS_AUDIO_PACK_ID} with 48 requests.`);
}

await main();
