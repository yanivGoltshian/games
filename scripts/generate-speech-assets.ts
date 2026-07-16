import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { collectRecordedSpeechCatalog } from '../src/content/recordedSpeechCatalog';
import type { RecordedSpeechCatalogEntry } from '../src/content/recordedSpeechCatalog';
import type { SpeechLocale } from '../src/domain/types';

const SAMPLE_RATE = 24_000;
const BIT_RATE = '64k';
const GAP_SECONDS = 0.12;
const outputDirectory = resolve('public/speech');

const voices: Record<SpeechLocale, { name: string; rate: number }> = {
  'he-IL': { name: 'Carmit', rate: 135 },
  'en-US': { name: 'Samantha', rate: 145 },
  'en-GB': { name: 'Daniel', rate: 145 },
};

interface ManifestClip {
  src: string;
  offset: number;
  duration: number;
}

interface RecordedSpeechManifest {
  version: number;
  entries: Record<string, ManifestClip>;
}

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function durationOf(path: string): number {
  return Number(run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1',
    path,
  ]));
}

function manifestKey(locale: SpeechLocale, text: string): string {
  return `${locale}\u0000${text}`;
}

function generateLocale(
  locale: SpeechLocale,
  entries: readonly RecordedSpeechCatalogEntry[],
  manifest: RecordedSpeechManifest,
): void {
  const tempDirectory = mkdtempSync(join(tmpdir(), `sean-speech-${locale}-`));
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

  let offset = 0;
  const concatPaths: string[] = [];
  const voice = voices[locale];
  entries.forEach((entry, index) => {
    // Synthesize from the pointed pronunciation when present so `say` vowelizes
    // Hebrew correctly, but key the manifest by the unpointed source text so the
    // runtime lookup (which uses unpointed text) still resolves.
    const spokenText = entry.spokenText ?? entry.text;
    const prefix = String(index).padStart(3, '0');
    const aiffPath = join(tempDirectory, `${prefix}.aiff`);
    const wavPath = join(tempDirectory, `${prefix}.wav`);
    run('say', ['-v', voice.name, '-r', String(voice.rate), '-o', aiffPath, spokenText]);
    run('ffmpeg', [
      '-loglevel', 'error',
      '-y',
      '-i', aiffPath,
      '-ar', String(SAMPLE_RATE),
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      wavPath,
    ]);

    const duration = durationOf(wavPath);
    manifest.entries[manifestKey(locale, entry.text)] = {
      src: `/speech/${locale}.mp3`,
      offset: Number(offset.toFixed(6)),
      duration: Number(duration.toFixed(6)),
    };
    offset += duration + GAP_SECONDS;
    concatPaths.push(wavPath, silencePath);
  });

  const concatListPath = join(tempDirectory, 'concat.txt');
  writeFileSync(
    concatListPath,
    concatPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n'),
  );
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
    join(outputDirectory, `${locale}.mp3`),
  ]);
  rmSync(tempDirectory, { recursive: true, force: true });
}

const catalog = collectRecordedSpeechCatalog();
const grouped = Object.groupBy(catalog, (entry) => entry.locale);
const manifest: RecordedSpeechManifest = { version: 1, entries: {} };

mkdirSync(outputDirectory, { recursive: true });
for (const locale of Object.keys(voices) as SpeechLocale[]) {
  const localeEntries = grouped[locale] ?? [];
  console.log(`Generating ${localeEntries.length} ${locale} clips with ${voices[locale].name}`);
  generateLocale(locale, localeEntries, manifest);
}
writeFileSync(
  join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`Generated ${catalog.length} clips across ${Object.keys(voices).length} audio sprites.`);
