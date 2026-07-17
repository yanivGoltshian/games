export type FamilyPhotoSourceFormat = 'gif' | 'heif' | 'jpeg' | 'png' | 'webp';

export interface FamilyPhotoPreflight {
  format: FamilyPhotoSourceFormat;
  width: number;
  height: number;
}

const PREFLIGHT_BYTES = 8 * 1024 * 1024;

interface ImageDimensions {
  width: number;
  height: number;
  orientation?: number;
}

interface IsoBox {
  type: string;
  dataStart: number;
  end: number;
  next: number;
}

function uint16(bytes: Uint8Array, offset: number, littleEndian = false): number | null {
  if (offset < 0 || offset + 2 > bytes.length) {
    return null;
  }
  return littleEndian
    ? bytes[offset]! | (bytes[offset + 1]! << 8)
    : (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function uint24LittleEndian(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 3 > bytes.length) {
    return null;
  }
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function uint32(bytes: Uint8Array, offset: number, littleEndian = false): number | null {
  if (offset < 0 || offset + 4 > bytes.length) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(offset, littleEndian);
}

function fourCc(bytes: Uint8Array, offset: number): string {
  if (offset < 0 || offset + 4 > bytes.length) {
    return '';
  }
  return String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!,
  );
}

function orientedDimensions(dimensions: ImageDimensions): ImageDimensions {
  const { width, height, orientation = 1 } = dimensions;
  return orientation >= 5 && orientation <= 8
    ? { width: height, height: width, orientation }
    : dimensions;
}

function parseTiffOrientation(
  bytes: Uint8Array,
  tiffStart: number,
  limit: number,
): number | undefined {
  if (tiffStart + 8 > limit) {
    return undefined;
  }
  const byteOrder = fourCc(bytes, tiffStart).slice(0, 2);
  const littleEndian = byteOrder === 'II';
  if (!littleEndian && byteOrder !== 'MM') {
    return undefined;
  }
  if (uint16(bytes, tiffStart + 2, littleEndian) !== 42) {
    return undefined;
  }
  const ifdOffset = uint32(bytes, tiffStart + 4, littleEndian);
  if (ifdOffset === null) {
    return undefined;
  }
  const ifdStart = tiffStart + ifdOffset;
  const entryCount = uint16(bytes, ifdStart, littleEndian);
  if (entryCount === null) {
    return undefined;
  }
  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifdStart + 2 + index * 12;
    if (entry + 12 > limit) {
      return undefined;
    }
    if (
      uint16(bytes, entry, littleEndian) === 0x0112
      && uint16(bytes, entry + 2, littleEndian) === 3
      && uint32(bytes, entry + 4, littleEndian) === 1
    ) {
      const orientation = uint16(bytes, entry + 8, littleEndian);
      return orientation && orientation <= 8 ? orientation : undefined;
    }
  }
  return undefined;
}

function exifOrientation(
  bytes: Uint8Array,
  start: number,
  end: number,
): number | undefined {
  const hasExifPreamble = fourCc(bytes, start) === 'Exif'
    && bytes[start + 4] === 0
    && bytes[start + 5] === 0;
  return parseTiffOrientation(bytes, start + (hasExifPreamble ? 6 : 0), end);
}

function parseJpeg(bytes: Uint8Array): ImageDimensions | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf,
  ]);
  let orientation: number | undefined;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    while (bytes[offset] === 0xff) {
      offset += 1;
    }
    const marker = bytes[offset];
    if (marker === undefined || marker === 0xda || marker === 0xd9) {
      break;
    }
    offset += 1;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    const segmentLength = uint16(bytes, offset);
    if (segmentLength === null || segmentLength < 2) {
      return null;
    }
    const dataStart = offset + 2;
    const dataEnd = offset + segmentLength;
    if (dataEnd > bytes.length) {
      return null;
    }
    if (marker === 0xe1) {
      orientation ??= exifOrientation(bytes, dataStart, dataEnd);
    }
    if (sofMarkers.has(marker)) {
      const height = uint16(bytes, dataStart + 1);
      const width = uint16(bytes, dataStart + 3);
      if (!width || !height) {
        return null;
      }
      return orientedDimensions({
        width,
        height,
        ...(orientation === undefined ? {} : { orientation }),
      });
    }
    offset = dataEnd;
  }
  return null;
}

function parsePng(bytes: Uint8Array): ImageDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((value, index) => bytes[index] === value)) {
    return null;
  }
  const width = uint32(bytes, 16);
  const height = uint32(bytes, 20);
  if (!width || !height) {
    return null;
  }
  let orientation: number | undefined;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = uint32(bytes, offset);
    const type = fourCc(bytes, offset + 4);
    if (length === null) {
      break;
    }
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) {
      break;
    }
    if (type === 'eXIf') {
      orientation = exifOrientation(bytes, dataStart, dataEnd);
    }
    if (type === 'IDAT') {
      break;
    }
    offset = dataEnd + 4;
  }
  return orientedDimensions({
    width,
    height,
    ...(orientation === undefined ? {} : { orientation }),
  });
}

