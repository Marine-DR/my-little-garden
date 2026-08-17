import type { SelectionSummary } from '@my-little-garden/core';
import { PlantPhoto } from '@renderer/components/PlantPhoto';
import detailsIcon from '@renderer/assets/details.svg';
import { SelectionStatuses } from './SelectionStatus';

function SelectionCardPreview({
  selection,
}: {
  readonly selection: SelectionSummary;
}) {
  const hiddenPlants = Math.max(
    0,
    selection.plantCount - selection.previewPhotoUrls.length,
  );

  if (selection.previewPhotoUrls.length === 0) {
    return <span className="selection-card-preview-empty">🌿</span>;
  }

  return (
    <div className="selection-card-preview" aria-label="Aperçu des plantes">
      {selection.previewPhotoUrls.map((url, index) => (
        <PlantPhoto
          key={`${selection.id}-${index}`}
          name={`${selection.name} aperçu ${index + 1}`}
          url={url}
        />
      ))}
      {hiddenPlants > 0 ? (
        <span
          className="selection-card-preview-more"
          aria-label={`${hiddenPlants} plantes non affichées`}
        >
          +{hiddenPlants}
        </span>
      ) : null}
    </div>
  );
}

export function SelectionsCards({
  selections,
  selectedSelectionIds,
  onSelectionToggle,
  onToggleAll,
  selectingAll,
  onBackToCatalog,
  onViewDetails,
}: {
  readonly selections: readonly SelectionSummary[];
  readonly selectedSelectionIds: readonly string[];
  readonly onSelectionToggle: (selectionId: string) => void;
  readonly onToggleAll: () => void;
  readonly selectingAll: boolean;
  readonly onBackToCatalog: () => void;
  readonly onViewDetails: (selectionId: string) => void;
}) {
  if (selections.length === 0) {
    return (
      <section
        className="selection-cards-container"
        aria-label="Sélections enregistrées"
      >
        <div className="empty-state">
          <span aria-hidden="true">🌱</span>
          <h2>Aucune sélection enregistrée</h2>
          <p>
            Créez une sélection depuis le catalogue en choisissant des plantes.
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={onBackToCatalog}
          >
            Retour au catalogue
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="selection-cards-container"
      aria-label="Sélections enregistrées"
    >
      <div className="selection-cards-bulk-action">
        <input
          type="checkbox"
          className="catalog-select-all"
          aria-label={
            selectedSelectionIds.length > 0
              ? 'Désélectionner toutes les sélections'
              : 'Sélectionner toutes les sélections'
          }
          checked={selectedSelectionIds.length > 0}
          disabled={selectingAll}
          onChange={onToggleAll}
        />
        Sélectionner toutes les sélections
      </div>
      <div className="selection-cards-grid">
        {selections.map((selection) => (
          <article className="selection-card" key={selection.id}>
            <header className="selection-card-header">
              <input
                type="checkbox"
                aria-label={`Sélectionner ${selection.name}`}
                checked={selectedSelectionIds.includes(selection.id)}
                onChange={() => onSelectionToggle(selection.id)}
              />
              <h2 title={selection.name}>{selection.name}</h2>
            </header>
            <p className="selection-card-plant-count">
              {selection.plantCount}{' '}
              {selection.plantCount === 1 ? 'plante' : 'plantes'}
            </p>
            <SelectionCardPreview selection={selection} />
            <div className="selection-card-status">
              <SelectionStatuses
                status={selection.status}
                modifiedPlantCount={selection.modifiedPlantCount}
                deletedPlantCount={selection.deletedPlantCount}
              />
            </div>
            <button
              type="button"
              className="secondary-button selection-card-details-button"
              aria-label={`Voir les détails de ${selection.name}`}
              onClick={() => onViewDetails(selection.id)}
            >
              <img src={detailsIcon} alt="" />
              Détails
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
