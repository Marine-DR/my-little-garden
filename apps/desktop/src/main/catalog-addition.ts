import { randomUUID } from 'node:crypto';
import { CsvPlantCatalogImporter } from '@my-little-garden/communication';
import {
  normalizeDatabaseKey,
  type CatalogAddPreviewResult,
  type CatalogAddResult,
  type CatalogImportError,
  type Plant,
  type PlantWriteInput,
} from '@my-little-garden/core';
import { SqlitePlantCatalogRepository } from '@my-little-garden/database';
import type { DatabaseSync } from 'node:sqlite';

type Preview = {
  readonly records: readonly PlantWriteInput[];
  readonly existingByName: ReadonlyMap<string, Plant>;
  readonly expiresAt: number;
};

function materialRecord(input: PlantWriteInput | Plant): string {
  const values =
    'typeLabel' in input
      ? {
          name: normalizeDatabaseKey(input.name),
          height: input.heightCm,
          type: input.typeLabel ? normalizeDatabaseKey(input.typeLabel) : null,
          kind: input.kind,
          soils: input.soilLabels.map(normalizeDatabaseKey).sort(),
          exposures: [...input.exposures].sort(),
          bloom: input.bloom,
          flowers: input.flowerColorLabels.map(normalizeDatabaseKey).sort(),
          leaves: input.leafColorLabels.map(normalizeDatabaseKey).sort(),
          temperature: input.minimumTemperatureCelsius,
          foliage: input.foliagePersistence,
          spacing: input.spacingCm,
          seasons: [...input.plantingSeasons].sort(),
        }
      : {
          name: normalizeDatabaseKey(input.name),
          height: input.heightCm,
          type: input.type?.label
            ? normalizeDatabaseKey(input.type.label)
            : null,
          kind: input.kind,
          soils: input.soils
            .map(({ label }) => normalizeDatabaseKey(label))
            .sort(),
          exposures: [...input.exposures].sort(),
          bloom: input.bloom,
          flowers: input.flowerColors
            .map(({ label }) => normalizeDatabaseKey(label))
            .sort(),
          leaves: input.leafColors
            .map(({ label }) => normalizeDatabaseKey(label))
            .sort(),
          temperature: input.minimumTemperatureCelsius,
          foliage: input.foliagePersistence,
          spacing: input.spacingCm,
          seasons: [...input.plantingSeasons].sort(),
        };
  return JSON.stringify(values);
}

function fileErrors(
  filename: string,
  csv: string,
): readonly CatalogImportError[] {
  if (!/\.csv$/iu.test(filename)) {
    return [
      {
        code: 'invalid_file_type',
        field: 'file',
        message: 'Le fichier doit être au format .csv.',
      },
    ];
  }
  const result = new CsvPlantCatalogImporter().importData(csv);
  return result.ok ? [] : result.errors;
}

export class CatalogAdditionService {
  private readonly previews = new Map<string, Preview>();
  private readonly repository: SqlitePlantCatalogRepository;

  constructor(database: DatabaseSync) {
    this.repository = new SqlitePlantCatalogRepository(database);
  }

  async preview(
    filename: string,
    csv: string,
  ): Promise<CatalogAddPreviewResult> {
    const errors = fileErrors(filename, csv);
    if (errors.length > 0) {
      return { ok: false, errors };
    }
    const parsed = new CsvPlantCatalogImporter().importData(csv);
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
      return existing && materialRecord(existing) !== materialRecord(record);
    });
    const unchanged = parsed.records.filter((record) => {
      const existing = existingByName.get(normalizeDatabaseKey(record.name));
      return existing && materialRecord(existing) === materialRecord(record);
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
        if (materialRecord(existing) === materialRecord(record)) {
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
