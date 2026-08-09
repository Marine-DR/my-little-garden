import { useEffect, useState } from 'react';
import type { SelectionSummary } from '@my-little-garden/core';
import { SelectionsTable } from './components/SelectionsTable';
import { SelectionDetailsPage } from './SelectionDetailsPage';
import deleteIcon from '@renderer/assets/sup.svg';

export function SelectionsPage({
  onBackToCatalog,
}: {
  readonly onBackToCatalog: () => void;
}) {
  const [selections, setSelections] = useState<
    readonly SelectionSummary[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSelectionId, setSelectedSelectionId] = useState<string | null>(
    null,
  );
  const [selectedSelectionIds, setSelectedSelectionIds] = useState<
    readonly string[]
  >([]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    window.selectionService
      .listSelections()
      .then((result) => {
        if (active) {
          setSelections(result);
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError('Les sélections n’ont pas pu être chargées.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (selectedSelectionId) {
    return (
      <SelectionDetailsPage
        selectionId={selectedSelectionId}
        onBack={() => setSelectedSelectionId(null)}
        onUpdated={() => {
          void window.selectionService
            .listSelections()
            .then(setSelections)
            .catch(() =>
              setError('Les sélections n’ont pas pu être chargées.'),
            );
        }}
      />
    );
  }

  const selectedSelections =
    selections?.filter(({ id }) => selectedSelectionIds.includes(id)) ?? [];
  const selectedCount = selectedSelections.length;

  const toggleSelection = (selectionId: string): void => {
    setSelectedSelectionIds((current) =>
      current.includes(selectionId)
        ? current.filter((id) => id !== selectionId)
        : [...current, selectionId],
    );
  };

  const toggleAllSelections = (): void => {
    setSelectedSelectionIds((current) =>
      current.length > 0 ? [] : (selections?.map(({ id }) => id) ?? []),
    );
  };

  const deleteSelections = async (): Promise<void> => {
    setDeleting(true);
    setError(null);
    try {
      await window.selectionService.deleteSelections(selectedSelectionIds);
      setSelections(await window.selectionService.listSelections());
      setSelectedSelectionIds([]);
      setConfirmationOpen(false);
    } catch {
      setError('Les sélections n’ont pas pu être supprimées.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <section className="catalog-toolbar" aria-labelledby="selections-title">
        <div className="catalog-toolbar-main">
          <div className="catalog-search-group">
            <h1 id="selections-title">Mes Sélections</h1>
          </div>
        </div>
      </section>
      <section
        className="selection-actions selections-administration-space selections-list-actions"
        aria-label="Actions des sélections"
      >
        <span className="selection-count">
          <span className="selection-count-number">{selectedCount}</span>{' '}
          {selectedCount === 1
            ? 'sélection sélectionnée'
            : 'sélections sélectionnées'}
        </span>
        <button
          type="button"
          className="delete-button"
          disabled={selectedCount === 0 || deleting}
          onClick={() => setConfirmationOpen(true)}
        >
          <img src={deleteIcon} alt="" />
          Supprimer
        </button>
      </section>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {!selections && !error ? (
        <div className="loading" role="status">
          Chargement des sélections…
        </div>
      ) : null}
      {selections ? (
        <SelectionsTable
          selections={selections}
          selectedSelectionIds={selectedSelectionIds}
          onSelectionToggle={toggleSelection}
          onToggleAll={toggleAllSelections}
          selectingAll={deleting}
          onBackToCatalog={onBackToCatalog}
          onViewDetails={setSelectedSelectionId}
        />
      ) : null}
      {confirmationOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="selection-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="selection-deletion-title"
          >
            <div className="selection-modal-heading">
              <h2 id="selection-deletion-title">
                Supprimer {selectedCount}{' '}
                {selectedCount === 1 ? 'sélection' : 'sélections'} ?
              </h2>
            </div>
            <ul className="plant-deletion-list">
              {selectedSelections.map((selection) => (
                <li key={selection.id}>{selection.name}</li>
              ))}
            </ul>
            <div className="selection-modal-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={deleting}
                onClick={() => setConfirmationOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="delete-button"
                disabled={deleting}
                onClick={() => void deleteSelections()}
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
