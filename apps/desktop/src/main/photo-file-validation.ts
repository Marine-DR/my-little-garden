import { basename, extname } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import type { PhotoImportError, PhotoImportFile } from '../shared/catalog.js';

const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;

export type ValidImage = PhotoImportFile & {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: '.jpg' | '.png' | '.webp';
};

type ImageFormat = Pick<ValidImage, 'mediaType' | 'extension'>;

function hasSupportedExtension(filename: string): boolean {
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(
    extname(filename).toLowerCase(),
  );
}

function hasValidImageSize(bytes: Buffer): boolean {
  return bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES;
}

function isPng(bytes: Buffer): boolean {
  return bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function isJpeg(bytes: Buffer): boolean {
  return (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  );
}

function isWebp(bytes: Buffer): boolean {
  return (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function detectImageFormat(bytes: Buffer): ImageFormat | null {
  if (isPng(bytes)) {
    return { mediaType: 'image/png', extension: '.png' };
  }
  if (isJpeg(bytes)) {
    return { mediaType: 'image/jpeg', extension: '.jpg' };
  }
  if (isWebp(bytes)) {
    return { mediaType: 'image/webp', extension: '.webp' };
  }
  return null;
}

function validateImage(file: PhotoImportFile): ValidImage | null {
  const bytes = Buffer.from(file.bytes);
  if (!hasSupportedExtension(file.name) || !hasValidImageSize(bytes)) {
    return null;
  }
  const format = detectImageFormat(bytes);
  return format ? { ...file, ...format } : null;
}

function readZipEntries(file: PhotoImportFile): PhotoImportFile[] {
  const archive = Buffer.from(file.bytes);
  if (archive.length > MAX_ARCHIVE_BYTES) {
    throw new Error('Le fichier ZIP est trop volumineux.');
  }
  const entries: PhotoImportFile[] = [];
  let offset = 0;
  let totalSize = 0;
  while (
    offset + 4 <= archive.length &&
    archive.readUInt32LE(offset) === 0x04034b50
  ) {
    if (entries.length >= MAX_ARCHIVE_ENTRIES) {
      throw new Error('Le fichier ZIP contient trop de fichiers.');
    }
    if (offset + 30 > archive.length) {
      throw new Error('Le fichier ZIP est endommagé.');
    }
    const flags = archive.readUInt16LE(offset + 6);
    const method = archive.readUInt16LE(offset + 8);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const uncompressedSize = archive.readUInt32LE(offset + 22);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    if ((flags & 0x08) !== 0) {
      throw new Error('Ce type de fichier ZIP n’est pas pris en charge.');
    }
    const dataStart = offset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > archive.length) {
      throw new Error('Le fichier ZIP est endommagé.');
    }
    const rawName = archive
      .subarray(offset + 30, offset + 30 + nameLength)
      .toString('utf8');
    const name = basename(rawName.replaceAll('\\', '/'));
    if (name && !rawName.endsWith('/')) {
      if (uncompressedSize > MAX_IMAGE_BYTES) {
        throw new Error(`${name} est trop volumineux.`);
      }
      const compressed = archive.subarray(dataStart, dataEnd);
      const bytes =
        method === 0
          ? compressed
          : method === 8
            ? inflateRawSync(compressed)
            : null;
      if (!bytes || bytes.length !== uncompressedSize) {
        throw new Error(`Le fichier ${name} ne peut pas être lu.`);
      }
      totalSize += bytes.length;
      if (totalSize > MAX_ARCHIVE_BYTES) {
        throw new Error('Le contenu du ZIP est trop volumineux.');
      }
      entries.push({ name, bytes });
    }
    offset = dataEnd;
  }
  if (entries.length === 0) {
    throw new Error('Le fichier ZIP ne contient aucune image.');
  }
  return entries;
}

function expandFiles(files: readonly PhotoImportFile[]): PhotoImportFile[] {
  return files.flatMap((file) =>
    extname(file.name).toLowerCase() === '.zip' ? readZipEntries(file) : [file],
  );
}

export function validatePhotoFiles(files: readonly PhotoImportFile[]): {
  images: ValidImage[];
  errors: PhotoImportError[];
} {
  const images: ValidImage[] = [];
  const errors: PhotoImportError[] = [];
  for (const file of expandFiles(files)) {
    const image = validateImage(file);
    if (image) {
      images.push(image);
    } else {
      errors.push({
        code: 'invalid_image',
        field: file.name,
        message: `${file.name} n’est pas une image PNG, JPEG ou WebP valide.`,
      });
    }
  }
  return { images, errors };
}
