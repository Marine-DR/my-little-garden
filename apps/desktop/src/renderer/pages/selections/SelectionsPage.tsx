import { useEffect, useState } from 'react';
import type { SelectionSummary } from '@my-little-garden/core';
import { SelectionsTable } from './components/SelectionsTable';

export function SelectionsPage({
  onBackToCatalog,
}: {
  readonly onBackToCatalog: () => void;
}) {
  const [selections, setSelections] = useState<
    readonly SelectionSummary[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    window.catalogApi
      .listSelections()
      .then((result) => {
        if (active) {
          setSelections(result);
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError('Les sélections n’ont pas pu être chargées.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="catalog-toolbar" aria-labelledby="selections-title">
        <div className="catalog-toolbar-main">
          <div className="catalog-search-group">
            <h1 id="selections-title">Mes Sélections</h1>
          </div>
        </div>
      </section>
      <div
        className="catalog-actions selections-administration-space"
        aria-hidden="true"
      />
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {!selections && !error ? (
        <div className="loading" role="status">
          Chargement des sélections…
        </div>
      ) : null}
      {selections ? (
        <SelectionsTable
          selections={selections}
          onBackToCatalog={onBackToCatalog}
        />
      ) : null}
    </>
  );
}
