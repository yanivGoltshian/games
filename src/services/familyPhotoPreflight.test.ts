import { describe, expect, it } from 'vitest';
import { preflightFamilyPhoto } from './familyPhotoPreflight';

function concatenate(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function ascii(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function uint16BigEndian(value: number): Uint8Array<ArrayBuffer> {
  return Uint8Array.of((value >>> 8) & 0xff, value & 0xff);
}

function uint32BigEndian(value: number): Uint8Array<ArrayBuffer> {
  return Uint8Array.of(
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  );
}

function uint24LittleEndian(value: number): Uint8Array<ArrayBuffer> {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff);
}

function fileFromBytes(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes.buffer as ArrayBuffer], name, { type });
}

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function orientedJpegHeader(width: number, height: number): Uint8Array {
  const exif = Uint8Array.of(
    ...ascii('Exif'),
    0, 0,
    0x49, 0x49, 0x2a, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01,
    0x03, 0x00,
    0x01, 0x00, 0x00, 0x00,
    0x06, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  );
  const sof = concatenate(
    Uint8Array.of(0xff, 0xc0, 0x00, 0x0b, 0x08),
    uint16BigEndian(height),
    uint16BigEndian(width),
    Uint8Array.of(0x01, 0x01, 0x11, 0x00),
  );
  return concatenate(
    Uint8Array.of(0xff, 0xd8, 0xff, 0xe1),
    uint16BigEndian(exif.length + 2),
    exif,
    sof,
    Uint8Array.of(0xff, 0xd9),
  );
}

function webpHeader(width: number, height: number): Uint8Array {
  const vp8x = concatenate(
    ascii('VP8X'),
    Uint8Array.of(10, 0, 0, 0),
    Uint8Array.of(0, 0, 0, 0),
    uint24LittleEndian(width - 1),
    uint24LittleEndian(height - 1),
  );
  return concatenate(
    ascii('RIFF'),
    Uint8Array.of(vp8x.length + 4, 0, 0, 0),
    ascii('WEBP'),
    vp8x,
  );
}

function isoBox(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concatenate(...payload);
  return concatenate(uint32BigEndian(body.length + 8), ascii(type), body);
}

function heifHeader(width: number, height: number): Uint8Array {
  const primaryItem = isoBox(
    'pitm',
    Uint8Array.of(0, 0, 0, 0),
    Uint8Array.of(0, 1),
  );
  const dimensions = isoBox(
    'ispe',
    Uint8Array.of(0, 0, 0, 0),
    uint32BigEndian(width),
    uint32BigEndian(height),
  );
  const rotation = isoBox('irot', Uint8Array.of(1));
  const properties = isoBox('ipco', dimensions, rotation);
  const associations = isoBox(
    'ipma',
    Uint8Array.of(0, 0, 0, 0),
    uint32BigEndian(1),
    Uint8Array.of(0, 1, 2, 0x81, 0x82),
  );
  const itemProperties = isoBox('iprp', properties, associations);
  return concatenate(
    isoBox('ftyp', ascii('heic'), uint32BigEndian(0), ascii('heic')),
    isoBox('meta', Uint8Array.of(0, 0, 0, 0), primaryItem, itemProperties),
  );
}

describe('family photo preflight', () => {
  it('reads dimensions from compressed image headers without decoding pixels', async () => {
    const file = new File(
      [pngHeader(8064, 6048).buffer as ArrayBuffer],
      'synthetic.png',
      { type: 'image/png' },
    );

    await expect(preflightFamilyPhoto(file)).resolves.toEqual({
      format: 'png',
      width: 8064,
      height: 6048,
    });
  });

  it('reads JPEG EXIF orientation before raster decode', async () => {
    const file = fileFromBytes(
      orientedJpegHeader(4032, 3024),
      'synthetic-oriented.jpg',
      'image/jpeg',
    );

    await expect(preflightFamilyPhoto(file)).resolves.toEqual({
      format: 'jpeg',
      width: 3024,
      height: 4032,
    });
  });

  it.each([
    [
      fileFromBytes(webpHeader(1600, 1200), 'synthetic.webp', 'image/webp'),
      { format: 'webp', width: 1600, height: 1200 },
    ],
    [
      fileFromBytes(
        concatenate(ascii('GIF89a'), Uint8Array.of(0x40, 0x06, 0xb0, 0x04)),
        'synthetic.gif',
        'image/gif',
      ),
      { format: 'gif', width: 1600, height: 1200 },
    ],
  ])('reads safe dimensions from other browser image headers', async (file, expected) => {
    await expect(preflightFamilyPhoto(file)).resolves.toEqual(expected);
  });

  it('reads primary HEIF dimensions and rotation from synthetic ISO boxes', async () => {
    const file = fileFromBytes(
      heifHeader(8064, 6048),
      'synthetic.heic',
      'image/heic',
    );

    await expect(preflightFamilyPhoto(file)).resolves.toEqual({
      format: 'heif',
      width: 6048,
      height: 8064,
    });
  });

  it('rejects formats without a safely inspectable raster header', async () => {
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="9000"/>'],
      'synthetic.svg',
      { type: 'image/svg+xml' },
    );

    await expect(preflightFamilyPhoto(file)).resolves.toBeNull();
  });
});
