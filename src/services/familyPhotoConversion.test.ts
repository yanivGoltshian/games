// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  FAMILY_PHOTO_MAX_LONG_SIDE,
  FAMILY_PHOTO_MAX_SOURCE_PIXELS,
  FAMILY_PHOTO_OUTPUT_MIME,
  FAMILY_PHOTO_OUTPUT_QUALITY,
  assertPrivateFamilyPhotoOutput,
  boundedFamilyPhotoSize,
  convertFamilyPhoto,
  type FamilyPhotoConversionEnvironment,
} from './familyPhotoConversion';
import type { FamilyPhotoPreflight } from './familyPhotoPreflight';

const CLEAN_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
const JPEG_WITH_EXIF = new Uint8Array([
  0xff, 0xd8,
  0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
  0xff, 0xda, 0x00, 0x02,
  0xff, 0xd9,
]);

function conversionEnvironment(
  width: number,
  height: number,
  output = CLEAN_JPEG,
): {
  environment: FamilyPhotoConversionEnvironment;
  dispose: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  encode: ReturnType<typeof vi.fn>;
  decode: ReturnType<typeof vi.fn>;
} {
  const dispose = vi.fn();
  const drawImage = vi.fn();
  const context = {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage,
  };
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    value: vi.fn(() => context),
  });
  const encode = vi.fn(async () => new Blob([output], { type: FAMILY_PHOTO_OUTPUT_MIME }));
  const preflight: FamilyPhotoPreflight = { format: 'jpeg', width, height };
  const decode = vi.fn(async () => ({
    source: document.createElement('img'),
    width,
    height,
    dispose,
  }));
  return {
    environment: {
      preflight: vi.fn(async () => preflight),
      decode,
      createCanvas: vi.fn((canvasWidth, canvasHeight) => {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        return canvas;
      }),
      encode,
    },
    dispose,
    drawImage,
    encode,
    decode,
  };
}

describe('familyPhotoConversion', () => {
  it('bounds the longest side while preserving orientation and aspect ratio', () => {
    expect(boundedFamilyPhotoSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(boundedFamilyPhotoSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(boundedFamilyPhotoSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('draws decoded pixels into a new JPEG and disposes the original source', async () => {
    const { environment, dispose, drawImage, encode, decode } = conversionEnvironment(4032, 3024);
    const source = new File([JPEG_WITH_EXIF], 'synthetic-with-exif.jpg', { type: 'image/jpeg' });

    const converted = await convertFamilyPhoto(source, environment);

    expect(converted).toMatchObject({
      width: FAMILY_PHOTO_MAX_LONG_SIDE,
      height: 1200,
      mimeType: FAMILY_PHOTO_OUTPUT_MIME,
    });
    expect(decode).toHaveBeenCalledWith(source, {
      preflight: { format: 'jpeg', width: 4032, height: 3024 },
      targetWidth: 1600,
      targetHeight: 1200,
    });
    expect(drawImage).toHaveBeenCalledWith(expect.any(HTMLImageElement), 0, 0, 1600, 1200);
    expect(encode).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      FAMILY_PHOTO_OUTPUT_MIME,
      FAMILY_PHOTO_OUTPUT_QUALITY,
    );
    expect(new Uint8Array(await converted.blob.arrayBuffer())).toEqual(CLEAN_JPEG);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('disposes decoded pixels when conversion fails', async () => {
    const { environment, dispose } = conversionEnvironment(100, 100, JPEG_WITH_EXIF);
    const source = new File(['pixels'], 'synthetic.jpg', { type: 'image/jpeg' });

    await expect(convertFamilyPhoto(source, environment)).rejects.toMatchObject({
      code: 'metadata-remained',
    });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('rejects unsupported files and decode failures explicitly', async () => {
    const unsupported = new File(['text'], 'notes.txt', { type: 'text/plain' });
    const { environment } = conversionEnvironment(100, 100);
    await expect(convertFamilyPhoto(unsupported, environment)).rejects.toMatchObject({
      code: 'unsupported-file',
    });
    expect(environment.decode).not.toHaveBeenCalled();

    const decodeFailureEnvironment = {
      ...environment,
      decode: vi.fn(async () => {
        throw new Error('synthetic decode failure');
      }),
    };
    await expect(convertFamilyPhoto(
      new File(['bad'], 'bad.jpg', { type: 'image/jpeg' }),
      decodeFailureEnvironment,
    )).rejects.toMatchObject({ code: 'decode-failed' });
  });

  it('rejects oversized sources before decoding', async () => {
    const source = new File(['small fixture'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(source, 'size', { value: 31 * 1024 * 1024 });
    const { environment } = conversionEnvironment(100, 100);

    await expect(convertFamilyPhoto(source, environment)).rejects.toMatchObject({
      code: 'file-too-large',
    });
    expect(environment.decode).not.toHaveBeenCalled();
  });

  it('rejects unsafe pixel dimensions before invoking the decode hook', async () => {
    const { environment } = conversionEnvironment(7000, 7001);
    const source = new File(['compressed'], 'oversized.jpg', { type: 'image/jpeg' });

    await expect(convertFamilyPhoto(source, environment)).rejects.toMatchObject({
      code: 'dimensions-too-large',
    });
    expect(7000 * 7001).toBeGreaterThan(FAMILY_PHOTO_MAX_SOURCE_PIXELS);
    expect(environment.decode).not.toHaveBeenCalled();
  });

  it('enforces the metadata-stripping output contract', async () => {
    await expect(assertPrivateFamilyPhotoOutput({
      blob: new Blob([JPEG_WITH_EXIF], { type: FAMILY_PHOTO_OUTPUT_MIME }),
      width: 100,
      height: 100,
      mimeType: FAMILY_PHOTO_OUTPUT_MIME,
    })).rejects.toMatchObject({
      code: 'metadata-remained',
    });
  });
});
