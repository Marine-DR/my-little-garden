import { useEffect, useState } from 'react';
import type { SelectionDetails } from '@my-little-garden/core';
import { Pagination } from '@renderer/components/Pagination';
import { PlantsTable } from '@renderer/components/PlantsTable';

const PLANTS_PER_PAGE = 25;

export function SelectionDetailsPage({
  selectionId,
  onBack,
}: {
  readonly selectionId: string;
  readonly onBack: () => void;
}) {
  const [selection, setSelection] = useState<SelectionDetails | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    window.catalogApi
      .getSelection(selectionId)
      .then((result) => {
        if (active) {
          setSelection(result);
          setLoaded(true);
          setError(
            result
              ? null
              : 'Cette sélection n’existe plus ou est indisponible.',
          );
        }
      })
      .catch(() => {
        if (active) {
          setLoaded(true);
          setError('Les détails de la sélection n’ont pas pu être chargés.');
        }
      });
    return () => {
      active = false;
    };
  }, [selectionId]);

  const plantCount = selection?.plants.length ?? 0;
  const visiblePlants =
    selection?.plants.slice(
      (page - 1) * PLANTS_PER_PAGE,
      page * PLANTS_PER_PAGE,
    ) ?? [];

  return (
    <>
      <section
        className="catalog-toolbar selection-detail-toolbar"
        aria-labelledby="selection-detail-title"
      >
        <div className="catalog-toolbar-main">
          <div className="catalog-search-group">
            <h1 id="selection-detail-title">
              {selection?.name ?? 'Détail de la sélection'}
            </h1>
            {selection ? (
              <p className="selection-detail-count">
                {plantCount} {plantCount === 1 ? 'plante' : 'plantes'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer le détail de la sélection"
            title="Retour à Mes Sélections"
            onClick={onBack}
          >
            ×
          </button>
        </div>
      </section>
      <div
        className="catalog-actions selections-administration-space"
        aria-hidden="true"
      />
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {!loaded ? (
        <div className="loading" role="status">
          Chargement de la sélection…
        </div>
      ) : null}
      {selection ? (
        <section
          id="selection-detail-table"
          className="catalog-card"
          aria-label={`Plantes de ${selection.name}`}
        >
          {selection.plants.length === 0 ? (
            <div className="empty-state">
              <span aria-hidden="true">🌱</span>
              <h2>Aucune plante dans cette sélection</h2>
              <p>Cette sélection ne contient actuellement aucune plante.</p>
            </div>
          ) : (
            <>
              <PlantsTable plants={visiblePlants} />
              <Pagination
                page={page}
                total={selection.plants.length}
                pageSize={PLANTS_PER_PAGE}
                onChange={setPage}
                itemLabel="plantes"
                footerLabel="Pagination des plantes de la sélection"
                pagesLabel="Pages des plantes de la sélection"
              />
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
