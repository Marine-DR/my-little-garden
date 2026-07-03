import { useEffect, useRef, useState } from 'react';
import type { CatalogPage } from '../shared/catalog';
import appIcon from './assets/app-icon.png';
import flowerbedIcon from './assets/flowerbed.png';
import listIcon from './assets/list.svg';
import { CatalogTable } from './CatalogTable';

export function App() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<readonly string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    window.catalogApi
      .listPlants(page)
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError('Le catalogue n’a pas pu être chargé.');
        }
      });
    return () => {
      active = false;
    };
  }, [page]);

  const changePage = (nextPage: number): void => {
    setError(null);
    setImportErrors([]);
    setPage(nextPage);
  };

  const replaceCatalog = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setError(null);
    setSuccess(null);
    setMenuOpen(false);
    try {
      const result = await window.catalogApi.replaceCatalog(
        file.name,
        await file.text(),
      );
      setPage(1);
      setData(await window.catalogApi.listPlants(1));
      setSuccess(
        `Le catalogue a été remplacé avec succès (${result.imported} fleurs importées).`,
      );
    } catch (caught) {
      const detail =
        caught instanceof Error
          ? caught.message.replace(
              /^Error invoking remote method '[^']+': Error: /u,
              '',
            )
          : '';
      setImportErrors(
        (detail || 'Le fichier CSV contient une erreur.')
          .split(/\r?\n/u)
          .filter(Boolean),
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#catalog-table"
          aria-label="MyLittleGarden, catalogue"
        >
          <img src={appIcon} alt="" />
          MyLittleGarden
        </a>
        <nav aria-label="Navigation principale">
          <button>
            <img src={listIcon} alt="" />
            Mes Sélections
          </button>
          <button>
            <img src={flowerbedIcon} alt="" />
            Mes Parterres
          </button>
        </nav>
      </header>
      <main>
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
              <span aria-hidden="true">{menuOpen ? '▲' : '▼'}</span>
            </button>
            {menuOpen ? (
              <div id="catalog-menu-options" className="catalog-menu-options">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
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
              onChange={(event) => void replaceCatalog(event)}
            />
          </div>
        </div>
        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="success-banner" role="status">
            {success}
          </div>
        ) : null}
        {importErrors.length > 0 ? (
          <div className="modal-backdrop" role="presentation">
            <section
              className="error-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="import-error-title"
            >
              <div className="error-modal-heading">
                <h2 id="import-error-title">
                  Le catalogue n’a pas été remplacé
                </h2>
                <button
                  type="button"
                  aria-label="Fermer le message d’erreur"
                  onClick={() => setImportErrors([])}
                >
                  ×
                </button>
              </div>
              <ul>
                {importErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
        {!data && !error ? (
          <div className="loading" role="status">
            Chargement du catalogue…
          </div>
        ) : null}
        {data ? <CatalogTable data={data} onPageChange={changePage} /> : null}
      </main>
    </div>
  );
}
