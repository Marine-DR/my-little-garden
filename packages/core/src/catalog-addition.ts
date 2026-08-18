import type {
  CatalogAddResult,
  CatalogImportError,
  CatalogModifyImpactedSelection,
} from './desktop-api';
import { groupSelectionUsages } from './catalog-modification';
import { normalizeDatabaseKey } from './normalization';
import {
  hasSameMaterialPlantRecord,
  type Plant,
  type PlantWriteInput,
} from './plant';
import type { IncrementalPlantCatalogRepository } from './repository';

export type CatalogAdditionPolicy = 'update_existing' | 'ignore_existing';

export type CatalogAdditionAnalysis = {
  readonly existingByName: ReadonlyMap<string, Plant>;
  readonly modifiedPlants: readonly Plant[];
  readonly created: number;
  readonly unchanged: number;
  readonly conflicts: readonly string[];
  readonly impactedSelections: readonly CatalogModifyImpactedSelection[];
};

/** Shared rules for adding CSV records without replacing the current catalog. */
export class CatalogAdditionService {
  constructor(private readonly repository: IncrementalPlantCatalogRepository) {}

  async analyze(
    records: readonly PlantWriteInput[],
  ): Promise<CatalogAdditionAnalysis | readonly CatalogImportError[]> {
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
    const modifiedPlants = records.flatMap((record) => {
      const existing = existingByName.get(normalizeDatabaseKey(record.name));
      return existing && !hasSameMaterialPlantRecord(existing, record)
        ? [existing]
        : [];
    });
    const unchanged = records.filter((record) => {
      const existing = existingByName.get(normalizeDatabaseKey(record.name));
      return existing && hasSameMaterialPlantRecord(existing, record);
    }).length;
    return {
      existingByName,
      modifiedPlants,
      created: records.length - existingByName.size,
      unchanged,
      conflicts: records.flatMap((record) => {
        const existing = existingByName.get(normalizeDatabaseKey(record.name));
        return existing && !hasSameMaterialPlantRecord(existing, record)
          ? [record.name]
          : [];
      }),
      impactedSelections: groupSelectionUsages(
        await this.repository.listSelectionUsages(
          modifiedPlants.map(({ id }) => id),
        ),
      ),
    };
  }

  commit(
    records: readonly PlantWriteInput[],
    analysis: CatalogAdditionAnalysis,
    policy: CatalogAdditionPolicy,
  ): CatalogAddResult {
    try {
      const inputs: PlantWriteInput[] = [];
      let created = 0;
      let updated = 0;
      let alreadyExisted = 0;
      let notAdded = 0;
      for (const record of records) {
        const existing = analysis.existingByName.get(
          normalizeDatabaseKey(record.name),
        );
        if (!existing) {
          inputs.push(record);
          created += 1;
        } else if (hasSameMaterialPlantRecord(existing, record)) {
          alreadyExisted += 1;
        } else if (policy === 'ignore_existing') {
          notAdded += 1;
        } else {
          inputs.push({ ...record, id: existing.id });
          updated += 1;
        }
      }
      this.repository.upsertImportedBatch(
        inputs,
        policy === 'update_existing' ? analysis.modifiedPlants : [],
      );
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
