import { randomUUID } from 'node:crypto';
import {
  hasSameMaterialPlantRecord,
  normalizeDatabaseKey,
  type CatalogAddPreviewResult,
  type CatalogAddResult,
  type PlantCatalogImporter,
  type Plant,
  type PlantWriteInput,
  type IncrementalPlantCatalogRepository,
} from '@my-little-garden/core';

type Preview = {
  readonly records: readonly PlantWriteInput[];
  readonly existingByName: ReadonlyMap<string, Plant>;
  readonly expiresAt: number;
};

export class CatalogAdditionService {
  private readonly previews = new Map<string, Preview>();
  constructor(
    private readonly repository: IncrementalPlantCatalogRepository,
    private readonly importer: PlantCatalogImporter,
  ) {}

  async preview(
    filename: string,
    csv: string,
  ): Promise<CatalogAddPreviewResult> {
    if (!/\.csv$/iu.test(filename)) {
      return {
        ok: false,
        errors: [
          {
            code: 'invalid_file_type',
            field: 'file',
            message: 'Le fichier doit être au format .csv.',
          },
        ],
      };
    }
    const parsed = this.importer.importData(csv);
    if (!parsed.ok) {
      return parsed;
    }
    const names = new Set<string>();
    for (const record of parsed.records) {
      const name = normalizeDatabaseKey(record.name);
      if (names.has(name)) {
        return {
          ok: false,
          errors: [
            {
              code: 'duplicate_plant_name',
              message: `Le fichier contient plusieurs lignes pour la plante « ${record.name} ».`,
            },
          ],
        };
      }
      names.add(name);
    }
    const existingByName = new Map<string, Plant>();
    for (const record of parsed.records) {
      const key = normalizeDatabaseKey(record.name);
      const existing = await this.repository.findByNormalizedName(key);
      if (existing) {
        existingByName.set(key, existing);
      }
    }
    const conflicts = parsed.records.filter((record) => {
      const existing = existingByName.get(normalizeDatabaseKey(record.name));
      return existing && !hasSameMaterialPlantRecord(existing, record);
    });
    const unchanged = parsed.records.filter((record) => {
      const existing = existingByName.get(normalizeDatabaseKey(record.name));
      return existing && hasSameMaterialPlantRecord(existing, record);
    }).length;
    const token = randomUUID();
    this.previews.set(token, {
      records: parsed.records,
      existingByName,
      expiresAt: Date.now() + 5 * 60_000,
    });
    return {
      ok: true,
      token,
      created: parsed.records.length - existingByName.size,
      unchanged,
      conflicts: conflicts.map(({ name }) => name),
    };
  }

  async commit(
    token: string,
    policy: 'update_existing' | 'ignore_existing',
  ): Promise<CatalogAddResult> {
    const preview = this.previews.get(token);
    this.previews.delete(token);
    if (!preview || preview.expiresAt < Date.now()) {
      return {
        ok: false,
        errors: [
          {
            code: 'expired_preview',
            message:
              'La prévisualisation a expiré. Veuillez importer le fichier à nouveau.',
          },
        ],
      };
    }
    try {
      const inputs: PlantWriteInput[] = [];
      let created = 0;
      let updated = 0;
      let alreadyExisted = 0;
      let notAdded = 0;
      for (const record of preview.records) {
        const existing = preview.existingByName.get(
          normalizeDatabaseKey(record.name),
        );
        if (!existing) {
          inputs.push(record);
          created += 1;
          continue;
        }
        if (hasSameMaterialPlantRecord(existing, record)) {
          alreadyExisted += 1;
          continue;
        }
        if (policy === 'ignore_existing') {
          notAdded += 1;
          continue;
        }
        inputs.push({ ...record, id: existing.id });
        updated += 1;
      }
      this.repository.upsertImportedBatch(inputs);
      return {
        ok: true,
        created,
        updated,
        ignored: alreadyExisted + notAdded,
        alreadyExisted,
        notAdded,
      };
    } catch {
      return {
        ok: false,
        errors: [
          {
            code: 'catalog_addition_failed',
            message:
              "Une erreur est survenue, le catalogue n'a pas pu être mis à jour.",
          },
        ],
      };
    }
  }
}
