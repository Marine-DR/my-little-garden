import { useEffect, useRef, useState } from 'react';
import type { CatalogPage } from '../shared/catalog';
import collapseIcon from './assets/collapse.svg';
import expandIcon from './assets/expand.svg';

export function CatalogManager({
  onReplaced,
}: {
  readonly onReplaced: (catalog: CatalogPage) => void;
}) {
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!success) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setSuccess(null), 60_000);
    return () => window.clearTimeout(timeout);
  }, [success]);

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
    setSuccess(null);
    setMenuOpen(false);
    try {
      const result = await window.catalogApi.replaceCatalog(
        file.name,
        await file.text(),
      );
      if (!result.ok) {
        setErrors(result.errors.map(({ message }) => message));
        return;
      }
      onReplaced(await window.catalogApi.listPlants(1));
      setSuccess(
        `Le catalogue a été remplacé avec succès (${result.imported} fleurs importées).`,
      );
    } catch {
      setErrors(['Le fichier CSV n’a pas pu être importé.']);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="catalog-actions">
        <div className="catalog-menu">
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
              <button type="button" onClick={() => fileInput.current?.click()}>
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
            onChange={(event) => void replaceCatalog(event)}
          />
        </div>
      </div>
      {success ? (
        <div className="success-banner" role="status">
          <span>{success}</span>
          <button
            type="button"
            aria-label="Fermer le message de succès"
            onClick={() => setSuccess(null)}
          >
            ×
          </button>
        </div>
      ) : null}
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
    </>
  );
}
