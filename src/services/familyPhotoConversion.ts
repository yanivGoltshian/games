import {
  preflightFamilyPhoto,
  type FamilyPhotoPreflight,
} from './familyPhotoPreflight';

export const FAMILY_PHOTO_MAX_LONG_SIDE = 1600;
export const FAMILY_PHOTO_MAX_SOURCE_BYTES = 30 * 1024 * 1024;
export const FAMILY_PHOTO_MAX_SOURCE_PIXELS = 49_000_000;
export const FAMILY_PHOTO_MAX_SOURCE_DIMENSION = 8192;
export const FAMILY_PHOTO_OUTPUT_MIME = 'image/jpeg' as const;
export const FAMILY_PHOTO_OUTPUT_QUALITY = 0.88;

const FAMILY_PHOTO_MAX_FULL_DECODE_PIXELS = 16_000_000;

export type FamilyPhotoConversionErrorCode =
  | 'unsupported-file'
  | 'file-too-large'
  | 'dimensions-too-large'
  | 'decode-failed'
  | 'invalid-dimensions'
  | 'canvas-failed'
  | 'encode-failed'
  | 'metadata-remained';

export class FamilyPhotoConversionError extends Error {
  readonly code: FamilyPhotoConversionErrorCode;

  constructor(code: FamilyPhotoConversionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FamilyPhotoConversionError';
    this.code = code;
  }
}

export interface ConvertedFamilyPhoto {
  blob: Blob;
  width: number;
  height: number;
  mimeType: typeof FAMILY_PHOTO_OUTPUT_MIME;
}

interface DecodedFamilyPhoto {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

export interface FamilyPhotoDecodeRequest {
  preflight: FamilyPhotoPreflight;
  targetWidth: number;
  targetHeight: number;
}

export interface FamilyPhotoConversionEnvironment {
  preflight: (file: File) => Promise<FamilyPhotoPreflight | null>;
  decode: (file: File, request: FamilyPhotoDecodeRequest) => Promise<DecodedFamilyPhoto>;
  createCanvas: (width: number, height: number) => HTMLCanvasElement;
  encode: (
    canvas: HTMLCanvasElement,
    mimeType: typeof FAMILY_PHOTO_OUTPUT_MIME,
    quality: number,
  ) => Promise<Blob>;
}

function conversionError(
  code: FamilyPhotoConversionErrorCode,
  message: string,
  cause?: unknown,
): FamilyPhotoConversionError {
  return new FamilyPhotoConversionError(code, message, cause === undefined ? undefined : { cause });
}

async function decodeWithImageElement(
  file: File,
  request: FamilyPhotoDecodeRequest,
  downsampleError?: unknown,
): Promise<DecodedFamilyPhoto> {
  const sourcePixels = request.preflight.width * request.preflight.height;
  if (sourcePixels > FAMILY_PHOTO_MAX_FULL_DECODE_PIXELS) {
    throw conversionError(
      'dimensions-too-large',
      'This image requires safe downsampling that is unavailable on this device.',
      downsampleError,
    );
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';

  try {
    // Current iPad Safari applies EXIF orientation while decoding into the image's
    // natural pixel dimensions. Drawing those pixels creates a correctly oriented
    // image without carrying the source container or its metadata forward.
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(conversionError('decode-failed', 'The selected image could not be decoded.'));
      image.src = objectUrl;
    });
  } catch (error) {
    image.removeAttribute('src');
    URL.revokeObjectURL(objectUrl);
    throw error;
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => {
      image.removeAttribute('src');
      URL.revokeObjectURL(objectUrl);
    },
  };
}

async function decodeWithBrowser(
  file: File,
  request: FamilyPhotoDecodeRequest,
): Promise<DecodedFamilyPhoto> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
        resizeHeight: request.targetHeight,
        resizeQuality: 'high',
        resizeWidth: request.targetWidth,
      });
      if (
        bitmap.width !== request.targetWidth
        || bitmap.height !== request.targetHeight
      ) {
        bitmap.close();
        throw conversionError(
          'decode-failed',
          'The selected image could not be safely downsampled.',
        );
      }
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch (error) {
      if (error instanceof FamilyPhotoConversionError) {
        throw error;
      }
      return decodeWithImageElement(file, request, error);
    }
  }
  return decodeWithImageElement(file, request);
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  mimeType: typeof FAMILY_PHOTO_OUTPUT_MIME,
  quality: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== mimeType) {
        reject(conversionError('encode-failed', 'The image could not be converted to a private local copy.'));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
}

