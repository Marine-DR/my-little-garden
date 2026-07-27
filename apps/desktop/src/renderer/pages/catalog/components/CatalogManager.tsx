import { useEffect, useRef, useState } from 'react';
import collapseIcon from '@renderer/assets/collapse.svg';
import expandIcon from '@renderer/assets/expand.svg';
import { useCloseOnOutsidePointer } from '@renderer/hooks/useCloseOnOutsidePointer';

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
  const [additionToken, setAdditionToken] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<readonly string[]>([]);
  const [fileAction, setFileAction] = useState<'add' | 'replace' | null>(null);
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

  const completeAddition = async (
    token: string,
    policy: 'update_existing' | 'ignore_existing',
  ): Promise<void> => {
    setImporting(true);
    try {
      const result =
        await window.catalogManagementService.commitCatalogAddition(
          token,
          policy,
        );
      if (!result.ok) {
        setErrors([
          "Une erreur est survenue, le catalogue n'a pas pu être mis à jour.",
        ]);
        return;
      }
      onReplaced();
      const details = [
        `${result.created} ${result.created === 1 ? 'plante a été ajoutée' : 'plantes ont été ajoutées'} au catalogue.`,
        result.updated > 0
          ? `${result.updated} ${result.updated === 1 ? 'plante a été mise à jour' : 'plantes ont été mises à jour'}.`
          : '',
        result.alreadyExisted > 0
          ? `${result.alreadyExisted} ${result.alreadyExisted === 1 ? 'plante existait déjà' : 'plantes existaient déjà'}.`
          : '',
        result.notAdded > 0
          ? `${result.notAdded} ${result.notAdded === 1 ? 'plante n’a pas pu être ajoutée' : 'plantes n’ont pas pu être ajoutées'}.`
          : '',
      ].filter(Boolean);
      onSuccess(details.join(' '));
    } catch {
      setErrors([
        "Une erreur est survenue, le catalogue n'a pas pu être mis à jour.",
      ]);
    } finally {
      setAdditionToken(null);
      setConflicts([]);
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
        setErrors([
          "Une erreur est survenue, le catalogue n'a pas pu être mis à jour.",
        ]);
        return;
      }
      if (preview.conflicts.length === 0) {
        await completeAddition(preview.token, 'ignore_existing');
        return;
      }
      setAdditionToken(preview.token);
      setConflicts(preview.conflicts);
    } catch {
      setErrors([
        "Une erreur est survenue, le catalogue n'a pas pu être mis à jour.",
      ]);
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
      {additionToken ? (
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
                caractéristiques différentes
              </h2>
              <button
                type="button"
                aria-label="Fermer le conflit d’import"
                onClick={() => {
                  setAdditionToken(null);
                  setConflicts([]);
                }}
              >
                ×
              </button>
            </div>
            <ul>
              {conflicts.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p>Que voulez-vous faire ?</p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={importing}
                onClick={() =>
                  void completeAddition(additionToken, 'ignore_existing')
                }
              >
                Ne pas mettre à jour
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={importing}
                onClick={() =>
                  void completeAddition(additionToken, 'update_existing')
                }
              >
                Mettre à jour
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
