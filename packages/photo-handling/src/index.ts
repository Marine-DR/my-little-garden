import { readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type {
  PhotoImportError,
  PhotoImportFile,
  PhotoImportResult,
} from '@my-little-garden/core';
import { unzipSync } from 'fflate';

const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;
export const PHOTO_PROTOCOL_SCHEME = 'garden-photo';
const PHOTO_PROTOCOL_HOST = 'image';

export const PHOTO_PROTOCOL_PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
};

export type { PhotoImportError, PhotoImportFile, PhotoImportResult };

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

function hasValidImageSize(bytes: Uint8Array): boolean {
  return bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES;
}

function isPng(bytes: Uint8Array): boolean {
  return bytes
    .subarray(0, 8)
    .every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]);
}

function isJpeg(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  );
}

function isWebp(bytes: Uint8Array): boolean {
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, 4));
  const format = new TextDecoder('ascii').decode(bytes.subarray(8, 12));
  return header === 'RIFF' && format === 'WEBP';
}

function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
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
  if (!hasSupportedExtension(file.name) || !hasValidImageSize(file.bytes)) {
    return null;
  }
  const format = detectImageFormat(file.bytes);
  return format ? { ...file, ...format } : null;
}

function readZipEntries(file: PhotoImportFile): PhotoImportFile[] {
  if (file.bytes.length > MAX_ARCHIVE_BYTES) {
    throw new Error('Le fichier ZIP est trop volumineux.');
  }
  const entries = Object.entries(unzipSync(file.bytes)).filter(
    ([rawName]) => !isIgnoredZipEntry(rawName),
  );
  if (entries.length === 0) {
    throw new Error('Le fichier ZIP ne contient aucune image.');
  }
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error('Le fichier ZIP contient trop de fichiers.');
  }
  let totalSize = 0;
  return entries.map(([rawName, bytes]) => {
    const name = basename(rawName.replaceAll('\\', '/'));
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`${name} est trop volumineux.`);
    }
    totalSize += bytes.length;
    if (totalSize > MAX_ARCHIVE_BYTES) {
      throw new Error('Le contenu du ZIP est trop volumineux.');
    }
    return { name, bytes };
  });
}

function isIgnoredZipEntry(rawName: string): boolean {
  const normalized = rawName.replaceAll('\\', '/');
  const name = basename(normalized);
  return (
    normalized.endsWith('/') ||
    normalized.startsWith('__MACOSX/') ||
    name.startsWith('._') ||
    name === '.DS_Store' ||
    name === 'Thumbs.db'
  );
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

export function photoMediaType(filename: string): string | null {
  if (filename.endsWith('.jpg')) {
    return 'image/jpeg';
  }
  if (filename.endsWith('.png')) {
    return 'image/png';
  }
  if (filename.endsWith('.webp')) {
    return 'image/webp';
  }
  return null;
}

export function createPhotoUrl(filename: string | null): string | null {
  if (!filename || basename(filename) !== filename) {
    return null;
  }
  return `${PHOTO_PROTOCOL_SCHEME}://${PHOTO_PROTOCOL_HOST}/${encodeURIComponent(filename)}`;
}

export async function handlePhotoProtocolRequest(
  photoDirectory: string,
  requestUrl: string,
): Promise<Response> {
  const url = new URL(requestUrl);
  const filename = decodeURIComponent(url.pathname.slice(1));
  const mediaType = photoMediaType(filename);
  if (
    url.hostname !== PHOTO_PROTOCOL_HOST ||
    !filename ||
    basename(filename) !== filename ||
    !mediaType
  ) {
    return new Response('Invalid image path', { status: 400 });
  }
  try {
    return new Response(await readFile(join(photoDirectory, filename)), {
      headers: { 'Content-Type': mediaType, 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response('Image not found', { status: 404 });
  }
}
