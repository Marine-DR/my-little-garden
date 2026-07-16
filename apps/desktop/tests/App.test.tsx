import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CatalogFilterOptions,
  CatalogFilters,
  CatalogImportResult,
  CatalogPage,
  CatalogPlant,
  PhotoDeleteResult,
  PhotoImportResult,
  SelectionCreationInput,
  SelectionCreationResult,
  SelectionSummary,
} from '@my-little-garden/core';
import { App } from '../src/renderer/App';

const rose: CatalogPlant = {
  id: 'rose',
  name: 'Rose ancienne',
  photoUrl: null,
  heightMinCm: 50,
  heightMaxCm: 80,
  type: 'Vivace',
  kind: 'flower',
  soils: ['Drainé'],
  exposures: ['sun'],
  bloomStartMonth: 6,
  bloomEndMonth: 9,
  flowerColors: ['Rose'],
  leafColors: [],
  minimumTemperatureCelsius: -10,
  foliagePersistence: 'deciduous',
  spacingCm: 40,
  plantingSeasons: ['spring', 'autumn'],
};

const sunnyBorder: SelectionSummary = {
  id: 'sunny-border',
  name: 'Bordure plein soleil',
  previewPhotoUrls: [
    'photo://rose-1',
    'photo://rose-2',
    'photo://rose-3',
    'photo://rose-4',
  ],
  plantCount: 6,
  createdAt: '2026-07-10T08:00:00.000Z',
  updatedAt: '2026-07-14T12:30:00.000Z',
};

function page(number: number): CatalogPage {
  return {
    items: [{ ...rose, id: `rose-${number}`, name: `Rose page ${number}` }],
    page: number,
    pageSize: 25,
    total: 26,
  };
}

