import type {
  CatalogModifyImpactedSelection,
  PlantDeletionPreviewResult,
  PlantDeletionResult,
} from './desktop-api';
import type {
  IncrementalPlantCatalogRepository,
  PlantCatalogRepository,
  SelectionPlantUsage,
} from './repository';

export function groupDeletionUsages(
  usages: readonly SelectionPlantUsage[],
): readonly CatalogModifyImpactedSelection[] {
  const grouped = new Map<
    string,
    { id: string; name: string; plantNames: string[] }
  >();
  for (const usage of usages) {
    const selection = grouped.get(usage.selectionId) ?? {
      id: usage.selectionId,
      name: usage.selectionName,
      plantNames: [],
    };
    selection.plantNames.push(usage.plantName);
    grouped.set(usage.selectionId, selection);
  }
  return [...grouped.values()];
}

/** Shared rules for previewing and committing checked-plant deletion. */
export class CatalogDeletionService {
  constructor(
    private readonly repository: PlantCatalogRepository &
      IncrementalPlantCatalogRepository,
  ) {}

  async preview(
    plantIds: readonly string[],
  ): Promise<PlantDeletionPreviewResult> {
    const ids = [...new Set(plantIds)];
    if (ids.length === 0) {
      return { ok: false, code: 'no_plants' };
    }
    const plants = await this.repository.listByIds(ids);
    if (plants.length !== ids.length) {
      return { ok: false, code: 'plants_not_found' };
    }
    const usages = await this.repository.listSelectionUsages(ids);
    return {
      ok: true,
      plants: plants.map(({ id, name }) => ({ id, name })),
      impactedSelections: groupDeletionUsages(usages),
    };
  }

  delete(plantIds: readonly string[]): PlantDeletionResult {
    const ids = [...new Set(plantIds)];
    if (ids.length === 0) {
      return { ok: false, code: 'no_plants' };
    }
    return this.repository.deletePlants(ids);
  }
}
