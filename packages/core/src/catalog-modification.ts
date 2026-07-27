import type { CatalogImportError, CatalogModifyResult } from './desktop-api';
import { normalizeDatabaseKey } from './normalization';
import {
  hasSameMaterialPlantRecord,
  type Plant,
  type PlantWriteInput,
} from './plant';
import type { IncrementalPlantCatalogRepository } from './repository';

export type CatalogModificationPolicy = 'create_missing' | 'ignore_missing';

export type CatalogModificationAnalysis = {
  readonly existingByName: ReadonlyMap<string, Plant>;
  readonly updated: number;
  readonly unchanged: number;
  readonly missing: readonly string[];
};

/** Shared business rules for applying complete CSV records to a catalog. */
export class CatalogModificationService {
  constructor(private readonly repository: IncrementalPlantCatalogRepository) {}

  async analyze(
    records: readonly PlantWriteInput[],
  ): Promise<CatalogModificationAnalysis | readonly CatalogImportError[]> {
    const existingByName = new Map<string, Plant>();
    const names = new Set<string>();
    for (const record of records) {
      const key = normalizeDatabaseKey(record.name);
      if (names.has(key)) {
        return [
          {
            code: 'duplicate_plant_name',
            message: `Le fichier contient plusieurs lignes pour la plante « ${record.name} ».`,
          },
        ];
      }
      names.add(key);
      const existing = await this.repository.findByNormalizedName(key);
      if (existing) {
        existingByName.set(key, existing);
      }
    }
    return {
      existingByName,
      updated: records.filter((record) => {
        const existing = existingByName.get(normalizeDatabaseKey(record.name));
        return (
          existing !== undefined &&
          !hasSameMaterialPlantRecord(existing, record)
        );
      }).length,
      unchanged: records.filter((record) => {
        const existing = existingByName.get(normalizeDatabaseKey(record.name));
        return (
          existing !== undefined && hasSameMaterialPlantRecord(existing, record)
        );
      }).length,
      missing: records
        .filter(
          (record) => !existingByName.has(normalizeDatabaseKey(record.name)),
        )
        .map(({ name }) => name),
    };
  }

  commit(
    records: readonly PlantWriteInput[],
    analysis: CatalogModificationAnalysis,
    policy: CatalogModificationPolicy,
  ): CatalogModifyResult {
    try {
      const inputs: PlantWriteInput[] = [];
      let created = 0;
      let updated = 0;
      let unchanged = 0;
      let notAdded = 0;
      for (const record of records) {
        const existing = analysis.existingByName.get(
          normalizeDatabaseKey(record.name),
        );
        if (!existing) {
          if (policy === 'create_missing') {
            inputs.push(record);
            created += 1;
          } else {
            notAdded += 1;
          }
        } else if (hasSameMaterialPlantRecord(existing, record)) {
          unchanged += 1;
        } else {
          inputs.push({ ...record, id: existing.id });
          updated += 1;
        }
      }
      this.repository.upsertImportedBatch(inputs);
      return {
        ok: true,
        created,
        updated,
        ignored: unchanged + notAdded,
        unchanged,
        notAdded,
      };
    } catch {
      return {
        ok: false,
        errors: [
          {
            code: 'catalog_modification_failed',
            message:
              "Une erreur est survenue, le catalogue n'a pas pu être mis à jour.",
          },
        ],
      };
    }
  }
}
