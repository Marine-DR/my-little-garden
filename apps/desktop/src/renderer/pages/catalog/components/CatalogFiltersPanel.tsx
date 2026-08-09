import { useState } from 'react';
import type {
  CatalogFilterOptions,
  CatalogFilters,
} from '@my-little-garden/core';
import filterIcon from '@renderer/assets/filter.svg';
import resetFilterIcon from '@renderer/assets/resetFilter.svg';
import { MONTH_LABELS } from '../catalog-labels';
import { colorEmoji, EXPOSURES } from '../formatters';

export const EMPTY_FILTERS: CatalogFilters = {
  soils: [],
  exposures: [],
  bloomMonths: [],
  plantKinds: [],
  flowerColors: [],
  leafColors: [],
};

export function countFilters(filters: CatalogFilters): number {
  return (
    filters.soils.length +
    filters.exposures.length +
    filters.bloomMonths.length +
    filters.plantKinds.length +
    filters.flowerColors.length +
    filters.leafColors.length
  );
}

function sameValues<T extends string | number>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  return (
    left.length === right.length && left.every((value) => right.includes(value))
  );
}

function sameFilters(left: CatalogFilters, right: CatalogFilters): boolean {
  return (
    sameValues(left.soils, right.soils) &&
    sameValues(left.exposures, right.exposures) &&
    sameValues(left.bloomMonths, right.bloomMonths) &&
    sameValues(left.plantKinds, right.plantKinds) &&
    sameValues(left.flowerColors, right.flowerColors) &&
    sameValues(left.leafColors, right.leafColors)
  );
}

function toggleValue<T extends string | number>(
  values: readonly T[],
  value: T,
): readonly T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

