import { useEffect, useState } from 'react';
import type { CatalogPage } from '../shared/catalog';
import appIcon from './assets/app-icon.png';
import flowerbedIcon from './assets/flowerbed.png';
import listIcon from './assets/list.svg';
import { CatalogTable } from './CatalogTable';
import { CatalogManager } from './CatalogManager';
import { ImageManager } from './ImageManager';

export function App() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    if (!success) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setSuccess(null), 60_000);
    return () => window.clearTimeout(timeout);
  }, [success]);

  const changePage = (nextPage: number): void => {
    setError(null);
    setPage(nextPage);
  };

  const refreshPage = async (): Promise<void> => {
    const catalog = await window.catalogApi.listPlants(page);
    setData(catalog);
    setError(null);
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
        <CatalogManager
          onSuccess={setSuccess}
          onReplaced={(catalog) => {
            setPage(1);
            setData(catalog);
            setError(null);
          }}
        >
          <ImageManager
            onImported={() => void refreshPage()}
            onSuccess={setSuccess}
          />
        </CatalogManager>
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
        {error ? (
          <div className="error-banner" role="alert">
            {error}
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
