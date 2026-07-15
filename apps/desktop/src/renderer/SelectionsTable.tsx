import type { SelectionSummary } from '../shared/catalog';
import { PlantPhoto } from './PlantPhoto';

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

function formatStatus(selection: SelectionSummary): string {
  if (selection.deletedPlantsCount > 0) {
    return `${selection.deletedPlantsCount} plantes supprimées`;
  }
  if (selection.modifiedPlantsCount > 0) {
    return `${selection.modifiedPlantsCount} plantes modifiées`;
  }
  return 'à jour';
}

function formatUsage(selection: SelectionSummary): string {
  if (selection.flowerbedCount === 0) {
    return 'Non utilisé';
  }
  return `${selection.flowerbedCount} parterres`;
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

function SelectionRow({ selection }: { readonly selection: SelectionSummary }) {
  return (
    <tr>
      <th scope="row" className="selection-name">
        {selection.name}
      </th>
      <td>
        <SelectionPreview selection={selection} />
      </td>
      <td>{selection.plantCount}</td>
      <td>{formatStatus(selection)}</td>
      <td>{formatUsage(selection)}</td>
      <td>{formatDate(selection.createdAt)}</td>
      <td>{formatDate(selection.updatedAt)}</td>
    </tr>
  );
}

export function SelectionsTable({
  selections,
  onBackToCatalog,
}: {
  readonly selections: readonly SelectionSummary[];
  readonly onBackToCatalog: () => void;
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
                <th scope="col">Nom</th>
                <th scope="col">Aperçu</th>
                <th scope="col">Plantes</th>
                <th scope="col">Statut</th>
                <th scope="col">Utilisation</th>
                <th scope="col">Date de création</th>
                <th scope="col">Dernière modification</th>
              </tr>
            </thead>
            <tbody>
              {selections.map((selection) => (
                <SelectionRow key={selection.id} selection={selection} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
