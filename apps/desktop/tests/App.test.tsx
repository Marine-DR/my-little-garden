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
  SelectionDetails,
  SelectionPlantAdditionInput,
  SelectionPlantAdditionResult,
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
  const getSelection =
    vi.fn<(selectionId: string) => Promise<SelectionDetails | null>>();
  const removePlantsFromSelection =
    vi.fn<
      (
        selectionId: string,
        plantIds: readonly string[],
      ) => Promise<SelectionDetails | null>
    >();
  const createSelection =
    vi.fn<
      (input: SelectionCreationInput) => Promise<SelectionCreationResult>
    >();
  const addPlantsToSelection =
    vi.fn<
      (
        input: SelectionPlantAdditionInput,
      ) => Promise<SelectionPlantAdditionResult>
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
    getSelection.mockResolvedValue({
      id: sunnyBorder.id,
      name: sunnyBorder.name,
      plants: [rose],
    });
    removePlantsFromSelection.mockResolvedValue({
      id: sunnyBorder.id,
      name: sunnyBorder.name,
      plants: [rose],
    });
    createSelection.mockResolvedValue({
      ok: true,
      selectionId: 'selection-created',
      name: 'Coin parfumé',
      plantCount: 1,
    });
    addPlantsToSelection.mockResolvedValue({
      ok: true,
      selectionId: sunnyBorder.id,
      selectionName: sunnyBorder.name,
      addedCount: 1,
      ignoredCount: 0,
    });
    window.catalogApi = {
      listPlants,
      listPlantIds,
      listFilterOptions,
      listSelections,
      getSelection,
      removePlantsFromSelection,
      createSelection,
      addPlantsToSelection,
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
    const flowerbedsButton = screen.getByRole('button', {
      name: 'Mes Parterres',
    });
    expect(flowerbedsButton).toBeVisible();
    expect(flowerbedsButton).toBeDisabled();
    expect(flowerbedsButton).toHaveClass('primary-button');
    const flowerbedIcon =
      flowerbedsButton.querySelector<HTMLElement>('.flowerbed-icon');
    expect(flowerbedIcon).toBeInTheDocument();
    expect(flowerbedIcon?.style.maskImage).toContain('url("');
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

  it('adds checked catalog plants to a chosen existing selection', async () => {
    addPlantsToSelection.mockResolvedValueOnce({
      ok: true,
      selectionId: sunnyBorder.id,
      selectionName: sunnyBorder.name,
      addedCount: 1,
      ignoredCount: 1,
    });
    render(<App />);
    await screen.findByText('Rose page 1');

    const createButton = screen.getByRole('button', {
      name: 'Créer une sélection',
    });
    const addButton = screen.getByRole('button', {
      name: 'Ajouter à une sélection',
    });
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveClass('secondary-button');
    const addIcon = addButton.querySelector<HTMLElement>('.selection-add-icon');
    expect(addIcon).toBeInTheDocument();
    expect(addIcon?.style.maskImage).toContain(
      screen
        .getByRole('button', { name: 'Mes Sélections' })
        .querySelector('img')
        ?.getAttribute('src'),
    );
    expect(createButton.compareDocumentPosition(addButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Rose page 1' }),
    );
    expect(addButton).toBeEnabled();
    fireEvent.click(addButton);

    const dialog = await screen.findByRole('dialog', {
      name: 'Ajouter à une sélection',
    });
    await waitFor(() => expect(listSelections).toHaveBeenCalledTimes(1));
    const submit = within(dialog).getByRole('button', { name: 'Ajouter' });
    expect(submit).toBeDisabled();
    fireEvent.click(
      within(dialog).getByRole('radio', { name: /Bordure plein soleil/u }),
    );
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(addPlantsToSelection).toHaveBeenCalledWith({
        selectionId: sunnyBorder.id,
        plantIds: ['rose-1'],
      }),
    );
    expect(
      await screen.findByText(
        '1 plante ajoutée à la sélection « Bordure plein soleil ». 1 association existante ignorée.',
      ),
    ).toBeInTheDocument();
    expect(addButton).toBeDisabled();
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

  it('keeps the creation dialog open when the exact selection name already exists', async () => {
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
      'Actions',
    ]);

    const row = screen.getByRole('row', { name: /Bordure plein soleil/u });
    expect(row).toHaveTextContent('6');
    expect(row).toHaveTextContent('10/07/2026');
    expect(row).toHaveTextContent('14/07/2026');
    expect(
      within(row).getByLabelText('2 plantes non affichées'),
    ).toHaveTextContent('+2');
    const detailsButton = within(row).getByRole('button', {
      name: 'Voir les détails de Bordure plein soleil',
    });
    expect(detailsButton).toHaveClass(
      'secondary-button',
      'selection-details-button',
    );
    expect(detailsButton).toHaveTextContent('');
    expect(detailsButton.querySelector('img')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mon Catalogue' }));
    expect(
      await screen.findByRole('heading', { name: 'Mon Catalogue' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mes Sélections' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Rose page 1')).toBeInTheDocument();
  });

  it('opens a selection detail with catalog attributes and returns to selections', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(screen.getByRole('button', { name: 'Mes Sélections' }));

    const row = await screen.findByRole('row', {
      name: /Bordure plein soleil/u,
    });
    fireEvent.click(
      within(row).getByRole('button', {
        name: 'Voir les détails de Bordure plein soleil',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Bordure plein soleil' }),
    ).toBeInTheDocument();
    expect(getSelection).toHaveBeenCalledWith('sunny-border');
    expect(screen.getByText('1 plante')).toBeInTheDocument();
    expect(screen.queryByText(/dans la sélection/u)).not.toBeInTheDocument();
    expect(screen.getByText('1-1 sur 1 plantes')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Nombre de plantes par page: 25' }),
    ).toBeDisabled();
    const detailToolbar = document.querySelector('.selection-detail-toolbar');
    const administrationSpace = document.querySelector(
      '.selections-administration-space',
    );
    const detailTable = document.querySelector('#selection-detail-table');
    expect(detailToolbar?.compareDocumentPosition(administrationSpace!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(administrationSpace?.compareDocumentPosition(detailTable!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      screen.getByRole('button', {
        name: 'Fermer le détail de la sélection',
      }),
    ).toHaveClass('icon-button');
    expect(
      screen.getByRole('row', { name: /Rose ancienne/u }),
    ).toHaveTextContent('50–80');
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

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Fermer le détail de la sélection',
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Mes Sélections' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: /Bordure plein soleil/u }),
    ).toBeInTheDocument();
  });

  it('removes checked plants from a selection only after confirmation', async () => {
    removePlantsFromSelection.mockResolvedValueOnce({
      id: sunnyBorder.id,
      name: sunnyBorder.name,
      plants: [],
    });
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(screen.getByRole('button', { name: 'Mes Sélections' }));
    fireEvent.click(
      within(
        await screen.findByRole('row', { name: /Bordure plein soleil/u }),
      ).getByRole('button', {
        name: 'Voir les détails de Bordure plein soleil',
      }),
    );

    const removeButton = await screen.findByRole('button', {
      name: 'Retirer de la sélection',
    });
    const managementArea = screen.getByRole('region', {
      name: 'Gestion de la sélection de fleurs',
    });
    expect(within(managementArea).getByText('0')).toBeInTheDocument();
    expect(managementArea).toHaveTextContent('0 plantes sélectionnées');
    expect(removeButton).toHaveClass('delete-button');
    expect(removeButton).toBeDisabled();
    expect(removeButton.querySelector('img')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Rose ancienne' }),
    );
    expect(managementArea).toHaveTextContent('1 plante sélectionnée');
    expect(removeButton).toBeEnabled();
    fireEvent.click(removeButton);

    const dialog = screen.getByRole('alertdialog', {
      name: 'Retirer 1 plante de cette sélection ?',
    });
    expect(dialog).toHaveTextContent('La plante restera dans le catalogue.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(removePlantsFromSelection).not.toHaveBeenCalled();
    expect(screen.getByText('Rose ancienne')).toBeInTheDocument();

    fireEvent.click(removeButton);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Retirer',
      }),
    );

    await waitFor(() =>
      expect(removePlantsFromSelection).toHaveBeenCalledWith('sunny-border', [
        'rose',
      ]),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Aucune plante dans cette sélection',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 plantes')).toBeInTheDocument();
    expect(removeButton).toBeDisabled();
  });

  it('paginates plants in a selection in groups of 25', async () => {
    getSelection.mockResolvedValueOnce({
      id: sunnyBorder.id,
      name: sunnyBorder.name,
      plants: Array.from({ length: 26 }, (_, index) => ({
        ...rose,
        id: `selection-plant-${index + 1}`,
        name: `Plante sélection ${index + 1}`,
      })),
    });
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(screen.getByRole('button', { name: 'Mes Sélections' }));
    fireEvent.click(
      within(
        await screen.findByRole('row', { name: /Bordure plein soleil/u }),
      ).getByRole('button', {
        name: 'Voir les détails de Bordure plein soleil',
      }),
    );

    expect(await screen.findByText('1-25 sur 26 plantes')).toBeInTheDocument();
    expect(screen.getByText('Plante sélection 25')).toBeInTheDocument();
    expect(screen.queryByText('Plante sélection 26')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText('26-26 sur 26 plantes')).toBeInTheDocument();
    expect(screen.getByText('Plante sélection 26')).toBeInTheDocument();
    expect(screen.queryByText('Plante sélection 25')).not.toBeInTheDocument();
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
