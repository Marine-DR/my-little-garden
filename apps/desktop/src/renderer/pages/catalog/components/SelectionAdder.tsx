import { useMemo, useState } from 'react';
import type {
  SelectionPlantAdditionResult,
  SelectionSummary,
} from '@my-little-garden/core';
import listIcon from '@renderer/assets/list.svg';

const ADDITION_ERRORS = {
  no_selection: 'Choisissez une sélection.',
  no_plants: 'Sélectionnez au moins une plante.',
  selection_not_found:
    'Cette sélection n’existe plus. Fermez cette fenêtre et réessayez.',
  unknown_plants:
    'Une plante sélectionnée n’existe plus dans le catalogue. Actualisez la page et réessayez.',
} as const;

export function SelectionAdder({
  selectedPlantIds,
  onAdded,
}: {
  readonly selectedPlantIds: readonly string[];
  readonly onAdded: (
    result: Extract<SelectionPlantAdditionResult, { readonly ok: true }>,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selections, setSelections] = useState<
    readonly SelectionSummary[] | null
  >(null);
  const [selectedSelectionId, setSelectedSelectionId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const filteredSelections = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return (selections ?? []).filter((selection) =>
      selection.name.toLocaleLowerCase('fr').includes(query),
    );
  }, [search, selections]);

  const close = (): void => {
    if (adding) {
      return;
    }
    setOpen(false);
    setSelections(null);
    setSelectedSelectionId('');
    setSearch('');
    setError(null);
  };

  const openSelectionList = async (): Promise<void> => {
    setOpen(true);
    setSelections(null);
    setError(null);
    try {
      setSelections(await window.selectionService.listSelections());
    } catch {
      setSelections([]);
      setError('Les sélections n’ont pas pu être chargées.');
    }
  };

  const addPlants = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const result = await window.selectionService.addPlantsToSelection({
        selectionId: selectedSelectionId,
        plantIds: selectedPlantIds,
      });
      if (!result.ok) {
        setError(ADDITION_ERRORS[result.code]);
        return;
      }
      setOpen(false);
      setSelections(null);
      setSelectedSelectionId('');
      setSearch('');
      onAdded(result);
    } catch {
      setError('Les plantes n’ont pas pu être ajoutées à la sélection.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <button
        className="secondary-button"
        type="button"
        disabled={selectedPlantIds.length === 0}
        onClick={() => void openSelectionList()}
      >
        <span
          className="selection-add-icon"
          aria-hidden="true"
          style={{
            maskImage: `url("${listIcon}")`,
            WebkitMaskImage: `url("${listIcon}")`,
          }}
        />
        Ajouter à une sélection
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="selection-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="selection-add-modal-title"
          >
            <div className="selection-modal-heading">
              <h2 id="selection-add-modal-title">Ajouter à une sélection</h2>
              <button
                type="button"
                aria-label="Fermer l’ajout à une sélection"
                disabled={adding}
                onClick={close}
              >
                ×
              </button>
            </div>
            <form onSubmit={(event) => void addPlants(event)}>
              <label htmlFor="selection-search">Rechercher une sélection</label>
              <input
                id="selection-search"
                type="search"
                placeholder="Rechercher une sélection..."
                value={search}
                disabled={adding || selections === null}
                onChange={(event) => setSearch(event.target.value)}
              />
              {selections === null ? (
                <p className="selection-list-status" role="status">
                  Chargement des sélections…
                </p>
              ) : selections.length === 0 && !error ? (
                <p className="selection-list-status">
                  Aucune sélection enregistrée.
                </p>
              ) : filteredSelections.length === 0 && !error ? (
                <p className="selection-list-status">
                  Aucune sélection ne correspond à cette recherche.
                </p>
              ) : (
                <fieldset className="selection-target-list">
                  <legend>Choisir la sélection</legend>
                  {filteredSelections.map((selection) => (
                    <label key={selection.id}>
                      <input
                        type="radio"
                        name="target-selection"
                        value={selection.id}
                        checked={selectedSelectionId === selection.id}
                        disabled={adding}
                        onChange={() => setSelectedSelectionId(selection.id)}
                      />
                      <span>{selection.name}</span>
                      <span className="selection-target-count">
                        {selection.plantCount}{' '}
                        {selection.plantCount === 1 ? 'plante' : 'plantes'}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              <p className="selection-add-summary">
                {selectedPlantIds.length}{' '}
                {selectedPlantIds.length === 1
                  ? 'plante sera'
                  : 'plantes seront'}{' '}
                ajoutée{selectedPlantIds.length === 1 ? '' : 's'} à cette
                sélection.
              </p>
              {error ? (
                <p className="selection-form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="selection-modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={adding}
                  onClick={close}
                >
                  Annuler
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={adding || !selectedSelectionId}
                >
                  {adding ? 'Ajout…' : 'Ajouter'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
