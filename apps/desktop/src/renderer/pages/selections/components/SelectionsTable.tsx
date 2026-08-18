import type { SelectionSummary } from '@my-little-garden/core';
import { PlantPhoto } from '@renderer/components/PlantPhoto';
import detailsIcon from '@renderer/assets/details.svg';
import { SelectionStatuses } from './SelectionStatus';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function SelectionPreview({
  selection,
}: {
  readonly selection: SelectionSummary;
}) {
  const hiddenPlants = Math.max(
    0,
    selection.plantCount - selection.previewPhotoUrls.length,
  );
  if (selection.previewPhotoUrls.length === 0) {
    return <span className="selection-preview-empty">-</span>;
  }
  return (
    <span className="selection-preview-list">
      {selection.previewPhotoUrls.map((url, index) => (
        <PlantPhoto
          key={`${selection.id}-${index}`}
          name={`${selection.name} aperçu ${index + 1}`}
          url={url}
        />
      ))}
      {hiddenPlants > 0 ? (
        <span
          className="selection-preview-more"
          aria-label={`${hiddenPlants} plantes non affichées`}
        >
          +{hiddenPlants}
        </span>
      ) : null}
    </span>
  );
}

function SelectionRow({
  selection,
  selected,
  onToggle,
  onViewDetails,
}: {
  readonly selection: SelectionSummary;
  readonly selected: boolean;
  readonly onToggle: (selectionId: string) => void;
  readonly onViewDetails: (selectionId: string) => void;
}) {
  return (
    <tr>
      <td className="plant-selection-cell">
        <input
          type="checkbox"
          aria-label={`Sélectionner ${selection.name}`}
          checked={selected}
          onChange={() => onToggle(selection.id)}
        />
      </td>
      <th scope="row" className="selection-name">
        {selection.name}
      </th>
      <td className="selection-preview-cell">
        <SelectionPreview selection={selection} />
      </td>
      <td>{selection.plantCount}</td>
      <td>
        <SelectionStatuses
          status={selection.status}
          modifiedPlantCount={selection.modifiedPlantCount}
          deletedPlantCount={selection.deletedPlantCount}
        />
      </td>
      <td>{formatDate(selection.createdAt)}</td>
      <td>{formatDate(selection.updatedAt)}</td>
      <td>
        <button
          type="button"
          className="secondary-button selection-details-button"
          aria-label={`Voir les détails de ${selection.name}`}
          title="Voir les détails"
          onClick={() => onViewDetails(selection.id)}
        >
          <img src={detailsIcon} alt="" />
        </button>
      </td>
    </tr>
  );
}

export function SelectionsTable({
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
  return (
    <section
      id="selections-table"
      className="catalog-card"
      aria-label="Sélections enregistrées"
    >
      {selections.length === 0 ? (
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
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Sélection</span>
                  <input
                    className="catalog-select-all"
                    type="checkbox"
                    aria-label={
                      selectedSelectionIds.length > 0
                        ? 'Désélectionner toutes les sélections'
                        : 'Sélectionner toutes les sélections'
                    }
                    checked={selectedSelectionIds.length > 0}
                    disabled={selectingAll}
                    onChange={onToggleAll}
                  />
                </th>
                <th scope="col">Nom</th>
                <th scope="col">Aperçu</th>
                <th scope="col">Plantes</th>
                <th scope="col">Statut</th>
                <th scope="col">Date de création</th>
                <th scope="col">Dernière modification</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {selections.map((selection) => (
                <SelectionRow
                  key={selection.id}
                  selection={selection}
                  selected={selectedSelectionIds.includes(selection.id)}
                  onToggle={onSelectionToggle}
                  onViewDetails={onViewDetails}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
