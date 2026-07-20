import { useEffect, useState } from 'react';
import type {
  CatalogFilterOptions,
  CatalogFilters,
  CatalogPage as CatalogPageData,
} from '@my-little-garden/core';
import { SoftwareVersion } from '@renderer/components/SoftwareVersion';
import {
  CatalogFiltersPanel,
  EMPTY_FILTERS,
} from './components/CatalogFiltersPanel';
import { CatalogManager } from './components/CatalogManager';
import { CatalogHelp } from './components/CatalogHelp';
import { CatalogTable } from './components/CatalogTable';
import { ImageManager } from './components/ImageManager';
import { SelectionCreator } from './components/SelectionCreator';
import { SelectionAdder } from './components/SelectionAdder';

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
  const [selectedPlantIds, setSelectedPlantIds] = useState<readonly string[]>(
    [],
  );
  const [selectingAll, setSelectingAll] = useState(false);

  useEffect(() => {
    let active = true;
    window.catalogService
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
    window.catalogService
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
    const catalog = await window.catalogService.listPlants(page, filters);
    setData(catalog);
    setError(null);
  };

  const refreshAfterCatalogReplacement = async (): Promise<void> => {
    const [catalog, options] = await Promise.all([
      window.catalogService.listPlants(1, filters),
      window.catalogService.listFilterOptions(),
    ]);
    setPage(1);
    setData(catalog);
    setFilterOptions(options);
    setSelectedPlantIds([]);
    setError(null);
  };

  const applyFilters = (nextFilters: CatalogFilters): void => {
    setFilters(nextFilters);
    setPage(1);
    setData(null);
    setError(null);
    setFilterPanelOpen(false);
  };

  const togglePlant = (plantId: string): void => {
    setSelectedPlantIds((current) =>
      current.includes(plantId)
        ? current.filter((id) => id !== plantId)
        : [...current, plantId],
    );
  };

  const toggleAllPlants = async (): Promise<void> => {
    if (selectedPlantIds.length > 0) {
      setSelectedPlantIds([]);
      return;
    }

    setSelectingAll(true);
    try {
      const plantIds = await window.catalogService.listPlantIds(filters);
      setSelectedPlantIds((current) =>
        current.length === 0 ? plantIds : current,
      );
      setError(null);
    } catch {
      setError('Les plantes n’ont pas pu être sélectionnées.');
    } finally {
      setSelectingAll(false);
    }
  };

  const selectionCreated = (name: string): void => {
    setSelectedPlantIds([]);
    onSuccess(`La sélection « ${name} » a été créée avec succès.`);
  };

  const plantsAdded = ({
    selectionName,
    addedCount,
    ignoredCount,
  }: {
    readonly selectionName: string;
    readonly addedCount: number;
    readonly ignoredCount: number;
  }): void => {
    setSelectedPlantIds([]);
    const addedLabel = `${addedCount} ${addedCount === 1 ? 'plante ajoutée' : 'plantes ajoutées'}`;
    const ignoredLabel =
      ignoredCount > 0
        ? ` ${ignoredCount} ${ignoredCount === 1 ? 'association existante ignorée' : 'associations existantes ignorées'}.`
        : '';
    onSuccess(
      `${addedLabel} à la sélection « ${selectionName} ».${ignoredLabel}`,
    );
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
      <section className="selection-actions" aria-label="Actions de sélection">
        <span className="selection-count">
          <span className="selection-count-number">
            {selectedPlantIds.length}
          </span>{' '}
          {selectedPlantIds.length === 1
            ? 'plante sélectionnée'
            : 'plantes sélectionnées'}
        </span>
        <div className="selection-action-buttons">
          <SelectionCreator
            selectedPlantIds={selectedPlantIds}
            onCreated={selectionCreated}
          />
          <SelectionAdder
            selectedPlantIds={selectedPlantIds}
            onAdded={plantsAdded}
          />
        </div>
      </section>
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
          selectedPlantIds={selectedPlantIds}
          onPlantToggle={togglePlant}
          selectingAll={selectingAll}
          onToggleAll={() => void toggleAllPlants()}
        />
      ) : null}
      <footer className="catalog-footer">
        <CatalogHelp />
        <SoftwareVersion />
        <span aria-hidden="true" />
      </footer>
    </>
  );
}
