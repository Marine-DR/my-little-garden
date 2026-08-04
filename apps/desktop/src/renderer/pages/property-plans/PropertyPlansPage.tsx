import { useEffect, useState } from 'react';
import type {
  PropertyPlanDesign,
  PropertyPlanSummary,
} from '@my-little-garden/core';
import { PropertyPlanEditorPage } from './PropertyPlanEditorPage';

export function PropertyPlansPage() {
  const [propertyPlans, setPropertyPlans] = useState<
    readonly PropertyPlanSummary[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PropertyPlanDesign | 'new' | null>(
    null,
  );

  const loadPropertyPlans = (): void => {
    setError(null);
    void window.propertyPlanService
      .listPropertyPlans()
      .then((result) => {
        setPropertyPlans(result);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
        setError('Les plans n’ont pas pu être chargés.');
      });
  };

  useEffect(() => {
    let active = true;
    void window.propertyPlanService
      .listPropertyPlans()
      .then((result) => {
        if (active) {
          setPropertyPlans(result);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setLoaded(true);
          setError('Les plans n’ont pas pu être chargés.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const openPropertyPlan = async (id: string): Promise<void> => {
    setError(null);
    try {
      const result = await window.propertyPlanService.getPropertyPlan(id);
      if (result) {
        setEditing(result);
      } else {
        setError('Ce plan n’existe plus.');
      }
    } catch {
      setError('Le plan n’a pas pu être chargé.');
    }
  };

  if (editing) {
    return (
      <PropertyPlanEditorPage
        propertyPlan={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          loadPropertyPlans();
        }}
      />
    );
  }

  return (
    <>
      <section className="catalog-toolbar flowerbed-page-toolbar">
        <div className="catalog-toolbar-main">
          <div className="catalog-search-group">
            <h1>Mes Parterres</h1>
            <p>Dessinez votre parterre puis placez-y vos plantes.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => setEditing('new')}
          >
            Nouveau plan
          </button>
        </div>
      </section>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {!loaded && !error ? (
        <div className="loading">Chargement des plans…</div>
      ) : null}
      {loaded ? (
        propertyPlans.length === 0 ? (
          <section className="empty-state">
            <span aria-hidden="true">🌿</span>
            <h2>Aucun plan enregistré</h2>
            <p>Commencez par définir les dimensions de votre parterre.</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setEditing('new')}
            >
              Dessiner un plan
            </button>
          </section>
        ) : (
          <section className="flowerbed-list" aria-label="Plans enregistrés">
            {propertyPlans.map((propertyPlan) => (
              <article key={propertyPlan.id} className="flowerbed-card">
                <div className="flowerbed-card-preview" aria-hidden="true">
                  <div />
                </div>
                <div>
                  <h2>{propertyPlan.name}</h2>
                  <p>
                    Parterre · {propertyPlan.widthCm} × {propertyPlan.heightCm}{' '}
                    cm
                  </p>
                  <p>
                    {propertyPlan.placementCount} plante
                    {propertyPlan.placementCount === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void openPropertyPlan(propertyPlan.id)}
                >
                  Modifier
                </button>
              </article>
            ))}
          </section>
        )
      ) : null}
    </>
  );
}
