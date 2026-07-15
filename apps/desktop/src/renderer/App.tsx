import { useEffect, useState } from 'react';
import type {
  CatalogFilterOptions,
  CatalogFilters,
  CatalogPage,
} from '../shared/catalog';
import appIcon from './assets/app-icon.png';
import flowerbedIcon from './assets/flowerbed.png';
import listIcon from './assets/list.svg';
import { CatalogTable } from './CatalogTable';
import { CatalogManager } from './CatalogManager';
import { CatalogFiltersPanel, EMPTY_FILTERS } from './CatalogFiltersPanel';
import { ImageManager } from './ImageManager';

export function App() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogPage | null>(null);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] =
    useState<CatalogFilterOptions | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.catalogApi
      .listPlants(page, filters)
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
  }, [filters, page]);

  useEffect(() => {
    let active = true;
    window.catalogApi
      .listFilterOptions()
      .then((options) => {
        if (active) {
          setFilterOptions(options);
        }
      })
      .catch(() => {
        if (active) {
          setFilterOptions(EMPTY_FILTERS);
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
    const catalog = await window.catalogApi.listPlants(page, filters);
    setData(catalog);
    setError(null);
  };

  const refreshAfterCatalogReplacement = async (): Promise<void> => {
    const [catalog, options] = await Promise.all([
      window.catalogApi.listPlants(1, filters),
      window.catalogApi.listFilterOptions(),
    ]);
    setPage(1);
    setData(catalog);
    setFilterOptions(options);
    setError(null);
  };

  const applyFilters = (nextFilters: CatalogFilters): void => {
    setFilters(nextFilters);
    setPage(1);
    setData(null);
    setError(null);
    setFilterPanelOpen(false);
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
        <section className="catalog-toolbar" aria-labelledby="catalog-title">
          <div className="catalog-toolbar-main">
            <div className="catalog-search-group">
              <h1 id="catalog-title">Mon Catalogue</h1>
              <div className="catalog-search-row">
                <CatalogFiltersPanel
                  open={filterPanelOpen}
                  filters={filters}
                  options={filterOptions}
                  onOpen={() => setFilterPanelOpen(true)}
                  onClose={() => setFilterPanelOpen(false)}
                  onApply={applyFilters}
                />
              </div>
            </div>
          </div>
        </section>
        <CatalogManager
          onSuccess={setSuccess}
          onReplaced={() => void refreshAfterCatalogReplacement()}
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
        {data ? (
          <CatalogTable
            data={data}
            isFiltered={
              filters.soils.length > 0 ||
              filters.exposures.length > 0 ||
              filters.bloomMonths.length > 0
            }
            onPageChange={changePage}
          />
        ) : null}
      </main>
    </div>
  );
}
