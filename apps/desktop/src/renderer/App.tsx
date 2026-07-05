import { useEffect, useState } from 'react';
import type { CatalogPage } from '../shared/catalog';
import appIcon from './assets/app-icon.png';
import flowerbedIcon from './assets/flowerbed.png';
import listIcon from './assets/list.svg';
import { CatalogTable } from './CatalogTable';

export function App() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogPage | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setPage(nextPage);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#catalog-heading"
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
