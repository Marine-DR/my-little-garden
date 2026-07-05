import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import type { DatabaseSync } from 'node:sqlite';
import type {
  PhotoDeleteResult,
  PhotoImportFile,
  PhotoImportResult,
} from '../shared/catalog.js';

const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;

type ValidImage = PhotoImportFile & {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: '.jpg' | '.png' | '.webp';
};

function caseInsensitiveName(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('fr');
}

function detectImage(file: PhotoImportFile): ValidImage | null {
  const bytes = Buffer.from(file.bytes);
  const suppliedExtension = extname(file.name).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(suppliedExtension)) {
    return null;
  }
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    return null;
  }
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return { ...file, mediaType: 'image/png', extension: '.png' };
  }
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  ) {
    return { ...file, mediaType: 'image/jpeg', extension: '.jpg' };
  }
  if (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ...file, mediaType: 'image/webp', extension: '.webp' };
  }
  return null;
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

export function importPlantPhotos(
  database: DatabaseSync,
  photoDirectory: string,
  files: readonly PhotoImportFile[],
): PhotoImportResult {
  try {
    const expanded = expandFiles(files);
    const invalid: string[] = [];
    const images: ValidImage[] = [];
    for (const file of expanded) {
      const image = detectImage(file);
      if (image) {
        images.push(image);
      } else {
        invalid.push(
          `${file.name} n’est pas une image PNG, JPEG ou WebP valide.`,
        );
      }
    }
    if (invalid.length > 0) {
      return { ok: false, errors: invalid };
    }

    const plants = database.prepare('SELECT id, name FROM plants').all();
    const byName = new Map(
      plants.map((row) => [
        caseInsensitiveName(String(row.name)),
        String(row.id),
      ]),
    );
    const matched = new Map<string, ValidImage>();
    const unmatched: string[] = [];
    for (const image of images) {
      const plantId = byName.get(
        caseInsensitiveName(basename(image.name, extname(image.name))),
      );
      if (!plantId) {
        unmatched.push(image.name);
      } else if (matched.has(plantId)) {
        return {
          ok: false,
          errors: [
            `Plusieurs images correspondent à la même plante dans l’import.`,
          ],
        };
      } else {
        matched.set(plantId, image);
      }
    }

    mkdirSync(photoDirectory, { recursive: true });
    const staged: {
      plantId: string;
      temporary: string;
      managed: string;
      previous: string | null;
      image: ValidImage;
    }[] = [];
    for (const [plantId, image] of matched) {
      const managed = `${randomUUID()}${image.extension}`;
      const temporary = join(photoDirectory, `.${managed}.tmp`);
      writeFileSync(temporary, image.bytes, { flag: 'wx' });
      const previousRow = database
        .prepare('SELECT managed_filename FROM plant_photos WHERE plant_id = ?')
        .get(plantId);
      staged.push({
        plantId,
        temporary,
        managed,
        previous: previousRow ? String(previousRow.managed_filename) : null,
        image,
      });
    }

    database.exec('BEGIN IMMEDIATE');
    try {
      const upsert = database.prepare(`INSERT INTO plant_photos
        (plant_id, managed_filename, media_type, checksum_sha256, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(plant_id) DO UPDATE SET managed_filename=excluded.managed_filename,
          media_type=excluded.media_type, checksum_sha256=excluded.checksum_sha256,
          created_at=excluded.created_at`);
      for (const item of staged) {
        renameSync(item.temporary, join(photoDirectory, item.managed));
        upsert.run(
          item.plantId,
          item.managed,
          item.image.mediaType,
          createHash('sha256').update(item.image.bytes).digest('hex'),
          new Date().toISOString(),
        );
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      for (const item of staged) {
        rmSync(item.temporary, { force: true });
        rmSync(join(photoDirectory, item.managed), { force: true });
      }
      throw error;
    }
    for (const item of staged) {
      if (item.previous) {
        rmSync(join(photoDirectory, item.previous), { force: true });
      }
    }
    return { ok: true, imported: staged.length, unmatched };
  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof Error
          ? error.message
          : 'Les images n’ont pas pu être importées.',
      ],
    };
  }
}

export function deletePlantPhoto(
  database: DatabaseSync,
  photoDirectory: string,
  plantId: string,
): PhotoDeleteResult {
  try {
    const row = database
      .prepare('SELECT managed_filename FROM plant_photos WHERE plant_id = ?')
      .get(plantId);
    if (!row) {
      return { ok: true };
    }
    database
      .prepare('DELETE FROM plant_photos WHERE plant_id = ?')
      .run(plantId);
    rmSync(join(photoDirectory, String(row.managed_filename)), { force: true });
    return { ok: true };
  } catch {
    return { ok: false, error: 'La photo n’a pas pu être supprimée.' };
  }
}