function parseWebp(bytes: Uint8Array): ImageDimensions | null {
  if (fourCc(bytes, 0) !== 'RIFF' || fourCc(bytes, 8) !== 'WEBP') {
    return null;
  }
  let dimensions: ImageDimensions | null = null;
  let orientation: number | undefined;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = fourCc(bytes, offset);
    const length = uint32(bytes, offset + 4, true);
    if (length === null) {
      return null;
    }
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > bytes.length) {
      return null;
    }
    if (type === 'VP8X' && length >= 10) {
      const widthMinusOne = uint24LittleEndian(bytes, dataStart + 4);
      const heightMinusOne = uint24LittleEndian(bytes, dataStart + 7);
      if (widthMinusOne !== null && heightMinusOne !== null) {
        dimensions = { width: widthMinusOne + 1, height: heightMinusOne + 1 };
      }
    } else if (
      type === 'VP8 '
      && length >= 10
      && bytes[dataStart + 3] === 0x9d
      && bytes[dataStart + 4] === 0x01
      && bytes[dataStart + 5] === 0x2a
    ) {
      const widthBits = uint16(bytes, dataStart + 6, true);
      const heightBits = uint16(bytes, dataStart + 8, true);
      if (widthBits !== null && heightBits !== null) {
        dimensions = { width: widthBits & 0x3fff, height: heightBits & 0x3fff };
      }
    } else if (type === 'VP8L' && length >= 5 && bytes[dataStart] === 0x2f) {
      const bits = uint32(bytes, dataStart + 1, true);
      if (bits !== null) {
        dimensions = {
          width: (bits & 0x3fff) + 1,
          height: ((bits >>> 14) & 0x3fff) + 1,
        };
      }
    } else if (type === 'EXIF') {
      orientation = exifOrientation(bytes, dataStart, dataEnd);
    }
    offset = dataEnd + (length % 2);
  }
  return dimensions
    ? orientedDimensions({
      ...dimensions,
      ...(orientation === undefined ? {} : { orientation }),
    })
    : null;
}

function parseGif(bytes: Uint8Array): ImageDimensions | null {
  const header = String.fromCharCode(...bytes.slice(0, 6));
  if (header !== 'GIF87a' && header !== 'GIF89a') {
    return null;
  }
  const width = uint16(bytes, 6, true);
  const height = uint16(bytes, 8, true);
  return width && height ? { width, height } : null;
}

function isoBox(bytes: Uint8Array, offset: number, limit: number): IsoBox | null {
  const shortSize = uint32(bytes, offset);
  const type = fourCc(bytes, offset + 4);
  if (shortSize === null || !type) {
    return null;
  }
  let headerSize = 8;
  let size = shortSize;
  if (shortSize === 1) {
    const high = uint32(bytes, offset + 8);
    const low = uint32(bytes, offset + 12);
    if (high === null || low === null || high > 0x1fffff) {
      return null;
    }
    size = high * 0x1_0000_0000 + low;
    headerSize = 16;
  } else if (shortSize === 0) {
    size = limit - offset;
  }
  if (size < headerSize || offset + size > limit) {
    return null;
  }
  return {
    type,
    dataStart: offset + headerSize,
    end: offset + size,
    next: offset + size,
  };
}

function childBoxes(bytes: Uint8Array, start: number, end: number): IsoBox[] {
  const boxes: IsoBox[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const box = isoBox(bytes, offset, end);
    if (!box) {
      break;
    }
    boxes.push(box);
    offset = box.next;
  }
  return boxes;
}

function parseHeifAssociations(
  bytes: Uint8Array,
  box: IsoBox,
): Map<number, number[]> {
  const associations = new Map<number, number[]>();
  const version = bytes[box.dataStart];
  const flags = (
    (bytes[box.dataStart + 1]! << 16)
    | (bytes[box.dataStart + 2]! << 8)
    | bytes[box.dataStart + 3]!
  );
  const entryCount = uint32(bytes, box.dataStart + 4);
  if (version === undefined || entryCount === null) {
    return associations;
  }
  let offset = box.dataStart + 8;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    const itemId = version < 1
      ? uint16(bytes, offset)
      : uint32(bytes, offset);
    offset += version < 1 ? 2 : 4;
    const associationCount = bytes[offset];
    offset += 1;
    if (itemId === null || associationCount === undefined) {
      return new Map();
    }
    const propertyIndexes: number[] = [];
    for (let index = 0; index < associationCount; index += 1) {
      if ((flags & 1) !== 0) {
        const value = uint16(bytes, offset);
        if (value === null) {
          return new Map();
        }
        propertyIndexes.push(value & 0x7fff);
        offset += 2;
      } else {
        const value = bytes[offset];
        if (value === undefined) {
          return new Map();
        }
        propertyIndexes.push(value & 0x7f);
        offset += 1;
      }
    }
    associations.set(itemId, propertyIndexes.filter((index) => index > 0));
  }
  return associations;
}