describe('App catalog', () => {
  const listPlants =
    vi.fn<(page: number, filters?: CatalogFilters) => Promise<CatalogPage>>();
  const listFilterOptions = vi.fn<() => Promise<CatalogFilterOptions>>();
  const listPlantIds =
    vi.fn<(filters?: CatalogFilters) => Promise<readonly string[]>>();
  const replaceCatalog =
    vi.fn<(filename: string, csv: string) => Promise<CatalogImportResult>>();
  const importPhotos =
    vi.fn<
      (
        files: readonly { name: string; bytes: Uint8Array }[],
      ) => Promise<PhotoImportResult>
    >();
  const deletePhoto = vi.fn<(plantId: string) => Promise<PhotoDeleteResult>>();
  const listSelections = vi.fn<() => Promise<readonly SelectionSummary[]>>();
  const createSelection =
    vi.fn<
      (input: SelectionCreationInput) => Promise<SelectionCreationResult>
    >();

  beforeEach(() => {
    vi.clearAllMocks();
    listPlants.mockImplementation(async (number) => page(number));
    listFilterOptions.mockResolvedValue({
      soils: ['Drainé', 'Humide'],
      exposures: ['sun', 'shade'],
      bloomMonths: [6, 9],
    });
    listPlantIds.mockResolvedValue(['rose-1', 'rose-2', 'rose-3']);
    replaceCatalog.mockResolvedValue({ ok: true, imported: 1 });
    importPhotos.mockResolvedValue({ ok: true, imported: 1, unmatched: [] });
    deletePhoto.mockResolvedValue({ ok: true });
    listSelections.mockResolvedValue([sunnyBorder]);
    createSelection.mockResolvedValue({
      ok: true,
      selectionId: 'selection-created',
      name: 'Coin parfumé',
      plantCount: 1,
    });
    window.catalogApi = {
      listPlants,
      listPlantIds,
      listFilterOptions,
      listSelections,
      createSelection,
      replaceCatalog,
      importPhotos,
      deletePhoto,
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows every requested column and uses placeholders on a single plant row', async () => {
    render(<App />);
    const row = await screen.findByRole('row', { name: /Rose page 1/ });
    expect(
      screen.getByRole('heading', { name: 'Mon Catalogue' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('searchbox', {
        name: 'Rechercher une fleur, couleur, sol, exposition',
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtres (0)' })).toHaveClass(
      'filter-button',
    );
    expect(
      screen.queryByRole('button', { name: 'Colonnes (0)' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Ajouter une fleur/u }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Gérer le catalogue/u }),
    ).toHaveClass('secondary-button');
    expect(
      screen.getAllByRole('columnheader').map((heading) => heading.textContent),
    ).toEqual([
      'Sélection',
      'Photo',
      'Nom',
      '↨ (cm)',
      'Type',
      'Fleur/autre',
      'Sol',
      'Exposition',
      'Floraison',
      'Couleurs 🌸',
      'Couleurs 🍃',
      '❅ (°C)',
      'Persistant',
      '↔ (cm)',
      'Plantation',
    ]);
    expect(within(row).getAllByText('-')).toHaveLength(1);
    expect(row).toHaveTextContent('50–80');
    expect(row).toHaveTextContent('Juin→Sep');
    expect(within(row).getByText('Printemps')).toBeInTheDocument();
    expect(within(row).getByText('Automne')).toBeInTheDocument();
    expect(
      within(row).getByRole('img', { name: 'Couleur Rose' }),
    ).toHaveTextContent('🩷');
    expect(screen.getByText('1-25 sur 26 fleurs')).toBeInTheDocument();
    const pageSizeButton = screen.getByRole('button', {
      name: 'Nombre de fleurs par page: 25',
    });
    expect(pageSizeButton).toBeDisabled();
    expect(pageSizeButton).toHaveTextContent('25▼');
  });

  it('loads the next group of 25 plants from the database boundary', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await waitFor(() =>
      expect(listPlants).toHaveBeenLastCalledWith(2, {
        soils: [],
        exposures: [],
        bloomMonths: [],
      }),
    );
    expect(await screen.findByText('Rose page 2')).toBeInTheDocument();
  });

  it('creates a named selection from checked catalog plants', async () => {
    const createdSelection: SelectionSummary = {
      ...sunnyBorder,
      id: 'selection-created',
      name: 'Coin parfumé',
      plantCount: 1,
    };
    listSelections.mockResolvedValueOnce([createdSelection]);
    render(<App />);
    await screen.findByText('Rose page 1');

    const createButton = screen.getByRole('button', {
      name: 'Créer une sélection',
    });
    expect(createButton).toBeDisabled();
    expect(createButton).toHaveClass('secondary-button');
    expect(createButton.querySelector('img')).toBeInTheDocument();
    expect(document.querySelector('.selection-count')).toHaveTextContent(
      '0 plantes sélectionnées',
    );
    const administrationActions = document.querySelector('.catalog-actions');
    const selectionActions = document.querySelector('.selection-actions');
    const catalogTable = document.querySelector('#catalog-table');
    expect(
      administrationActions?.compareDocumentPosition(selectionActions!),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(selectionActions?.compareDocumentPosition(catalogTable!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Rose page 1' }),
    );
    expect(createButton).toBeEnabled();
    expect(document.querySelector('.selection-count')).toHaveTextContent(
      '1 plante sélectionnée',
    );
    fireEvent.click(createButton);

    const dialog = screen.getByRole('dialog', {
      name: 'Créer une sélection',
    });
    const submit = within(dialog).getByRole('button', { name: 'Créer' });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Nom de la sélection'), {
      target: { value: '  Coin parfumé  ' },
    });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(createSelection).toHaveBeenCalledWith({
        name: '  Coin parfumé  ',
        plantIds: ['rose-1'],
      }),
    );
    expect(
      await screen.findByText(
        'La sélection « Coin parfumé » a été créée avec succès.',
      ),
    ).toBeInTheDocument();
    expect(createButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Mes Sélections' }));
    expect(await screen.findByText('Coin parfumé')).toBeInTheDocument();
  });

  it('selects all filtered plants from the header and clears them on the next toggle', async () => {
    listPlantIds.mockResolvedValueOnce(['rose-1']);
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(screen.getByRole('button', { name: 'Filtres (0)' }));
    fireEvent.click(screen.getByLabelText('Ombre'));
    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));
    await waitFor(() =>
      expect(listPlants).toHaveBeenLastCalledWith(1, {
        soils: [],
        exposures: ['shade'],
        bloomMonths: [],
      }),
    );

    const selectAll = screen.getByRole('checkbox', {
      name: 'Sélectionner toutes les plantes filtrées',
    });
    fireEvent.click(selectAll);
    await waitFor(() =>
      expect(listPlantIds).toHaveBeenCalledWith({
        soils: [],
        exposures: ['shade'],
        bloomMonths: [],
      }),
    );
    expect(document.querySelector('.selection-count')).toHaveTextContent(
      '1 plante sélectionnée',
    );
    expect(
      screen.getByRole('checkbox', {
        name: 'Désélectionner toutes les plantes',
      }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Sélectionner Rose page 1' }),
    ).toBeChecked();

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Désélectionner toutes les plantes',
      }),
    );
    expect(document.querySelector('.selection-count')).toHaveTextContent(
      '0 plantes sélectionnées',
    );
    expect(listPlantIds).toHaveBeenCalledTimes(1);
  });

  it('keeps the creation dialog open when the selection name already exists', async () => {
    createSelection.mockResolvedValueOnce({
      ok: false,
      code: 'duplicate_name',
    });
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Rose page 1' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Créer une sélection' }),
    );
    fireEvent.change(screen.getByLabelText('Nom de la sélection'), {
      target: { value: 'Bordure plein soleil' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(
      await screen.findByText('Une sélection avec ce nom existe déjà.'),
    ).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens, closes, applies, and clears multi-attribute filters', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(screen.getByRole('button', { name: 'Filtres (0)' }));
    const filterPanel = screen.getByRole('complementary', {
      name: 'Filtres du catalogue',
    });
    expect(filterPanel).toBeInTheDocument();
    expect(
      within(filterPanel).queryByText('Couleurs Fleur'),
    ).not.toBeInTheDocument();
    expect(
      within(filterPanel).queryByText('Couleurs Feuilles'),
    ).not.toBeInTheDocument();
    expect(within(filterPanel).queryByText('Type')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Drainé'));
    fireEvent.click(screen.getByLabelText('Ombre'));
    fireEvent.click(screen.getByLabelText('Juin'));
    expect(listPlants).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));
    await waitFor(() =>
      expect(listPlants).toHaveBeenLastCalledWith(1, {
        soils: ['Drainé'],
        exposures: ['shade'],
        bloomMonths: [6],
      }),
    );
    expect(
      screen.queryByRole('complementary', { name: 'Filtres du catalogue' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filtres (3)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer les filtres' }));
    expect(
      screen.queryByRole('complementary', { name: 'Filtres du catalogue' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filtres (3)' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Désactiver les filtres' }),
    );
    await waitFor(() =>
      expect(listPlants).toHaveBeenLastCalledWith(1, {
        soils: [],
        exposures: [],
        bloomMonths: [],
      }),
    );
  });

  it('closes each expanded action menu when clicking outside', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(
      screen.getByRole('button', { name: /Gérer le catalogue/u }),
    );
    expect(
      screen.getByRole('button', { name: /Remplacer tout le catalogue/u }),
    ).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('button', { name: /Remplacer tout le catalogue/u }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Importer des images/u }),
    );
    expect(
      screen.getByRole('button', { name: 'Importer une image' }),
    ).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('button', { name: 'Importer une image' }),
    ).not.toBeInTheDocument();
  });

  it('opens catalog management and refreshes the first page after replacement', async () => {
    const timeoutSpy = vi.spyOn(window, 'setTimeout');
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(
      screen.getByRole('button', { name: /Gérer le catalogue/u }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Remplacer tout le catalogue/u }),
    );
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(['Nom,Sol,Exposition'], 'catalogue.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      value: async () => 'contenu csv',
    });
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() =>
      expect(replaceCatalog).toHaveBeenCalledWith(
        'catalogue.csv',
        'contenu csv',
      ),
    );
    await waitFor(() =>
      expect(listPlants).toHaveBeenLastCalledWith(1, {
        soils: [],
        exposures: [],
        bloomMonths: [],
      }),
    );
    expect(
      await screen.findByText(/catalogue a été remplacé avec succès/u),
    ).toBeInTheDocument();
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    fireEvent.click(
      screen.getByRole('button', { name: 'Fermer le message de succès' }),
    );
    expect(
      screen.queryByText(/catalogue a été remplacé avec succès/u),
    ).not.toBeInTheDocument();
  });

  it('displays all import errors in one closable dialog', async () => {
    replaceCatalog.mockResolvedValueOnce({
      ok: false,
      errors: [
        {
          code: 'missing_column',
          field: 'Sol',
          message: "La colonne Sol n'est pas présente dans le fichier d'entrée",
        },
        {
          code: 'unsupported_column',
          field: 'Terrain',
          message:
            "La colonne Terrain présente dans le fichier n'a pas le bon nom ou ne fait pas partie des éléments supportés",
        },
      ],
    });
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(
      screen.getByRole('button', { name: /Gérer le catalogue/u }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Remplacer tout le catalogue/u }),
    );
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(['invalid'], 'catalogue.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => 'invalid' });
    fireEvent.change(input!, { target: { files: [file] } });

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(2);
    expect(dialog).toHaveTextContent("La colonne Sol n'est pas présente");
    expect(dialog).toHaveTextContent('La colonne Terrain présente');
    expect(replaceCatalog).toHaveBeenCalledTimes(1);
    expect(listPlants).toHaveBeenCalledTimes(1);

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Fermer le message d’erreur',
      }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('imports one plant image and refreshes the visible page', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(
      screen.getByRole('button', { name: /Importer des images/u }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Importer une image' }));
    const input = screen.getByLabelText('Sélectionner une image');
    const file = new File([new Uint8Array([1, 2, 3])], 'Rose page 1.png', {
      type: 'image/png',
    });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(importPhotos).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(listPlants).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText(/1 photo\(s\) importée\(s\)/u),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Gérer le catalogue/u }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Remplacer tout le catalogue/u }),
    );
    const csvInput = document.querySelector<HTMLInputElement>(
      'input[accept=".csv,text/csv"]',
    );
    const csv = new File(['catalogue'], 'catalogue.csv', { type: 'text/csv' });
    Object.defineProperty(csv, 'text', { value: async () => 'catalogue' });
    fireEvent.change(csvInput!, { target: { files: [csv] } });

    expect(
      await screen.findByText(/catalogue a été remplacé avec succès/u),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/1 photo\(s\) importée\(s\)/u),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('opens the selections screen and returns to the catalog screen', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(screen.getByRole('button', { name: 'Mes Sélections' }));

    expect(
      await screen.findByRole('heading', { name: 'Mes Sélections' }),
    ).toBeInTheDocument();
    expect(listSelections).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Mon Catalogue' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Filtres (0)' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Gérer le catalogue/u }),
    ).not.toBeInTheDocument();
    const selectionsToolbar = document.querySelector('.catalog-toolbar');
    const administrationSpace = document.querySelector(
      '.selections-administration-space',
    );
    const selectionsTable = document.querySelector('#selections-table');
    expect(
      selectionsToolbar?.compareDocumentPosition(administrationSpace!),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(administrationSpace?.compareDocumentPosition(selectionsTable!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      screen.getAllByRole('columnheader').map((heading) => heading.textContent),
    ).toEqual([
      'Nom',
      'Aperçu',
      'Plantes',
      'Date de création',
      'Dernière modification',
    ]);

    const row = screen.getByRole('row', { name: /Bordure plein soleil/u });
    expect(row).toHaveTextContent('6');
    expect(row).toHaveTextContent('10/07/2026');
    expect(row).toHaveTextContent('14/07/2026');
    expect(
      within(row).getByLabelText('2 plantes non affichées'),
    ).toHaveTextContent('+2');

    fireEvent.click(screen.getByRole('button', { name: 'Mon Catalogue' }));
    expect(
      await screen.findByRole('heading', { name: 'Mon Catalogue' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mes Sélections' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Rose page 1')).toBeInTheDocument();
  });

  it('shows the selections empty state with a catalog return action', async () => {
    listSelections.mockResolvedValueOnce([]);
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(screen.getByRole('button', { name: 'Mes Sélections' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Aucune sélection enregistrée',
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retour au catalogue' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Mon Catalogue' }),
    ).toBeInTheDocument();
  });
});
