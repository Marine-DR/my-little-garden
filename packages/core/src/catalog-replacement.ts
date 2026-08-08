import { normalizeDatabaseKey } from './normalization';
import {
  hasSameMaterialPlantRecord,
  type Plant,
  type PlantWriteInput,
} from './plant';

export type CatalogImportPlantRecord = {
  readonly plant: PlantWriteInput;
  readonly hasExplicitId: boolean;
};

export type CatalogReplacementPlan = {
  readonly created: readonly PlantWriteInput[];
  readonly changed: readonly { existing: Plant; input: PlantWriteInput }[];
  readonly unchanged: readonly Plant[];
  readonly deleted: readonly Plant[];
};

/** Applies the shared UUID/name identity rules for a full catalog replacement. */
export function planCatalogReplacement(
  existingPlants: readonly Plant[],
  records: readonly CatalogImportPlantRecord[],
): CatalogReplacementPlan {
  const byId = new Map(existingPlants.map((plant) => [plant.id, plant]));
  const byName = new Map(
    existingPlants.map((plant) => [normalizeDatabaseKey(plant.name), plant]),
  );
  const matchedIds = new Set<string>();
  const targetIds = new Set<string>();
  const created: PlantWriteInput[] = [];
  const changed: { existing: Plant; input: PlantWriteInput }[] = [];
  const unchanged: Plant[] = [];

  for (const record of records) {
    const { plant, hasExplicitId } = record;
    const byProvidedId = hasExplicitId ? byId.get(plant.id) : undefined;
    const byNormalizedName = byName.get(normalizeDatabaseKey(plant.name));
    if (
      hasExplicitId &&
      byProvidedId &&
      byNormalizedName &&
      byProvidedId !== byNormalizedName
    ) {
      throw new Error(
        `L’UUID de « ${plant.name} » et son nom correspondent à deux plantes différentes.`,
      );
    }
    if (hasExplicitId && !byProvidedId && byNormalizedName) {
      throw new Error(
        `L’UUID inconnu de « ${plant.name} » entre en conflit avec une plante existante portant ce nom.`,
      );
    }
    const existing = hasExplicitId ? byProvidedId : byNormalizedName;
    const input = { ...plant, id: existing?.id ?? plant.id };
    if (targetIds.has(input.id)) {
      throw new Error(
        `Plusieurs lignes du fichier correspondent à la plante « ${existing?.name ?? plant.name} ».`,
      );
    }
    targetIds.add(input.id);
    if (!existing) {
      created.push(input);
    } else {
      matchedIds.add(existing.id);
      if (hasSameMaterialPlantRecord(existing, input)) {
        unchanged.push(existing);
      } else {
        changed.push({ existing, input });
      }
    }
  }
  return {
    created,
    changed,
    unchanged,
    deleted: existingPlants.filter(({ id }) => !matchedIds.has(id)),
  };
}
