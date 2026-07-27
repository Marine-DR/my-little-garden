import { useEffect, useState } from 'react';
import type { FlowerbedDesign, FlowerbedSummary } from '@my-little-garden/core';
import { FlowerbedEditorPage } from './FlowerbedEditorPage';

export function FlowerbedsPage() {
  const [flowerbeds, setFlowerbeds] = useState<readonly FlowerbedSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FlowerbedDesign | 'new' | null>(null);

  const loadFlowerbeds = (): void => {
    setError(null);
    void window.flowerbedService
      .listFlowerbeds()
      .then((result) => {
        setFlowerbeds(result);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
        setError('Les parterres n’ont pas pu être chargés.');
      });
  };

  useEffect(() => {
    let active = true;
    void window.flowerbedService
      .listFlowerbeds()
      .then((result) => {
        if (active) {
          setFlowerbeds(result);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setLoaded(true);
          setError('Les parterres n’ont pas pu être chargés.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const openFlowerbed = async (id: string): Promise<void> => {
    setError(null);
    try {
      const result = await window.flowerbedService.getFlowerbed(id);
      if (result) {
        setEditing(result);
      } else {
        setError('Ce parterre n’existe plus.');
      }
    } catch {
      setError('Le parterre n’a pas pu être chargé.');
    }
  };

  if (editing) {
    return (
      <FlowerbedEditorPage
        flowerbed={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          loadFlowerbeds();
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
            <p>Créez un plan vu du dessus à partir de vos sélections.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => setEditing('new')}
          >
            Nouveau parterre
          </button>
        </div>
      </section>
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {!loaded && !error ? (
        <div className="loading">Chargement des parterres…</div>
      ) : null}
      {loaded ? (
        flowerbeds.length === 0 ? (
          <section className="empty-state">
            <span aria-hidden="true">🌿</span>
            <h2>Aucun parterre enregistré</h2>
            <p>Commencez par dessiner votre premier espace de plantation.</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setEditing('new')}
            >
              Dessiner un parterre
            </button>
          </section>
        ) : (
          <section
            className="flowerbed-list"
            aria-label="Parterres enregistrés"
          >
            {flowerbeds.map((flowerbed) => (
              <article key={flowerbed.id} className="flowerbed-card">
                <div className="flowerbed-card-preview" aria-hidden="true">
                  <div />
                </div>
                <div>
                  <h2>{flowerbed.name}</h2>
                  <p>
                    {flowerbed.widthCm} × {flowerbed.heightCm} cm
                  </p>
                  <p>
                    {flowerbed.zoneCount} zone
                    {flowerbed.zoneCount === 1 ? '' : 's'} ·{' '}
                    {flowerbed.placementCount} plante
                    {flowerbed.placementCount === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void openFlowerbed(flowerbed.id)}
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
