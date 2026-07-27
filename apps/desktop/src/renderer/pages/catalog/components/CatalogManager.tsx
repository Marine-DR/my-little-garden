import { useEffect, useRef, useState } from 'react';
import collapseIcon from '@renderer/assets/collapse.svg';
import expandIcon from '@renderer/assets/expand.svg';
import { useCloseOnOutsidePointer } from '@renderer/hooks/useCloseOnOutsidePointer';
import type { CatalogModifyImpactedSelection } from '@my-little-garden/core';

const CATALOG_UPDATE_ERROR =
  "Une erreur est survenue, le catalogue n'a pas pu être mis à jour.";

type PendingCatalogAction =
  | {
      readonly kind: 'add';
      readonly token: string;
      readonly plants: readonly string[];
      readonly impactedSelections: readonly CatalogModifyImpactedSelection[];
    }
  | {
      readonly kind: 'modify';
      readonly token: string;
      readonly plants: readonly string[];
      readonly impactedSelections: readonly CatalogModifyImpactedSelection[];
    };

export function CatalogManager({
  onReplaced,
  onSuccess,
  children,
}: {
  readonly onReplaced: () => void;
  readonly onSuccess: (message: string) => void;
  readonly children?: React.ReactNode;
}) {
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<PendingCatalogAction | null>(null);
  const [fileAction, setFileAction] = useState<
    'add' | 'modify' | 'replace' | null
  >(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useCloseOnOutsidePointer(menu, menuOpen, () => setMenuOpen(false));

  useEffect(() => {
    if (errors.length === 0) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setErrors([]), 60_000);
    return () => window.clearTimeout(timeout);
  }, [errors]);

  const replaceCatalog = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setImporting(true);
    setErrors([]);
    setMenuOpen(false);
    try {
      const result = await window.catalogManagementService.replaceCatalog(
        file.name,
        await file.text(),
      );
      if (!result.ok) {
        setErrors(result.errors.map(({ message }) => message));
        return;
      }
      onReplaced();
      onSuccess(
        `Le catalogue a été remplacé avec succès (${result.imported} fleurs importées).`,
      );
    } catch {
      setErrors(['Le fichier CSV n’a pas pu être importé.']);
    } finally {
      setImporting(false);
    }
  };

  const completeCatalogAction = async (
    action: PendingCatalogAction,
    policy:
      | 'update_existing'
      | 'ignore_existing'
      | 'create_missing'
      | 'ignore_missing',
  ): Promise<void> => {
    setImporting(true);
    try {
      const result =
        action.kind === 'add'
          ? await window.catalogManagementService.commitCatalogAddition(
              action.token,
              policy as 'update_existing' | 'ignore_existing',
            )
          : await window.catalogManagementService.commitCatalogModification(
              action.token,
              policy as 'create_missing' | 'ignore_missing',
            );
      if (!result.ok) {
        setErrors([CATALOG_UPDATE_ERROR]);
        return;
      }
      onReplaced();
      const details = [
        action.kind === 'add'
          ? `${result.created} ${result.created === 1 ? 'plante a été ajoutée' : 'plantes ont été ajoutées'} au catalogue.`
          : `${result.updated} ${result.updated === 1 ? 'plante a été mise à jour.' : 'plantes ont été mises à jour.'}`,
        result.updated > 0 && action.kind === 'add'
          ? `${result.updated} ${result.updated === 1 ? 'plante a été mise à jour' : 'plantes ont été mises à jour'}.`
          : action.kind === 'modify' && result.created > 0
            ? `${result.created} ${result.created === 1 ? 'plante a été créée.' : 'plantes ont été créées.'}`
            : '',
        action.kind === 'add' &&
        'alreadyExisted' in result &&
        result.alreadyExisted > 0
          ? `${result.alreadyExisted} ${result.alreadyExisted === 1 ? 'plante existait déjà' : 'plantes existaient déjà'}.`
          : '',
        result.notAdded > 0
          ? `${result.notAdded} ${result.notAdded === 1 ? 'plante n’a pas pu être ajoutée' : 'plantes n’ont pas pu être ajoutées'}.`
          : '',
      ].filter(Boolean);
      onSuccess(details.join(' '));
    } catch {
      setErrors([CATALOG_UPDATE_ERROR]);
    } finally {
      setPendingAction(null);
      setImporting(false);
    }
  };

  const addCatalog = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setImporting(true);
    setErrors([]);
    setMenuOpen(false);
    try {
      const preview =
        await window.catalogManagementService.previewCatalogAddition(
          file.name,
          await file.text(),
        );
      if (!preview.ok) {
        setErrors([CATALOG_UPDATE_ERROR]);
        return;
      }
      const action = {
        kind: 'add' as const,
        token: preview.token,
        plants: preview.conflicts,
        impactedSelections: preview.impactedSelections,
      };
      if (
        action.plants.length === 0 &&
        action.impactedSelections.length === 0
      ) {
        await completeCatalogAction(action, 'ignore_existing');
        return;
      }
      setPendingAction(action);
    } catch {
      setErrors([CATALOG_UPDATE_ERROR]);
    } finally {
      setImporting(false);
    }
  };

  const modifyCatalog = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setImporting(true);
    setErrors([]);
    setMenuOpen(false);
    try {
      const preview =
        await window.catalogManagementService.previewCatalogModification(
          file.name,
          await file.text(),
        );
      if (!preview.ok) {
        setErrors([CATALOG_UPDATE_ERROR]);
        return;
      }
      const action = {
        kind: 'modify' as const,
        token: preview.token,
        plants: preview.missing,
        impactedSelections: preview.impactedSelections,
      };
      if (
        action.plants.length === 0 &&
        action.impactedSelections.length === 0
      ) {
        await completeCatalogAction(action, 'ignore_missing');
        return;
      }
      setPendingAction(action);
    } catch {
      setErrors([CATALOG_UPDATE_ERROR]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="catalog-actions">
        <div ref={menu} className="catalog-menu">
          <button
            className="secondary-button"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="catalog-menu-options"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={importing}
          >
            <span aria-hidden="true">📄</span>
            Gérer le catalogue
            <img src={menuOpen ? collapseIcon : expandIcon} alt="" />
          </button>
          {menuOpen ? (
            <div id="catalog-menu-options" className="catalog-menu-options">
              <button
                type="button"
                onClick={() => {
                  setFileAction('add');
                  fileInput.current?.click();
                }}
              >
                <span aria-hidden="true">+</span>
                Ajouter des plantes depuis un CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setFileAction('modify');
                  fileInput.current?.click();
                }}
              >
                <span aria-hidden="true">✎</span>
                Modifier des plantes depuis un CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setFileAction('replace');
                  fileInput.current?.click();
                }}
              >
                <span aria-hidden="true">⮔</span>
                Remplacer tout le catalogue
              </button>
            </div>
          ) : null}
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              void (fileAction === 'add'
                ? addCatalog(event)
                : fileAction === 'modify'
                  ? modifyCatalog(event)
                  : replaceCatalog(event))
            }
          />
        </div>
        {children}
      </div>
      {errors.length > 0 ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="error-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="import-error-title"
          >
            <div className="error-modal-heading">
              <h2 id="import-error-title">Le catalogue n’a pas été remplacé</h2>
              <button
                type="button"
                aria-label="Fermer le message d’erreur"
                onClick={() => setErrors([])}
              >
                ×
              </button>
            </div>
            <ul>
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
      {pendingAction?.kind === 'add' ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="error-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-add-conflicts-title"
          >
            <div className="error-modal-heading">
              <h2 id="catalog-add-conflicts-title">
                Les plantes suivantes existent dans le catalogue avec des
                caractéristiques différentes :
              </h2>
              <button
                type="button"
                aria-label="Fermer le conflit d’import"
                onClick={() => setPendingAction(null)}
              >
                ×
              </button>
            </div>
            <ul>
              {pendingAction.plants.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            {pendingAction.impactedSelections.length > 0 ? (
              <>
                <p>Certaines plantes sont utilisées dans des Sélections :</p>
                <ul>
                  {pendingAction.impactedSelections.map((selection) => (
                    <li key={selection.id}>
                      {selection.name} : {selection.plantNames.join(', ')}
                    </li>
                  ))}
                </ul>
                <p>
                  En cas de modification, les changements seront appliqués dans
                  le Catalogue et les Sélections concernées.
                </p>
              </>
            ) : null}
            <p>Que voulez-vous faire ?</p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={importing}
                onClick={() => setPendingAction(null)}
              >
                Annuler
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={importing}
                onClick={() =>
                  void completeCatalogAction(pendingAction, 'update_existing')
                }
              >
                Créer et modifier
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={importing}
                onClick={() =>
                  void completeCatalogAction(pendingAction, 'ignore_existing')
                }
              >
                Créer sans modifier
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {pendingAction?.kind === 'modify' ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="error-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-modify-missing-title"
          >
            <div className="error-modal-heading">
              <h2 id="catalog-modify-missing-title">
                {pendingAction.impactedSelections.length > 0
                  ? 'Des plantes modifiées sont utilisées dans des sélections'
                  : "Les plantes suivantes n'existent pas dans le catalogue"}
              </h2>
              <button
                type="button"
                aria-label="Fermer le conflit d’import"
                onClick={() => setPendingAction(null)}
              >
                ×
              </button>
            </div>
            {pendingAction.impactedSelections.length > 0 ? (
              <>
                <p>Certaines plantes sont utilisées dans des Sélections :</p>
                <ul>
                  {pendingAction.impactedSelections.map((selection) => (
                    <li key={selection.id}>
                      {selection.name} : {selection.plantNames.join(', ')}
                    </li>
                  ))}
                </ul>
                <p>
                  En cas de modification, les changements seront appliqués dans
                  le Catalogue et les Sélections concernées.
                </p>
              </>
            ) : null}
            {pendingAction.plants.length > 0 ? (
              <>
                <p>
                  Les plantes suivantes n&apos;existent pas dans le catalogue :
                </p>
                <ul>
                  {pendingAction.plants.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <p>Que voulez-vous faire ?</p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={importing}
                onClick={() => setPendingAction(null)}
              >
                Annuler
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={importing}
                onClick={() =>
                  void completeCatalogAction(pendingAction, 'create_missing')
                }
              >
                Créer et modifier
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={importing}
                onClick={() =>
                  void completeCatalogAction(pendingAction, 'ignore_missing')
                }
              >
                Modifier sans créer
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
