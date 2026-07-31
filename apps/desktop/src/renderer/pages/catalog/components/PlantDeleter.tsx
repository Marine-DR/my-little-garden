import { useState } from 'react';
import type { PlantDeletionPreviewResult } from '@my-little-garden/core';
import deleteIcon from '@renderer/assets/sup.svg';

type Preview = Extract<PlantDeletionPreviewResult, { readonly ok: true }>;

export function PlantDeleter({
  selectedPlantIds,
  onDeleted,
  onError,
}: {
  readonly selectedPlantIds: readonly string[];
  readonly onDeleted: (
    deletedPlantCount: number,
    affectedSelectionCount: number,
  ) => void;
  readonly onError: (message: string) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openConfirmation = async (): Promise<void> => {
    setLoading(true);
    try {
      const result =
        await window.catalogManagementService.previewPlantDeletion(
          selectedPlantIds,
        );
      if (!result.ok) {
        onError(
          result.code === 'plants_not_found'
            ? 'Certaines plantes sélectionnées n’existent plus.'
            : 'Sélectionnez au moins une plante à supprimer.',
        );
        return;
      }
      setPreview(result);
    } catch {
      onError('La suppression n’a pas pu être préparée.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeletion = async (): Promise<void> => {
    setDeleting(true);
    try {
      const result =
        await window.catalogManagementService.deletePlants(selectedPlantIds);
      if (!result.ok) {
        onError(
          result.code === 'plants_not_found'
            ? 'Certaines plantes sélectionnées n’existent plus. Le catalogue n’a pas été modifié.'
            : 'Sélectionnez au moins une plante à supprimer.',
        );
        setPreview(null);
        return;
      }
      setPreview(null);
      onDeleted(result.deletedPlantCount, result.affectedSelectionCount);
    } catch {
      onError('Les plantes n’ont pas pu être supprimées du catalogue.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="delete-button"
        disabled={selectedPlantIds.length === 0 || loading || deleting}
        onClick={() => void openConfirmation()}
      >
        <img src={deleteIcon} alt="" />
        {loading ? 'Préparation…' : 'Supprimer'}
      </button>
      {preview ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="selection-modal plant-deletion-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="plant-deletion-title"
          >
            <div className="selection-modal-heading">
              <h2 id="plant-deletion-title">
                Supprimer {preview.plants.length}{' '}
                {preview.plants.length === 1 ? 'plante' : 'plantes'} du
                catalogue ?
              </h2>
            </div>
            <ul className="plant-deletion-list">
              {preview.plants.map((plant) => (
                <li key={plant.id}>{plant.name}</li>
              ))}
            </ul>
            {preview.impactedSelections.length > 0 ? (
              <section className="plant-deletion-impacts">
                <p className="plant-deletion-warning" role="alert">
                  Certaines plantes sont utilisées dans des sélections. Leur
                  suppression les retirera également de ces sélections.
                </p>
                <h3>Sélections concernées</h3>
                {preview.impactedSelections.map((selection) => (
                  <div key={selection.id}>
                    <strong>{selection.name}</strong>
                    <ul>
                      {selection.plantNames.map((plantName) => (
                        <li key={plantName}>{plantName}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ) : null}
            <div className="selection-modal-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={deleting}
                onClick={() => setPreview(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="delete-button"
                disabled={deleting}
                onClick={() => void confirmDeletion()}
              >
                <img src={deleteIcon} alt="" />
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
