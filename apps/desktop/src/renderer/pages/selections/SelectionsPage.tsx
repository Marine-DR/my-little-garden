import { useEffect, useRef, useState } from 'react';
import type { SelectionSummary } from '@my-little-garden/core';
import { SelectionsTable } from './components/SelectionsTable';
import { SelectionsCards } from './components/SelectionsCards';
import { SelectionDetailsPage } from './SelectionDetailsPage';
import cardIcon from '@renderer/assets/card.svg';
import collapseIcon from '@renderer/assets/collapse.svg';
import deleteIcon from '@renderer/assets/sup.svg';
import expandIcon from '@renderer/assets/expand.svg';
import tableIcon from '@renderer/assets/table.svg';
import { useCloseOnOutsidePointer } from '@renderer/hooks/useCloseOnOutsidePointer';

type SelectionPresentation = 'cards' | 'table';
const presentationStorageKey = 'my-little-garden:selections-presentation';

function storedPresentation(): SelectionPresentation {
  const value = window.localStorage.getItem(presentationStorageKey);
  return value === 'table' ? 'table' : 'cards';
}

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
  const [presentation, setPresentation] =
    useState<SelectionPresentation>(storedPresentation);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const presentationButton = useRef<HTMLButtonElement>(null);
  const presentationOptions = useRef<(HTMLButtonElement | null)[]>([]);
  const presentationMenu = useRef<HTMLDivElement>(null);

  useCloseOnOutsidePointer(presentationMenu, presentationOpen, () =>
    setPresentationOpen(false),
  );

  const changePresentation = (value: SelectionPresentation): void => {
    window.localStorage.setItem(presentationStorageKey, value);
    setPresentation(value);
    setPresentationOpen(false);
    presentationButton.current?.focus();
  };

  useEffect(() => {
    if (presentationOpen) {
      presentationOptions.current[presentation === 'cards' ? 0 : 1]?.focus();
    }
  }, [presentation, presentationOpen]);

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
          <div ref={presentationMenu} className="selection-presentation-menu">
            <button
              ref={presentationButton}
              type="button"
              className="secondary-button"
              aria-expanded={presentationOpen}
              aria-haspopup="menu"
              aria-controls="selection-presentation-options"
              onClick={() => setPresentationOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setPresentationOpen(true);
                }
              }}
            >
              Présentation
              <img src={presentationOpen ? collapseIcon : expandIcon} alt="" />
            </button>
            {presentationOpen ? (
              <div
                id="selection-presentation-options"
                className="selection-presentation-options"
                role="menu"
                aria-label="Présentation"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setPresentationOpen(false);
                    presentationButton.current?.focus();
                  }
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const currentIndex = presentationOptions.current.indexOf(
                      document.activeElement as HTMLButtonElement,
                    );
                    const nextIndex =
                      currentIndex === 0 || event.key === 'ArrowUp' ? 1 : 0;
                    presentationOptions.current[nextIndex]?.focus();
                  }
                }}
              >
                {(['cards', 'table'] as const).map((value) => (
                  <button
                    key={value}
                    ref={(element) => {
                      presentationOptions.current[value === 'cards' ? 0 : 1] =
                        element;
                    }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={presentation === value}
                    onClick={() => changePresentation(value)}
                  >
                    <img
                      src={value === 'cards' ? cardIcon : tableIcon}
                      alt=""
                    />
                    {value === 'cards' ? 'Cartes' : 'Tableau'}
                  </button>
                ))}
              </div>
            ) : null}
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
      {selections && presentation === 'table' ? (
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
      {selections && presentation === 'cards' ? (
        <SelectionsCards
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
