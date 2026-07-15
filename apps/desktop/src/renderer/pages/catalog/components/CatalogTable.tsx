import type { CatalogPage, CatalogPlant } from '@my-little-garden/core';
import { Pagination } from '@renderer/components/Pagination';
import { PlantPhoto } from '@renderer/components/PlantPhoto';
import {
  EMPTY_VALUE,
  EXPOSURES,
  PERSISTENCE,
  formatBloom,
  formatKind,
  colorEmoji,
  formatNumber,
  formatRange,
  seasonLabels,
} from '../formatters';

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

function PlantRow({ plant }: { readonly plant: CatalogPlant }) {
  const persistence = plant.foliagePersistence
    ? PERSISTENCE[plant.foliagePersistence]
    : null;
  return (
    <tr>
      <td>
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

export function CatalogTable({
  data,
  isFiltered,
  onPageChange,
}: {
  readonly data: CatalogPage;
  readonly isFiltered: boolean;
  readonly onPageChange: (page: number) => void;
}) {
  return (
    <section
      id="catalog-table"
      className="catalog-card"
      aria-label="Catalogue des plantes"
    >
      {data.total === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">🌱</span>
          <h2>Aucune plante trouvée</h2>
          <p>
            {isFiltered
              ? 'Aucune plante ne correspond aux filtres appliqués.'
              : 'Le catalogue est vide pour le moment.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
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
                {data.items.map((plant) => (
                  <PlantRow key={plant.id} plant={plant} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            pageSize={data.pageSize}
            onChange={onPageChange}
          />
        </>
      )}
    </section>
  );
}
