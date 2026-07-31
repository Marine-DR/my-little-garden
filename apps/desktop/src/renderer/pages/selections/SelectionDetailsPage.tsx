import { useEffect, useState } from 'react';
import type { SelectionDetails } from '@my-little-garden/core';
import removeIcon from '@renderer/assets/sup.svg';
import { Pagination } from '@renderer/components/Pagination';
import { PlantsTable } from '@renderer/components/PlantsTable';
import { SelectionStatus } from './components/SelectionStatus';

const PLANTS_PER_PAGE = 25;

export function SelectionDetailsPage({
  selectionId,
  onBack,
  onUpdated,
}: {
  readonly selectionId: string;
  readonly onBack: () => void;
  readonly onUpdated: () => void;
}) {
  const [selection, setSelection] = useState<SelectionDetails | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedPlantIds, setSelectedPlantIds] = useState<readonly string[]>(
    [],
  );
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [modifiedDetailsOpen, setModifiedDetailsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    window.selectionService
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

  const togglePlant = (plantId: string): void => {
    setSelectedPlantIds((current) =>
      current.includes(plantId)
        ? current.filter((id) => id !== plantId)
        : [...current, plantId],
    );
  };

  const toggleAll = (): void => {
    setSelectedPlantIds((current) =>
      current.length > 0 ? [] : (selection?.plants.map(({ id }) => id) ?? []),
    );
  };

  const removePlants = async (): Promise<void> => {
    setRemoving(true);
    setError(null);
    try {
      const result = await window.selectionService.removePlantsFromSelection(
        selectionId,
        selectedPlantIds,
      );
      if (!result) {
        setError('Cette sélection n’existe plus ou est indisponible.');
        return;
      }
      setSelection(result);
      setSelectedPlantIds([]);
      setConfirmationOpen(false);
      setPage((current) =>
        Math.min(
          current,
          Math.max(1, Math.ceil(result.plants.length / PLANTS_PER_PAGE)),
        ),
      );
      onUpdated();
    } catch {
      setError('Les plantes n’ont pas pu être retirées de la sélection.');
    } finally {
      setRemoving(false);
    }
  };

  const selectedCount = selectedPlantIds.length;

  const acknowledgeModifiedPlants = async (): Promise<void> => {
    setAcknowledging(true);
    try {
      const result =
        await window.selectionService.acknowledgeModifiedPlants(selectionId);
      if (result) {
        setSelection(result);
        setModifiedDetailsOpen(false);
        onUpdated();
      }
    } catch {
      setError('Les modifications n’ont pas pu être acquittées.');
    } finally {
      setAcknowledging(false);
    }
  };

  const acknowledgeDeletedPlants = async (): Promise<void> => {
    setAcknowledging(true);
    try {
      const result =
        await window.selectionService.acknowledgeDeletedPlants(selectionId);
      if (result) {
        setSelection(result);
        onUpdated();
      }
    } catch {
      setError('Les suppressions n’ont pas pu être acquittées.');
    } finally {
      setAcknowledging(false);
    }
  };

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
              <div className="selection-detail-metadata">
                <p className="selection-detail-count">
                  {plantCount} {plantCount === 1 ? 'plante' : 'plantes'}
                </p>
                <SelectionStatus
                  status={selection.status}
                  modifiedPlantCount={selection.modifiedPlantCount}
                  deletedPlantCount={selection.deletedPlantCount}
                />
              </div>
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
      <section
        className="selection-actions selection-detail-actions"
        aria-label="Gestion de la sélection de fleurs"
      >
        <span className="selection-count">
          <span className="selection-count-number">{selectedCount}</span>{' '}
          {selectedCount === 1
            ? 'plante sélectionnée'
            : 'plantes sélectionnées'}
        </span>
        <div className="selection-action-buttons">
          <button
            type="button"
            className="delete-button"
            disabled={selectedCount === 0 || removing}
            onClick={() => setConfirmationOpen(true)}
          >
            <img src={removeIcon} alt="" />
            Retirer de la sélection
          </button>
        </div>
      </section>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {selection && selection.deletedPlants.length > 0 ? (
        <section className="selection-deleted-message" role="alert">
          <div>
            <strong>
              {selection.deletedPlants.length === 1
                ? '1 plante supprimée du catalogue'
                : `${selection.deletedPlants.length} plantes supprimées du catalogue`}
            </strong>
            <ul>
              {selection.deletedPlants.map((plant) => (
                <li key={plant.id}>{plant.name}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer le message des plantes supprimées"
            disabled={acknowledging}
            onClick={() => void acknowledgeDeletedPlants()}
          >
            ×
          </button>
        </section>
      ) : null}
      {selection && selection.modifiedPlants.length > 0 ? (
        <section className="selection-modified-message" role="alert">
          <div>
            <strong>
              {selection.modifiedPlants.length === 1
                ? '1 plante modifiée'
                : `${selection.modifiedPlants.length} plantes modifiées`}
            </strong>
          </div>
          <div className="selection-modified-message-actions">
            <button
              type="button"
              className="selection-modified-details-button"
              onClick={() => setModifiedDetailsOpen(true)}
            >
              <svg
                className="selection-modified-details-icon"
                aria-hidden="true"
                viewBox="0 0 9.525 9.525"
              >
                <path d="M .938 4.756c2.35 2.313 4.779 3.472 7.523.011" />
                <path d="M .915 4.742C3.265 2.429 5.694 1.27 8.438 4.73" />
                <ellipse cx="4.739" cy="4.733" rx="1.092" ry=".995" />
              </svg>
              Détails
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Fermer le message des plantes modifiées"
              disabled={acknowledging}
              onClick={() => void acknowledgeModifiedPlants()}
            >
              ×
            </button>
          </div>
        </section>
      ) : null}
      {modifiedDetailsOpen && selection ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="selection-modal selection-modified-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modified-plants-details-title"
          >
            <div className="selection-modal-heading">
              <h2 id="modified-plants-details-title">
                Modifications du catalogue
              </h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Fermer le détail des plantes modifiées"
                disabled={acknowledging}
                onClick={() => void acknowledgeModifiedPlants()}
              >
                ×
              </button>
            </div>
            {selection.modifiedPlants.map((plant) => (
              <section key={plant.id} className="modified-plant-comparison">
                <h3>{plant.name}</h3>
                {plant.attributes.length === 0 ? (
                  <p>Les valeurs précédentes ne sont pas disponibles.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Attribut</th>
                        <th>Avant</th>
                        <th>Après</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plant.attributes.map((attribute) => (
                        <tr key={attribute.label}>
                          <th scope="row">{attribute.label}</th>
                          <td>{attribute.before}</td>
                          <td>{attribute.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))}
          </section>
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
              <PlantsTable
                plants={visiblePlants}
                selection={{
                  selectedPlantIds,
                  onPlantToggle: togglePlant,
                  selectingAll: removing,
                  onToggleAll: toggleAll,
                  selectAllLabel:
                    'Sélectionner toutes les plantes de la sélection',
                  deselectAllLabel:
                    'Désélectionner toutes les plantes de la sélection',
                }}
              />
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
      {confirmationOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="selection-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-plants-title"
            aria-describedby="remove-plants-description"
          >
            <div className="selection-modal-heading">
              <h2 id="remove-plants-title">
                Retirer {selectedCount}{' '}
                {selectedCount === 1 ? 'plante' : 'plantes'} de cette sélection
                ?
              </h2>
            </div>
            <p id="remove-plants-description">
              {selectedCount === 1
                ? 'La plante restera dans le catalogue.'
                : 'Les plantes resteront dans le catalogue.'}
            </p>
            <div className="selection-modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={removing}
                onClick={() => setConfirmationOpen(false)}
              >
                Annuler
              </button>
              <button
                className="delete-button"
                type="button"
                disabled={removing}
                onClick={() => void removePlants()}
              >
                <img src={removeIcon} alt="" />
                {removing ? 'Retrait…' : 'Retirer'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
