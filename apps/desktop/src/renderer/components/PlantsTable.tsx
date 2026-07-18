import type { CatalogPlant } from '@my-little-garden/core';
import { PlantPhoto } from './PlantPhoto';
import {
  EMPTY_VALUE,
  EXPOSURES,
  PERSISTENCE,
  colorEmoji,
  formatBloom,
  formatKind,
  formatNumber,
  formatRange,
  seasonLabels,
} from '../pages/catalog/formatters';

function VerticalList({ values }: { readonly values: readonly string[] }) {
  if (values.length === 0) {
    return EMPTY_VALUE;
  }
  return (
    <span className="vertical-list">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </span>
  );
}

function ColorList({ colors }: { readonly colors: readonly string[] }) {
  if (colors.length === 0) {
    return EMPTY_VALUE;
  }
  return (
    <span className="color-list">
      {colors.map((color) => {
        const emoji = colorEmoji(color);
        return emoji ? (
          <span
            key={color}
            className="color-bubble"
            role="img"
            aria-label={`Couleur ${color}`}
            title={color}
          >
            {emoji}
          </span>
        ) : (
          <span key={color} className="unknown-color">
            {color}
          </span>
        );
      })}
    </span>
  );
}

function PlantRow({
  plant,
  selection,
}: {
  readonly plant: CatalogPlant;
  readonly selection?: {
    readonly selected: boolean;
    readonly onToggle: () => void;
  };
}) {
  const persistence = plant.foliagePersistence
    ? PERSISTENCE[plant.foliagePersistence]
    : null;
  return (
    <tr>
      {selection ? (
        <td className="plant-selection-cell">
          <input
            type="checkbox"
            aria-label={`Sélectionner ${plant.name}`}
            checked={selection.selected}
            onChange={selection.onToggle}
          />
        </td>
      ) : null}
      <td className="plant-photo-cell">
        <PlantPhoto name={plant.name} url={plant.photoUrl} />
      </td>
      <th scope="row" className="plant-name">
        {plant.name}
      </th>
      <td>{formatRange(plant.heightMinCm, plant.heightMaxCm)}</td>
      <td>{plant.type ?? EMPTY_VALUE}</td>
      <td>{formatKind(plant.kind)}</td>
      <td>
        <VerticalList values={plant.soils} />
      </td>
      <td className="icon-list">
        {plant.exposures.length === 0
          ? EMPTY_VALUE
          : plant.exposures.map((code) => (
              <abbr
                key={code}
                className={`exposure-icon exposure-${code}`}
                title={EXPOSURES[code].label}
              >
                {EXPOSURES[code].icon}
              </abbr>
            ))}
      </td>
      <td>{formatBloom(plant.bloomStartMonth, plant.bloomEndMonth)}</td>
      <td>
        <ColorList colors={plant.flowerColors} />
      </td>
      <td>
        <ColorList colors={plant.leafColors} />
      </td>
      <td>{formatNumber(plant.minimumTemperatureCelsius)}</td>
      <td>
        {persistence ? (
          <abbr
            className={`persistence-icon persistence-${plant.foliagePersistence}`}
            title={persistence.label}
          >
            {persistence.icon}
          </abbr>
        ) : (
          EMPTY_VALUE
        )}
      </td>
      <td>{formatNumber(plant.spacingCm)}</td>
      <td>
        <VerticalList values={seasonLabels(plant.plantingSeasons)} />
      </td>
    </tr>
  );
}

interface PlantSelectionControls {
  readonly selectedPlantIds: readonly string[];
  readonly onPlantToggle: (plantId: string) => void;
  readonly selectingAll: boolean;
  readonly onToggleAll: () => void;
  readonly selectAllLabel?: string;
  readonly deselectAllLabel?: string;
}

export function PlantsTable({
  plants,
  selection,
}: {
  readonly plants: readonly CatalogPlant[];
  readonly selection?: PlantSelectionControls;
}) {
  const hasSelectedPlants = (selection?.selectedPlantIds.length ?? 0) > 0;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {selection ? (
              <th scope="col">
                <span className="visually-hidden">Sélection</span>
                <input
                  className="catalog-select-all"
                  type="checkbox"
                  aria-label={
                    hasSelectedPlants
                      ? (selection.deselectAllLabel ??
                        'Désélectionner toutes les plantes')
                      : (selection.selectAllLabel ??
                        'Sélectionner toutes les plantes filtrées')
                  }
                  checked={hasSelectedPlants}
                  disabled={selection.selectingAll}
                  onChange={selection.onToggleAll}
                />
              </th>
            ) : null}
            <th scope="col">Photo</th>
            <th scope="col">Nom</th>
            <th scope="col">
              <span className="header-symbol">↨</span> (cm)
            </th>
            <th scope="col">Type</th>
            <th scope="col">Fleur/autre</th>
            <th scope="col">Sol</th>
            <th scope="col">Exposition</th>
            <th scope="col">Floraison</th>
            <th scope="col">Couleurs 🌸</th>
            <th scope="col">Couleurs 🍃</th>
            <th scope="col">
              <span className="header-symbol">❅</span> (°C)
            </th>
            <th scope="col">Persistant</th>
            <th scope="col">
              <span className="header-symbol">↔</span> (cm)
            </th>
            <th scope="col">Plantation</th>
          </tr>
        </thead>
        <tbody>
          {plants.map((plant) => (
            <PlantRow
              key={plant.id}
              plant={plant}
              selection={
                selection
                  ? {
                      selected: selection.selectedPlantIds.includes(plant.id),
                      onToggle: () => selection.onPlantToggle(plant.id),
                    }
                  : undefined
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