function parseHeif(bytes: Uint8Array): ImageDimensions | null {
  const topLevelBoxes = childBoxes(bytes, 0, bytes.length);
  const ftyp = topLevelBoxes.find((box) => box.type === 'ftyp');
  const meta = topLevelBoxes.find((box) => box.type === 'meta');
  if (!ftyp || !meta) {
    return null;
  }
  const brands = new Set<string>();
  for (let offset = ftyp.dataStart; offset + 4 <= ftyp.end; offset += 4) {
    if (offset !== ftyp.dataStart + 4) {
      brands.add(fourCc(bytes, offset));
    }
  }
  if (![...brands].some((brand) => (
    brand.startsWith('hei')
    || brand === 'mif1'
    || brand === 'msf1'
    || brand === 'avif'
    || brand === 'avis'
  ))) {
    return null;
  }

  const metaChildren = childBoxes(bytes, meta.dataStart + 4, meta.end);
  const pitm = metaChildren.find((box) => box.type === 'pitm');
  const iprp = metaChildren.find((box) => box.type === 'iprp');
  if (!iprp) {
    return null;
  }
  let primaryItemId: number | null = null;
  if (pitm) {
    primaryItemId = bytes[pitm.dataStart] === 0
      ? uint16(bytes, pitm.dataStart + 4)
      : uint32(bytes, pitm.dataStart + 4);
  }

  const properties: Array<
    | { kind: 'dimensions'; width: number; height: number }
    | { kind: 'rotation'; angle: number }
    | null
  > = [null];
  let associations = new Map<number, number[]>();
  for (const box of childBoxes(bytes, iprp.dataStart, iprp.end)) {
    if (box.type === 'ipco') {
      for (const property of childBoxes(bytes, box.dataStart, box.end)) {
        if (property.type === 'ispe') {
          const width = uint32(bytes, property.dataStart + 4);
          const height = uint32(bytes, property.dataStart + 8);
          properties.push(width && height ? { kind: 'dimensions', width, height } : null);
        } else if (property.type === 'irot') {
          const angle = bytes[property.dataStart];
          properties.push(angle === undefined ? null : { kind: 'rotation', angle: angle & 3 });
        } else {
          properties.push(null);
        }
      }
    } else if (box.type === 'ipma') {
      associations = parseHeifAssociations(bytes, box);
    }
  }

  const isHeifProperty = (
    property: (typeof properties)[number] | undefined,
  ): property is Exclude<(typeof properties)[number], null> => property !== null && property !== undefined;
  const isDimensionProperty = (
    property: (typeof properties)[number] | undefined,
  ): property is { kind: 'dimensions'; width: number; height: number } => (
    property?.kind === 'dimensions'
  );
  const primaryProperties = primaryItemId === null
    ? []
    : (associations.get(primaryItemId) ?? [])
      .map((index) => properties[index])
      .filter(isHeifProperty);
  const primaryDimensions = primaryProperties.find((property) => property.kind === 'dimensions');
  const fallbackDimensions = properties
    .filter(isDimensionProperty)
    .sort((left, right) => (
      right.width * right.height - left.width * left.height
    ))[0];
  const dimensions = primaryDimensions ?? fallbackDimensions;
  if (!dimensions || dimensions.kind !== 'dimensions') {
    return null;
  }
  const rotation = primaryProperties.find((property) => property.kind === 'rotation');
  return rotation?.kind === 'rotation' && rotation.angle % 2 === 1
    ? { width: dimensions.height, height: dimensions.width }
    : dimensions;
}

function detectDimensions(bytes: Uint8Array): FamilyPhotoPreflight | null {
  const parsers: Array<[
    FamilyPhotoSourceFormat,
    (source: Uint8Array) => ImageDimensions | null,
  ]> = [
    ['jpeg', parseJpeg],
    ['png', parsePng],
    ['webp', parseWebp],
    ['gif', parseGif],
    ['heif', parseHeif],
  ];
  for (const [format, parser] of parsers) {
    const dimensions = parser(bytes);
    if (dimensions) {
      return { format, width: dimensions.width, height: dimensions.height };
    }
  }
  return null;
}

export async function preflightFamilyPhoto(file: File): Promise<FamilyPhotoPreflight | null> {
  const bytes = new Uint8Array(
    await file.slice(0, Math.min(file.size, PREFLIGHT_BYTES)).arrayBuffer(),
  );
  return detectDimensions(bytes);
}
