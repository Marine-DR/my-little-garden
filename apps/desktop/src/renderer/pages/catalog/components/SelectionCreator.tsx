import { useState } from 'react';
import createIcon from '@renderer/assets/create.svg';

const CREATION_ERRORS = {
  empty_name: 'Le nom de la sélection est obligatoire.',
  no_plants: 'Sélectionnez au moins une plante.',
  duplicate_name: 'Une sélection avec ce nom existe déjà.',
  unknown_plants:
    'Une plante sélectionnée n’existe plus dans le catalogue. Actualisez la page et réessayez.',
} as const;

export function SelectionCreator({
  selectedPlantIds,
  onCreated,
}: {
  readonly selectedPlantIds: readonly string[];
  readonly onCreated: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const close = (): void => {
    if (creating) {
      return;
    }
    setOpen(false);
    setName('');
    setError(null);
  };

  const createSelection = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const result = await window.selectionService.createSelection({
        name,
        plantIds: selectedPlantIds,
      });
      if (!result.ok) {
        setError(CREATION_ERRORS[result.code]);
        return;
      }
      setOpen(false);
      setName('');
      onCreated(result.name);
    } catch {
      setError('La sélection n’a pas pu être créée.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <button
        className="secondary-button"
        type="button"
        disabled={selectedPlantIds.length === 0}
        onClick={() => setOpen(true)}
      >
        <img src={createIcon} alt="" />
        Créer une sélection
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="selection-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="selection-modal-title"
          >
            <div className="selection-modal-heading">
              <h2 id="selection-modal-title">Créer une sélection</h2>
              <button
                type="button"
                aria-label="Fermer la création de sélection"
                disabled={creating}
                onClick={close}
              >
                ×
              </button>
            </div>
            <form onSubmit={(event) => void createSelection(event)}>
              <label htmlFor="selection-name">Nom de la sélection</label>
              <input
                id="selection-name"
                name="selection-name"
                autoFocus
                value={name}
                disabled={creating}
                onChange={(event) => setName(event.target.value)}
              />
              {error ? (
                <p className="selection-form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="selection-modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={creating}
                  onClick={close}
                >
                  Annuler
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={creating || name.trim().length === 0}
                >
                  {creating ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
