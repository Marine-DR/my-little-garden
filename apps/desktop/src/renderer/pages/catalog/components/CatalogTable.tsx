import type { CatalogPage } from '@my-little-garden/core';
import downloadIcon from '@renderer/assets/download.svg';
import { Pagination } from '@renderer/components/Pagination';
import { PlantsTable } from '@renderer/components/PlantsTable';
import { downloadCatalogTemplate } from '../download-catalog-template';

export function CatalogTable({
  data,
  isFiltered,
  onPageChange,
  selectedPlantIds,
  onPlantToggle,
  selectingAll,
  onToggleAll,
}: {
  readonly data: CatalogPage;
  readonly isFiltered: boolean;
  readonly onPageChange: (page: number) => void;
  readonly selectedPlantIds: readonly string[];
  readonly onPlantToggle: (plantId: string) => void;
  readonly selectingAll: boolean;
  readonly onToggleAll: () => void;
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
          {!isFiltered ? (
            <div className="empty-catalog-download">
              <p>
                Téléchargez le modèle du catalogue pour ajouter vos premières
                plantes.
              </p>
              <button
                className="primary-button"
                type="button"
                onClick={() => void downloadCatalogTemplate()}
              >
                <img src={downloadIcon} alt="" />
                Télécharger le modèle du catalogue
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <PlantsTable
            plants={data.items}
            selection={{
              selectedPlantIds,
              onPlantToggle,
              selectingAll,
              onToggleAll,
            }}
          />
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