const browserEnvironment: FamilyPhotoConversionEnvironment = {
  preflight: preflightFamilyPhoto,
  decode: decodeWithBrowser,
  createCanvas: (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
  encode: encodeCanvas,
};

export function boundedFamilyPhotoSize(
  sourceWidth: number,
  sourceHeight: number,
  maxLongSide = FAMILY_PHOTO_MAX_LONG_SIDE,
): { width: number; height: number } {
  if (
    !Number.isFinite(sourceWidth)
    || !Number.isFinite(sourceHeight)
    || sourceWidth <= 0
    || sourceHeight <= 0
  ) {
    throw conversionError('invalid-dimensions', 'The selected image has invalid dimensions.');
  }
  const scale = Math.min(1, maxLongSide / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function jpegContainsSourceMetadata(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return true;
  }

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return true;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xda || marker === 0xd9) {
      return false;
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segmentLength = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) {
      return true;
    }
    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) {
      return true;
    }
    offset += 2 + segmentLength;
  }
  return true;
}

export async function assertPrivateFamilyPhotoOutput(
  converted: ConvertedFamilyPhoto,
): Promise<void> {
  if (
    converted.mimeType !== FAMILY_PHOTO_OUTPUT_MIME
    || converted.blob.type !== FAMILY_PHOTO_OUTPUT_MIME
    || Math.max(converted.width, converted.height) > FAMILY_PHOTO_MAX_LONG_SIDE
  ) {
    throw conversionError('metadata-remained', 'The converted image did not meet the local privacy contract.');
  }
  if (jpegContainsSourceMetadata(new Uint8Array(await converted.blob.arrayBuffer()))) {
    throw conversionError('metadata-remained', 'The converted image still contains source metadata.');
  }
}

export async function convertFamilyPhoto(
  file: File,
  environment: FamilyPhotoConversionEnvironment = browserEnvironment,
): Promise<ConvertedFamilyPhoto> {
  if (!file.type.startsWith('image/')) {
    throw conversionError('unsupported-file', 'Only image files can be added.');
  }
  if (file.size > FAMILY_PHOTO_MAX_SOURCE_BYTES) {
    throw conversionError('file-too-large', 'The selected image is too large to process safely.');
  }

  let preflight: FamilyPhotoPreflight | null;
  try {
    preflight = await environment.preflight(file);
  } catch (error) {
    throw conversionError('unsupported-file', 'The selected image format could not be inspected safely.', error);
  }
  if (!preflight) {
    throw conversionError('unsupported-file', 'The selected image format is not supported for safe local processing.');
  }
  if (
    preflight.width <= 0
    || preflight.height <= 0
    || preflight.width > FAMILY_PHOTO_MAX_SOURCE_DIMENSION
    || preflight.height > FAMILY_PHOTO_MAX_SOURCE_DIMENSION
    || preflight.width * preflight.height > FAMILY_PHOTO_MAX_SOURCE_PIXELS
  ) {
    throw conversionError(
      'dimensions-too-large',
      'The selected image dimensions are too large to process safely.',
    );
  }
  const target = boundedFamilyPhotoSize(preflight.width, preflight.height);
  let decoded: DecodedFamilyPhoto;
  try {
    decoded = await environment.decode(file, {
      preflight,
      targetWidth: target.width,
      targetHeight: target.height,
    });
  } catch (error) {
    if (error instanceof FamilyPhotoConversionError) {
      throw error;
    }
    throw conversionError('decode-failed', 'The selected image could not be decoded.', error);
  }

  try {
    const { width, height } = boundedFamilyPhotoSize(decoded.width, decoded.height);
    const canvas = environment.createCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw conversionError('canvas-failed', 'The selected image could not be prepared on this device.');
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);

    let blob: Blob;
    try {
      blob = await environment.encode(canvas, FAMILY_PHOTO_OUTPUT_MIME, FAMILY_PHOTO_OUTPUT_QUALITY);
    } catch (error) {
      if (error instanceof FamilyPhotoConversionError) {
        throw error;
      }
      throw conversionError('encode-failed', 'The image could not be converted to a private local copy.', error);
    }
    const converted: ConvertedFamilyPhoto = {
      blob,
      width,
      height,
      mimeType: FAMILY_PHOTO_OUTPUT_MIME,
    };
    await assertPrivateFamilyPhotoOutput(converted);
    return converted;
  } finally {
    decoded.dispose();
  }
}
