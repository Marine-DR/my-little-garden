import { useEffect, useState } from 'react';
import type {
  CatalogFilterOptions,
  CatalogFilters,
  CatalogPage as CatalogPageData,
} from '@my-little-garden/core';
import {
  CatalogFiltersPanel,
  EMPTY_FILTERS,
} from './components/CatalogFiltersPanel';
import { CatalogManager } from './components/CatalogManager';
import { CatalogTable } from './components/CatalogTable';
import { ImageManager } from './components/ImageManager';

export function CatalogPage({
  onSuccess,
}: {
  readonly onSuccess: (message: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogPageData | null>(null);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] =
    useState<CatalogFilterOptions | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <>
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
        onSuccess={onSuccess}
        onReplaced={() => void refreshAfterCatalogReplacement()}
      >
        <ImageManager
          onImported={() => void refreshPage()}
          onSuccess={onSuccess}
        />
      </CatalogManager>
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
    </>
  );
}
