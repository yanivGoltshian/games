import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PngMetadata {
  width: number;
  height: number;
  colorType: number;
  hasTransparencyChunk: boolean;
}

interface WebManifest {
  background_color: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;
}

function readPngMetadata(path: string): PngMetadata {
  const png = readFileSync(resolve(path));
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const chunks: string[] = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    chunks.push(type);
    offset += length + 12;
    if (type === 'IEND') {
      break;
    }
  }
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png[25]!,
    hasTransparencyChunk: chunks.includes('tRNS'),
  };
}

describe('official application icon assets', () => {
  it.each([
    ['public/favicon-32.png', 32],
    ['public/icons/apple-touch-icon.png', 180],
    ['public/icons/icon-192.png', 192],
    ['public/icons/icon-512.png', 512],
  ])('provides an opaque square PNG at %s', (path, size) => {
    expect(readPngMetadata(path)).toEqual({
      width: size,
      height: size,
      colorType: 2,
      hasTransparencyChunk: false,
    });
  });

  it('wires every icon surface to the new assets and offline cache', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('public/manifest.webmanifest'), 'utf8'),
    ) as WebManifest;
    const html = readFileSync(resolve('index.html'), 'utf8');
    const serviceWorker = readFileSync(resolve('public/sw.js'), 'utf8');

    expect(manifest.background_color).toBe('#f4f0ea');
    expect(manifest.icons.every((icon) => icon.type === 'image/png')).toBe(true);
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', purpose: 'any maskable' }),
      expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', purpose: 'any maskable' }),
      expect.objectContaining({ src: '/icons/apple-touch-icon.png', sizes: '180x180' }),
    ]));
    expect(html).toContain('href="/favicon-32.png"');
    expect(html).toContain('href="/icons/apple-touch-icon.png"');
    expect(serviceWorker).toContain("sean-learning-adventure-v24");
    expect(existsSync(resolve('public/favicon.svg'))).toBe(false);
    expect(existsSync(resolve('public/icons/icon.svg'))).toBe(false);
    expect(html).not.toContain('/favicon.svg');
    expect(manifest.icons.some((icon) => icon.src.endsWith('.svg'))).toBe(false);
    expect(serviceWorker).not.toContain('/favicon.svg');
    expect(serviceWorker).not.toContain('/icons/icon.svg');
    for (const path of [
      '/favicon-32.png',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/apple-touch-icon.png',
    ]) {
      expect(serviceWorker).toContain(`'${path}'`);
    }
  });
});
