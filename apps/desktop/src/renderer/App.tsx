import { useEffect, useState } from 'react';
import type {
  CatalogFilterOptions,
  CatalogFilters,
  CatalogPage,
  SelectionSummary,
} from '@my-little-garden/core';
import appIcon from './assets/app-icon.png';
import catalogIcon from './assets/catalog.svg';
import flowerbedIcon from './assets/flowerbed.png';
import listIcon from './assets/list.svg';
import { CatalogTable } from './CatalogTable';
import { CatalogManager } from './CatalogManager';
import { CatalogFiltersPanel, EMPTY_FILTERS } from './CatalogFiltersPanel';
import { ImageManager } from './ImageManager';
import { SelectionsTable } from './SelectionsTable';

type AppScreen = 'catalog' | 'selections';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('catalog');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogPage | null>(null);
  const [selections, setSelections] = useState<
    readonly SelectionSummary[] | null
  >(null);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] =
    useState<CatalogFilterOptions | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
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
    if (screen !== 'selections') {
      return undefined;
    }
    let active = true;
    window.catalogApi
      .listSelections()
      .then((result) => {
        if (active) {
          setSelections(result);
          setSelectionError(null);
        }
      })
      .catch(() => {
        if (active) {
          setSelectionError('Les sélections n’ont pas pu être chargées.');
        }
      });
    return () => {
      active = false;
    };
  }, [screen]);

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

  const showCatalog = (): void => {
    setScreen('catalog');
    setSelectionError(null);
  };

  const showSelections = (): void => {
    setScreen('selections');
    setSelections(null);
    setFilterPanelOpen(false);
    setSelectionError(null);
  };

  const isCatalogScreen = screen === 'catalog';

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
          <button
            type="button"
            onClick={isCatalogScreen ? showSelections : showCatalog}
          >
            <img src={isCatalogScreen ? listIcon : catalogIcon} alt="" />
            {isCatalogScreen ? 'Mes Sélections' : 'Mon Catalogue'}
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
              <h1 id="catalog-title">
                {isCatalogScreen ? 'Mon Catalogue' : 'Mes Sélections'}
              </h1>
              {isCatalogScreen ? (
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
              ) : null}
            </div>
          </div>
        </section>
        {isCatalogScreen ? (
          <CatalogManager
            onSuccess={setSuccess}
            onReplaced={() => void refreshAfterCatalogReplacement()}
          >
            <ImageManager
              onImported={() => void refreshPage()}
              onSuccess={setSuccess}
            />
          </CatalogManager>
        ) : null}
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
        {isCatalogScreen && error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}
        {!isCatalogScreen && selectionError ? (
          <div className="error-banner" role="alert">
            {selectionError}
          </div>
        ) : null}
        {isCatalogScreen && !data && !error ? (
          <div className="loading" role="status">
            Chargement du catalogue…
          </div>
        ) : null}
        {!isCatalogScreen && !selections && !selectionError ? (
          <div className="loading" role="status">
            Chargement des sélections…
          </div>
        ) : null}
        {isCatalogScreen && data ? (
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
        {!isCatalogScreen && selections ? (
          <SelectionsTable
            selections={selections}
            onBackToCatalog={showCatalog}
          />
        ) : null}
      </main>
    </div>
  );
}