export function CatalogFiltersPanel({
  open,
  filters,
  options,
  onOpen,
  onClose,
  onApply,
}: {
  readonly open: boolean;
  readonly filters: CatalogFilters;
  readonly options: CatalogFilterOptions | null;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onApply: (filters: CatalogFilters) => void;
}) {
  const [draft, setDraft] = useState<CatalogFilters>(filters);
  const activeCount = countFilters(filters);
  const draftCount = countFilters(draft);

  return (
    <>
      <button
        className={activeCount > 0 ? 'filter-button active' : 'filter-button'}
        type="button"
        aria-expanded={open}
        aria-controls="catalog-filter-panel"
        onClick={() => {
          setDraft(filters);
          onOpen();
        }}
      >
        <img src={filterIcon} alt="" />
        Filtres ({activeCount})
      </button>
      {open ? (
        <div className="filter-backdrop" role="presentation">
          <aside
            id="catalog-filter-panel"
            className="filter-panel"
            aria-label="Filtres du catalogue"
          >
            <div className="filter-panel-header">
              <h2>Filtrer</h2>
              <button
                className="icon-button"
                type="button"
                aria-label="Fermer les filtres"
                onClick={onClose}
              >
                ×
              </button>
            </div>
            <div className="filter-summary">
              <span>{activeCount} Filtres actifs</span>
              <button
                type="button"
                disabled={activeCount === 0 && draftCount === 0}
                onClick={() => {
                  setDraft(EMPTY_FILTERS);
                  onApply(EMPTY_FILTERS);
                }}
              >
                <img src={resetFilterIcon} alt="" />
                Désactiver les filtres
              </button>
            </div>
            <div className="filter-groups">
              <fieldset>
                <legend>Exposition</legend>
                <div className="filter-option-grid exposure-grid">
                  {options?.exposures.length ? (
                    options.exposures.map((exposure) => (
                      <label key={exposure} className="filter-check-option">
                        <input
                          type="checkbox"
                          aria-label={EXPOSURES[exposure].label}
                          checked={draft.exposures.includes(exposure)}
                          onChange={() =>
                            setDraft((current) => ({
                              ...current,
                              exposures: toggleValue(
                                current.exposures,
                                exposure,
                              ),
                            }))
                          }
                        />
                        <span
                          className={`exposure-filter-icon exposure-${exposure}`}
                          aria-hidden="true"
                        >
                          {EXPOSURES[exposure].icon}
                        </span>
                        <span>{EXPOSURES[exposure].label}</span>
                      </label>
                    ))
                  ) : (
                    <p>Aucune valeur disponible</p>
                  )}
                </div>
              </fieldset>
              <fieldset>
                <legend>Sol</legend>
                <div className="filter-option-grid soil-grid">
                  {options?.soils.length ? (
                    options.soils.map((soil) => (
                      <label key={soil} className="filter-check-option">
                        <input
                          type="checkbox"
                          aria-label={soil}
                          checked={draft.soils.includes(soil)}
                          onChange={() =>
                            setDraft((current) => ({
                              ...current,
                              soils: toggleValue(current.soils, soil),
                            }))
                          }
                        />
                        <span>{soil}</span>
                      </label>
                    ))
                  ) : (
                    <p>Aucune valeur disponible</p>
                  )}
                </div>
              </fieldset>
              <fieldset>
                <legend>Floraison</legend>
                <div className="month-picker">
                  {options?.bloomMonths.length ? (
                    options.bloomMonths.map((month) => (
                      <label key={month} className="month-filter">
                        <input
                          type="checkbox"
                          aria-label={MONTH_LABELS[month - 1]}
                          checked={draft.bloomMonths.includes(month)}
                          onChange={() =>
                            setDraft((current) => ({
                              ...current,
                              bloomMonths: toggleValue(
                                current.bloomMonths,
                                month,
                              ),
                            }))
                          }
                        />
                        <span>{MONTH_LABELS[month - 1]}</span>
                      </label>
                    ))
                  ) : (
                    <p>Aucune valeur disponible</p>
                  )}
                </div>
              </fieldset>
              <fieldset>
                <legend>Fleur / autre</legend>
                <div className="filter-option-grid">
                  {options?.plantKinds.length ? (
                    [...options.plantKinds]
                      .sort((left, right) => left.localeCompare(right, 'fr'))
                      .map((plantKind) => (
                        <label key={plantKind} className="filter-check-option">
                          <input
                            type="checkbox"
                            aria-label={plantKind}
                            checked={draft.plantKinds.includes(plantKind)}
                            onChange={() =>
                              setDraft((current) => ({
                                ...current,
                                plantKinds: toggleValue(
                                  current.plantKinds,
                                  plantKind,
                                ),
                              }))
                            }
                          />
                          <span>{plantKind}</span>
                        </label>
                      ))
                  ) : (
                    <p>Aucune valeur disponible</p>
                  )}
                </div>
              </fieldset>
              <fieldset>
                <legend>Couleurs fleurs</legend>
                <div className="color-filter-picker">
                  {options?.flowerColors.length ? (
                    options.flowerColors.map((color) => {
                      const emoji = colorEmoji(color);
                      return (
                        <label key={color} className="color-filter-option">
                          <input
                            type="checkbox"
                            aria-label={color}
                            checked={draft.flowerColors.includes(color)}
                            onChange={() =>
                              setDraft((current) => ({
                                ...current,
                                flowerColors: toggleValue(
                                  current.flowerColors,
                                  color,
                                ),
                              }))
                            }
                          />
                          <span title={color}>{emoji ?? color}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p>Aucune valeur disponible</p>
                  )}
                </div>
              </fieldset>
              <fieldset>
                <legend>Couleurs feuilles</legend>
                <div className="color-filter-picker">
                  {options?.leafColors.length ? (
                    options.leafColors.map((color) => {
                      const emoji = colorEmoji(color);
                      return (
                        <label key={color} className="color-filter-option">
                          <input
                            type="checkbox"
                            aria-label={color}
                            checked={draft.leafColors.includes(color)}
                            onChange={() =>
                              setDraft((current) => ({
                                ...current,
                                leafColors: toggleValue(
                                  current.leafColors,
                                  color,
                                ),
                              }))
                            }
                          />
                          <span title={color}>{emoji ?? color}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p>Aucune valeur disponible</p>
                  )}
                </div>
              </fieldset>
            </div>
            <div className="filter-panel-actions">
              <button
                className="filter-cancel-button"
                type="button"
                onClick={onClose}
              >
                <span aria-hidden="true">×</span>
                Annuler
              </button>
              <button
                className="filter-apply-button"
                type="button"
                disabled={sameFilters(draft, filters)}
                onClick={() => onApply(draft)}
              >
                <img src={filterIcon} alt="" />
                Filtrer
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
