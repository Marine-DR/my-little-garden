import type { CatalogPage, CatalogPlant } from '../shared/catalog';
import { PlantPhoto } from './PlantPhoto';
import { Pagination } from './Pagination';
import {
  EMPTY_VALUE, EXPOSURES, PERSISTENCE, formatBloom, formatKind,
  formatList, formatNumber, formatRange, formatSeasons,
} from './formatters';

function PlantRow({ plant }: { readonly plant: CatalogPlant }) {
  const persistence = plant.foliagePersistence ? PERSISTENCE[plant.foliagePersistence] : null;
  return (
    <tr>
      <td><PlantPhoto name={plant.name} url={plant.photoUrl} /></td>
      <th scope="row" className="plant-name">{plant.name}</th>
      <td>{formatRange(plant.heightMinCm, plant.heightMaxCm)}</td>
      <td>{plant.type ?? EMPTY_VALUE}</td>
      <td>{formatKind(plant.kind)}</td>
      <td>{formatList(plant.soils)}</td>
      <td className="icon-list">{plant.exposures.length === 0 ? EMPTY_VALUE : plant.exposures.map((code) => (
        <abbr key={code} title={EXPOSURES[code].label}>{EXPOSURES[code].icon}</abbr>
      ))}</td>
      <td>{formatBloom(plant.bloomStartMonth, plant.bloomEndMonth)}</td>
      <td>{formatList(plant.flowerColors)}</td>
      <td>{formatList(plant.leafColors)}</td>
      <td>{formatNumber(plant.minimumTemperatureCelsius)}</td>
      <td>{persistence ? <abbr title={persistence.label}>{persistence.icon}</abbr> : EMPTY_VALUE}</td>
      <td>{formatNumber(plant.spacingCm)}</td>
      <td>{formatSeasons(plant.plantingSeasons)}</td>
    </tr>
  );
}

export function CatalogTable({ data, onPageChange }: {
  readonly data: CatalogPage;
  readonly onPageChange: (page: number) => void;
}) {
  return (
    <section className="catalog-card" aria-labelledby="catalog-heading">
      <div className="catalog-heading">
        <h1 id="catalog-heading">Catalogue des plantes</h1>
        <p className="catalog-total">{data.total} {data.total > 1 ? 'plantes' : 'plante'}</p>
      </div>
      {data.total === 0 ? (
        <div className="empty-state"><span aria-hidden="true">🌱</span><h2>Aucune plante trouvée</h2><p>Le catalogue est vide pour le moment.</p></div>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th scope="col">Photo</th><th scope="col">Nom</th><th scope="col">Hauteur (cm)</th>
                <th scope="col">Type</th><th scope="col">Fleur/autre</th><th scope="col">Sol</th>
                <th scope="col">Exposition</th><th scope="col">Floraison</th><th scope="col">Couleurs fleurs</th>
                <th scope="col">Couleurs feuilles</th><th scope="col">Température min</th>
                <th scope="col">Feuillage persistant</th><th scope="col">Espace (cm)</th><th scope="col">Plantation</th>
              </tr></thead>
              <tbody>{data.items.map((plant) => <PlantRow key={plant.id} plant={plant} />)}</tbody>
            </table>
          </div>
          <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onChange={onPageChange} />
        </>
      )}
    </section>
  );
}
