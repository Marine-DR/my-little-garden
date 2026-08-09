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
  CatalogAddPreviewResult,
  CatalogAddResult,
  CatalogModifyPreviewResult,
  CatalogModifyResult,
  CatalogPage,
  CatalogPlant,
  PropertyPlanDesign,
  PropertyPlanSaveInput,
  PropertyPlanSummary,
  PhotoDeleteResult,
  PhotoImportResult,
  PlantDeletionPreviewResult,
  PlantDeletionResult,
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
  type: 'Vivace|Grimpante',
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
  status: 'up_to_date',
  modifiedPlantCount: 0,
  deletedPlantCount: 0,
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

const deletedSunnyBorder: SelectionSummary = {
  ...sunnyBorder,
  status: 'contains_deleted_plants',
  deletedPlantCount: 1,
  plantCount: 0,
};

const deletedSelectionDetails: SelectionDetails = {
  id: sunnyBorder.id,
  name: sunnyBorder.name,
  status: 'contains_deleted_plants',
  modifiedPlantCount: 0,
  deletedPlantCount: 1,
  modifiedPlants: [],
  deletedPlants: [
    {
      id: rose.id,
      name: rose.name,
      photoUrl: 'garden-photo://image/rose.png',
    },
  ],
  plants: [],
};

const reviewedSelectionDetails: SelectionDetails = {
  ...deletedSelectionDetails,
  status: 'up_to_date',
  deletedPlantCount: 0,
  deletedPlants: [],
};

const mixedSelectionDetails: SelectionDetails = {
  ...deletedSelectionDetails,
  modifiedPlantCount: 1,
  modifiedPlants: [
    {
      id: 'sage',
      name: 'Sauge officinale',
      attributes: [],
    },
  ],
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
  const previewCatalogAddition =
    vi.fn<
      (filename: string, csv: string) => Promise<CatalogAddPreviewResult>
    >();
  const commitCatalogAddition =
    vi.fn<
      (
        token: string,
        policy: 'update_existing' | 'ignore_existing',
      ) => Promise<CatalogAddResult>
    >();
  const previewCatalogModification =
    vi.fn<
      (filename: string, csv: string) => Promise<CatalogModifyPreviewResult>
    >();
  const commitCatalogModification =
    vi.fn<
      (
        token: string,
        policy: 'create_missing' | 'ignore_missing',
      ) => Promise<CatalogModifyResult>
    >();
  const previewPlantDeletion =
    vi.fn<
      (plantIds: readonly string[]) => Promise<PlantDeletionPreviewResult>
    >();
  const deletePlants =
    vi.fn<(plantIds: readonly string[]) => Promise<PlantDeletionResult>>();
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
  const acknowledgeModifiedPlants =
    vi.fn<(selectionId: string) => Promise<SelectionDetails | null>>();
  const acknowledgeDeletedPlants =
    vi.fn<(selectionId: string) => Promise<SelectionDetails | null>>();
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
  const listPropertyPlans =
    vi.fn<() => Promise<readonly PropertyPlanSummary[]>>();
  const getPropertyPlan =
    vi.fn<(propertyPlanId: string) => Promise<PropertyPlanDesign | null>>();
  const savePropertyPlan =
    vi.fn<(input: PropertyPlanSaveInput) => Promise<PropertyPlanDesign>>();
  const deletePropertyPlan =
    vi.fn<(propertyPlanId: string) => Promise<boolean>>();

  beforeEach(() => {
    vi.clearAllMocks();
    listPlants.mockImplementation(async (number) => page(number));
    listFilterOptions.mockResolvedValue({
      soils: ['Drainé', 'Humide'],
      exposures: ['sun', 'shade'],
      bloomMonths: [6, 9],
      flowerColors: ['Blanc', 'Rose', 'Violet'],
    });
    listPlantIds.mockResolvedValue(['rose-1', 'rose-2', 'rose-3']);
    replaceCatalog.mockResolvedValue({ ok: true, imported: 1 });
    previewCatalogAddition.mockResolvedValue({
      ok: true,
      token: 'addition-preview',
      created: 1,
      unchanged: 0,
      conflicts: [],
      impactedSelections: [],
    });
    commitCatalogAddition.mockResolvedValue({
      ok: true,
      created: 1,
      updated: 0,
      ignored: 0,
      alreadyExisted: 0,
      notAdded: 0,
    });
    previewCatalogModification.mockResolvedValue({
      ok: true,
      token: 'modification-preview',
      updated: 1,
      unchanged: 0,
      missing: [],
      impactedSelections: [],
    });
    commitCatalogModification.mockResolvedValue({
      ok: true,
      created: 0,
      updated: 1,
      ignored: 0,
      unchanged: 0,
      notAdded: 0,
    });
    previewPlantDeletion.mockResolvedValue({
      ok: true,
      plants: [{ id: 'rose-1', name: 'Rose page 1' }],
      impactedSelections: [],
    });
    deletePlants.mockResolvedValue({
      ok: true,
      deletedPlantCount: 1,
      affectedSelectionCount: 0,
    });
    importPhotos.mockResolvedValue({ ok: true, imported: 1, unmatched: [] });
    deletePhoto.mockResolvedValue({ ok: true });
    listSelections.mockResolvedValue([sunnyBorder]);
    getSelection.mockResolvedValue({
      id: sunnyBorder.id,
      name: sunnyBorder.name,
      status: 'up_to_date',
      modifiedPlantCount: 0,
      deletedPlantCount: 0,
      modifiedPlants: [],
      deletedPlants: [],
      plants: [rose],
    });
    removePlantsFromSelection.mockResolvedValue({
      id: sunnyBorder.id,
      name: sunnyBorder.name,
      status: 'up_to_date',
      modifiedPlantCount: 0,
      deletedPlantCount: 0,
      modifiedPlants: [],
      deletedPlants: [],
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
    window.aboutService = {
      getAbout: vi.fn(async () => ({ version: 'test-version' })),
    };
    listPropertyPlans.mockResolvedValue([]);
    getPropertyPlan.mockResolvedValue(null);
    deletePropertyPlan.mockResolvedValue(true);
    window.catalogService = {
      listPlants,
      listPlantIds,
      listFilterOptions,
    };
    window.selectionService = {
      listSelections,
      getSelection,
      removePlantsFromSelection,
      acknowledgeModifiedPlants,
      acknowledgeDeletedPlants,
      createSelection,
      addPlantsToSelection,
    };
    window.catalogManagementService = {
      replaceCatalog,
      previewCatalogAddition,
      commitCatalogAddition,
      previewCatalogModification,
      commitCatalogModification,
      previewPlantDeletion,
      deletePlants,
      getTemplate: vi.fn(async () => 'Nom,Sol,Exposition\nRose,Drainé,Soleil'),
    };
    window.photoService = {
      importPhotos,
      deletePhoto,
    };
    window.propertyPlanService = {
      listPropertyPlans,
      getPropertyPlan,
      savePropertyPlan,
      deletePropertyPlan,
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('shows every requested column and uses placeholders on a single plant row', async () => {
    render(<App />);
    const row = await screen.findByRole('row', { name: /Rose page 1/ });
    expect(within(row).getByText('Vivace')).toBeInTheDocument();
    expect(within(row).getByText('Grimpante')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Mon Catalogue' }),
    ).toBeInTheDocument();
    const propertyPlansButton = screen.getByRole('button', {
      name: 'Mes Plans',
    });
    expect(propertyPlansButton).toBeVisible();
    expect(propertyPlansButton).toBeEnabled();
    expect(propertyPlansButton).toHaveClass('primary-button');
    const flowerbedIcon =
      propertyPlansButton.querySelector<HTMLElement>('.flowerbed-icon');
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
    expect(screen.getByRole('button', { name: 'Aide' })).toHaveClass(
      'secondary-button',
      'catalog-help-button',
    );
    expect(screen.getByRole('button', { name: 'Aide' })).not.toHaveTextContent(
      'Aide',
    );
    const catalogTable = document.querySelector('#catalog-table');
    const catalogFooter = document.querySelector('.catalog-footer');
    expect(catalogTable?.compareDocumentPosition(catalogFooter!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(await screen.findByText('Version test-version')).toHaveClass(
      'software-version',
    );
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
        flowerColors: [],
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

  it('deletes checked catalog plants only after preview and confirmation', async () => {
    previewPlantDeletion.mockResolvedValueOnce({
      ok: true,
      plants: [{ id: 'rose-1', name: 'Rose page 1' }],
      impactedSelections: [
        {
          id: sunnyBorder.id,
          name: sunnyBorder.name,
          plantNames: ['Rose page 1'],
        },
      ],
    });
    deletePlants.mockResolvedValueOnce({
      ok: true,
      deletedPlantCount: 1,
      affectedSelectionCount: 1,
    });
    render(<App />);
    await screen.findByText('Rose page 1');

    const deleteButton = screen.getByRole('button', { name: 'Supprimer' });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveClass('delete-button');

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Sélectionner Rose page 1' }),
    );
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Supprimer 1 plante du catalogue ?',
    });
    expect(previewPlantDeletion).toHaveBeenCalledWith(['rose-1']);
    expect(dialog).toHaveTextContent('Rose page 1');
    expect(dialog).toHaveTextContent(
      'Certaines plantes sont utilisées dans des sélections.',
    );
    expect(dialog).toHaveTextContent('Sélections concernées');
    expect(dialog).toHaveTextContent('Bordure plein soleil');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(deletePlants).not.toHaveBeenCalled();

    fireEvent.click(deleteButton);
    const confirmedDialog = await screen.findByRole('alertdialog', {
      name: 'Supprimer 1 plante du catalogue ?',
    });
    fireEvent.click(
      within(confirmedDialog).getByRole('button', { name: 'Supprimer' }),
    );

    await waitFor(() => expect(deletePlants).toHaveBeenCalledWith(['rose-1']));
    expect(
      await screen.findByText(
        'Suppression terminée : 1 plante supprimée. 1 sélection a été mise à jour.',
      ),
    ).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
    expect(listFilterOptions).toHaveBeenCalledTimes(2);
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
        flowerColors: [],
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
        flowerColors: [],
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
      within(filterPanel).getByText('Couleurs fleurs'),
    ).toBeInTheDocument();
    expect(
      within(filterPanel).queryByText('Couleurs Feuilles'),
    ).not.toBeInTheDocument();
    expect(within(filterPanel).queryByText('Type')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Drainé'));
    fireEvent.click(screen.getByLabelText('Ombre'));
    fireEvent.click(screen.getByLabelText('Juin'));
    fireEvent.click(screen.getByLabelText('Rose'));
    fireEvent.click(screen.getByLabelText('Violet'));
    expect(listPlants).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Filtrer' }));
    await waitFor(() =>
      expect(listPlants).toHaveBeenLastCalledWith(1, {
        soils: ['Drainé'],
        exposures: ['shade'],
        bloomMonths: [6],
        flowerColors: ['Rose', 'Violet'],
      }),
    );
    expect(
      screen.queryByRole('complementary', { name: 'Filtres du catalogue' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filtres (5)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer les filtres' }));
    expect(
      screen.queryByRole('complementary', { name: 'Filtres du catalogue' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filtres (5)' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Désactiver les filtres' }),
    );
    await waitFor(() =>
      expect(listPlants).toHaveBeenLastCalledWith(1, {
        soils: [],
        exposures: [],
        bloomMonths: [],
        flowerColors: [],
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

    fireEvent.click(screen.getByRole('button', { name: 'Aide' }));
    expect(
      screen.getByRole('button', {
        name: 'Télécharger le modèle du catalogue',
      }),
    ).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('button', {
        name: 'Télécharger le modèle du catalogue',
      }),
    ).not.toBeInTheDocument();
  });

  it('downloads the catalog template from the catalog management service', async () => {
    const createObjectURL = vi.fn(() => 'blob:catalog-template');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(screen.getByRole('button', { name: 'Aide' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Télécharger le modèle du catalogue',
      }),
    );

    await waitFor(() =>
      expect(window.catalogManagementService.getTemplate).toHaveBeenCalled(),
    );
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:catalog-template');
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
        flowerColors: [],
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

  it('adds new CSV plants without replacing the catalog', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(
      screen.getByRole('button', { name: /Gérer le catalogue/u }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ajouter des plantes depuis un CSV/u,
      }),
    );
    const input = document.querySelector<HTMLInputElement>(
      'input[accept=".csv,text/csv"]',
    );
    const file = new File(['Nom,Sol,Exposition'], 'ajout.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', { value: async () => 'contenu csv' });
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() =>
      expect(previewCatalogAddition).toHaveBeenCalledWith(
        'ajout.csv',
        'contenu csv',
      ),
    );
    await waitFor(() =>
      expect(commitCatalogAddition).toHaveBeenCalledWith(
        'addition-preview',
        'ignore_existing',
      ),
    );
    expect(replaceCatalog).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/1 plante a été ajoutée/u),
    ).toBeInTheDocument();
  });

  it('asks whether conflicting plants should be updated', async () => {
    previewCatalogAddition.mockResolvedValueOnce({
      ok: true,
      token: 'conflict-preview',
      created: 1,
      unchanged: 0,
      conflicts: ['Rose ancienne'],
      impactedSelections: [],
    });
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(
      screen.getByRole('button', { name: /Gérer le catalogue/u }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /Ajouter des plantes depuis un CSV/u,
      }),
    );
    const input = document.querySelector<HTMLInputElement>(
      'input[accept=".csv,text/csv"]',
    );
    const file = new File(['csv'], 'ajout.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => 'contenu csv' });
    fireEvent.change(input!, { target: { files: [file] } });

    expect(await screen.findByText('Rose ancienne')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Créer et modifier',
      }),
    );
    await waitFor(() =>
      expect(commitCatalogAddition).toHaveBeenCalledWith(
        'conflict-preview',
        'update_existing',
      ),
    );
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
    expect(
      screen.queryByRole('button', { name: 'Aide' }),
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
      'Statut',
      'Date de création',
      'Dernière modification',
      'Actions',
    ]);

    const row = screen.getByRole('row', { name: /Bordure plein soleil/u });
    expect(row).toHaveTextContent('6');
    expect(row).toHaveTextContent('à jour');
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
    expect(screen.getByText('à jour')).toBeInTheDocument();
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
      status: 'up_to_date',
      modifiedPlantCount: 0,
      deletedPlantCount: 0,
      modifiedPlants: [],
      deletedPlants: [],
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

  it('keeps a deleted-plant status until the detail warning is closed', async () => {
    listSelections.mockResolvedValue([deletedSunnyBorder]);
    getSelection.mockResolvedValueOnce(deletedSelectionDetails);
    acknowledgeDeletedPlants.mockResolvedValueOnce(reviewedSelectionDetails);
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(screen.getByRole('button', { name: 'Mes Sélections' }));
    const row = await screen.findByRole('row', {
      name: /Bordure plein soleil/u,
    });
    expect(within(row).getByText('1 plante supprimée')).toBeInTheDocument();
    fireEvent.click(
      within(row).getByRole('button', {
        name: 'Voir les détails de Bordure plein soleil',
      }),
    );

    await screen.findAllByText('1 plante supprimée');
    expect(
      document.querySelector('.selection-deleted-message'),
    ).toHaveTextContent('1 plante supprimée');
    expect(screen.queryByText('Rose ancienne')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Fermer le message des plantes supprimées',
      }),
    );

    await waitFor(() =>
      expect(acknowledgeDeletedPlants).toHaveBeenCalledWith('sunny-border'),
    );
    expect(
      document.querySelector('.selection-deleted-message'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('à jour')).toBeInTheDocument();
  });

  it('reviews deleted plants in detail and clears the pending status', async () => {
    listSelections.mockResolvedValue([deletedSunnyBorder]);
    getSelection.mockResolvedValueOnce(deletedSelectionDetails);
    acknowledgeDeletedPlants.mockResolvedValueOnce(reviewedSelectionDetails);
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

    fireEvent.click(await screen.findByRole('button', { name: 'Détails' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Plantes supprimées du catalogue',
    });
    expect(within(dialog).getByText('Rose ancienne')).toBeInTheDocument();
    expect(acknowledgeDeletedPlants).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Fermer le détail des plantes supprimées',
      }),
    );
    await waitFor(() =>
      expect(acknowledgeDeletedPlants).toHaveBeenCalledWith('sunny-border'),
    );
    expect(
      screen.queryByRole('dialog', {
        name: 'Plantes supprimées du catalogue',
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('à jour')).toBeInTheDocument();
    expect(
      document.querySelector('.selection-deleted-message'),
    ).not.toBeInTheDocument();
  });

  it('shows deletion then modification warnings on the same row', async () => {
    listSelections.mockResolvedValue([deletedSunnyBorder]);
    getSelection.mockResolvedValueOnce(mixedSelectionDetails);
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

    await screen.findByText('1 plante modifiée');
    const messages = document.querySelector('.selection-change-messages');
    expect(messages).toBeInTheDocument();
    const warnings = within(messages as HTMLElement).getAllByRole('alert');
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toHaveClass('selection-deleted-message');
    expect(warnings[0]).toHaveTextContent('1 plante supprimée');
    expect(warnings[1]).toHaveClass('selection-modified-message');
    expect(warnings[1]).toHaveTextContent('1 plante modifiée');
  });

  it('paginates plants in a selection in groups of 25', async () => {
    getSelection.mockResolvedValueOnce({
      id: sunnyBorder.id,
      name: sunnyBorder.name,
      status: 'up_to_date',
      modifiedPlantCount: 0,
      deletedPlantCount: 0,
      modifiedPlants: [],
      deletedPlants: [],
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

  it.skip('legacy SVG editor interactions (replaced by Fabric canvas coverage)', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(screen.getByRole('button', { name: 'Mes Plans' }));

    expect(
      await screen.findByRole('heading', { name: 'Mes Plans' }),
    ).toBeInTheDocument();
    expect(listPropertyPlans).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Dessiner un plan' }));

    expect(
      screen.getByRole('heading', { name: 'Nouveau plan' }),
    ).toBeInTheDocument();
    await screen.findByRole('option', { name: sunnyBorder.name });
    fireEvent.change(screen.getByLabelText('Sélection de plantes'), {
      target: { value: sunnyBorder.id },
    });

    expect(await screen.findByText('Rose ancienne')).toBeInTheDocument();
    expect(getSelection).toHaveBeenCalledWith(sunnyBorder.id);
    const drawing = screen.getByRole('img', {
      name: 'Plan de la propriété 400 par 250 centimètres',
    });
    const canvasStage = drawing.parentElement;
    expect(canvasStage).toHaveStyle({
      padding: '48px',
      transform: 'translate(calc(-50% + 0px), calc(-50% + 0px))',
    });
    expect(drawing.querySelector('#flowerbed-grid')).not.toBeInTheDocument();
    vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 250,
      width: 400,
      height: 250,
      toJSON: () => ({}),
    });
    const firstCorner = screen.getByRole('button', {
      name: 'Déplacer le coin 1 de la propriété',
    });
    expect(
      screen.getAllByRole('button', { name: /Déplacer le coin/ }),
    ).toHaveLength(4);
    const cornerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 6,
      clientY: 6,
    });
    const cornerMove = new MouseEvent('pointermove', {
      bubbles: true,
      clientX: -20,
      clientY: -15,
    });
    const cornerUp = new MouseEvent('pointerup', { bubbles: true });
    for (const event of [cornerDown, cornerMove, cornerUp]) {
      Object.defineProperty(event, 'pointerId', { value: 4 });
    }
    fireEvent(firstCorner, cornerDown);
    fireEvent(drawing, cornerMove);
    fireEvent(drawing, cornerUp);
    expect(firstCorner).toHaveAttribute('cx', '-20');
    expect(firstCorner).toHaveAttribute('cy', '-15');
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Options de l’arête 2 de la propriété',
      }),
      { clientX: 400, clientY: 125 },
    );
    const propertyEdgeMenu = screen.getByRole('menu', {
      name: 'Arête 2 de la propriété',
    });
    expect(propertyEdgeMenu).toBeInTheDocument();
    const menuDragHandle = screen.getByRole('button', {
      name: 'Déplacer le menu de l’arête',
    });
    const menuDragDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 400,
      clientY: 125,
    });
    const menuDragMove = new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 435,
      clientY: 145,
    });
    const menuDragUp = new MouseEvent('pointerup', { bubbles: true });
    for (const event of [menuDragDown, menuDragMove, menuDragUp]) {
      Object.defineProperty(event, 'pointerId', { value: 6 });
    }
    fireEvent(menuDragHandle, menuDragDown);
    fireEvent(menuDragHandle, menuDragMove);
    fireEvent(menuDragHandle, menuDragUp);
    expect(propertyEdgeMenu).toHaveStyle({
      left: 'calc(100% - 13px)',
      top: 'calc(50% + 20px)',
    });
    expect(screen.getByLabelText('Nature de l’arête')).toHaveValue('line');
    fireEvent.change(screen.getByLabelText('Nature de l’arête'), {
      target: { value: 'circular-arc' },
    });
    expect(propertyEdgeMenu).toHaveStyle({
      left: 'calc(100% - 13px)',
      top: 'calc(50% + 20px)',
    });
    expect(screen.getByLabelText('Courbure de l’arête')).toHaveValue('0.2');
    const circleCenter = screen.getByRole('button', {
      name: 'Déplacer le centre de l’arc de cercle',
    });
    expect(circleCenter).toHaveAttribute('cx', '531.25');
    expect(circleCenter).toHaveAttribute('cy', '125');
    const centerDragDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 531.25,
      clientY: 125,
    });
    const centerDragMove = new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 493.75,
      clientY: 125,
    });
    const centerDragUp = new MouseEvent('pointerup', { bubbles: true });
    for (const event of [centerDragDown, centerDragMove, centerDragUp]) {
      Object.defineProperty(event, 'pointerId', { value: 8 });
    }
    fireEvent(circleCenter, centerDragDown);
    fireEvent(drawing, centerDragMove);
    fireEvent(drawing, centerDragUp);
    expect(screen.getByLabelText('Courbure de l’arête')).toHaveValue('0.25');
    expect(circleCenter).toHaveAttribute('cx', '493.75');
    fireEvent.click(screen.getByRole('button', { name: 'Scinder l’arête' }));
    expect(
      screen.getAllByRole('button', {
        name: /Déplacer le coin \d+ de la propriété/,
      }),
    ).toHaveLength(5);
    const zoomValue = screen.getByRole('button', {
      name: 'Réinitialiser le zoom',
    });
    expect(zoomValue).toHaveTextContent('100 %');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom avant' }));
    expect(zoomValue).toHaveTextContent('125 %');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom arrière' }));
    expect(zoomValue).toHaveTextContent('100 %');
    const drawingArea = screen.getByLabelText('Zone de dessin du plan');
    fireEvent.wheel(drawingArea, { ctrlKey: false, deltaY: -100 });
    expect(zoomValue).toHaveTextContent('100 %');
    fireEvent.wheel(drawingArea, { ctrlKey: true, deltaY: -100 });
    expect(zoomValue).toHaveTextContent('110 %');
    fireEvent.wheel(drawingArea, { ctrlKey: true, deltaY: 100 });
    expect(zoomValue).toHaveTextContent('100 %');
    fireEvent.click(
      screen.getByRole('button', { name: 'Déplacer la vue vers la gauche' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Déplacer la vue vers le haut' }),
    );
    expect(canvasStage).toHaveStyle({
      transform: 'translate(calc(-50% + 80px), calc(-50% + 80px))',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Déplacer la vue vers la droite' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Déplacer la vue vers le bas' }),
    );
    expect(canvasStage).toHaveStyle({
      transform: 'translate(calc(-50% + 0px), calc(-50% + 0px))',
    });
    const middleDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 1,
      clientX: 100,
      clientY: 100,
    });
    const panMove = new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 70,
      clientY: 80,
    });
    const panEnd = new MouseEvent('pointerup', { bubbles: true });
    for (const event of [middleDown, panMove, panEnd]) {
      Object.defineProperty(event, 'pointerId', { value: 7 });
    }
    fireEvent(drawingArea, middleDown);
    fireEvent(drawingArea, panMove);
    expect(drawingArea).toHaveClass('is-panning');
    expect(canvasStage).toHaveStyle({
      transform: 'translate(calc(-50% - 30px), calc(-50% - 20px))',
    });
    fireEvent(drawingArea, panEnd);
    expect(drawingArea).not.toHaveClass('is-panning');
    fireEvent.click(
      screen.getByRole('button', { name: 'Déplacer la vue vers la droite' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Déplacer la vue vers le bas' }),
    );
    expect(canvasStage).toHaveStyle({
      transform: 'translate(calc(-50% - 110px), calc(-50% - 100px))',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Centrer la vue sur le plan' }),
    );
    expect(canvasStage).toHaveStyle({
      transform: 'translate(calc(-50% + 10px), calc(-50% + 7.5px))',
    });
    expect(screen.getByRole('button', { name: 'Déplacer' })).toHaveClass(
      'active',
    );
    fireEvent.click(screen.getByRole('button', { name: /Rose ancienne/ }));
    expect(
      screen.getByRole('button', { name: 'Placer la plante' }),
    ).toHaveClass('active');

    fireEvent.contextMenu(drawing);

    expect(screen.getByRole('button', { name: 'Déplacer' })).toHaveClass(
      'active',
    );
    expect(
      screen.getByRole('button', { name: 'Placer la plante' }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Nom'), {
      target: { value: 'Plan maison' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Dessiner un parterre' }),
    );
    const flowerbedDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 80,
      clientY: 60,
    });
    const flowerbedMove = new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 200,
      clientY: 150,
    });
    const flowerbedUp = new MouseEvent('pointerup', { bubbles: true });
    for (const event of [flowerbedDown, flowerbedMove, flowerbedUp]) {
      Object.defineProperty(event, 'pointerId', { value: 9 });
    }
    fireEvent(drawing, flowerbedDown);
    fireEvent(drawing, flowerbedMove);
    fireEvent(drawing, flowerbedUp);
    expect(
      screen.getByRole('button', { name: 'Sélectionner le parterre 1' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Options de l’arête 1 du parterre 1',
      }),
      { clientX: 140, clientY: 60 },
    );
    expect(
      screen.getByRole('menu', { name: 'Arête 1 du parterre 1' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nature de l’arête'), {
      target: { value: 'elliptical-arc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Scinder l’arête' }));
    expect(
      screen.getAllByRole('button', {
        name: /Déplacer le coin \d+ du parterre 1/,
      }),
    ).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(savePropertyPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Plan maison',
          propertyBoundaryPoints: [
            { xCm: -20, yCm: -15 },
            {
              xCm: 400,
              yCm: 0,
              edgeKind: 'circular-arc',
              edgeCurvature: 0.25,
            },
            {
              xCm: 337.5,
              yCm: 125,
              edgeKind: 'circular-arc',
              edgeCurvature: 0.25,
            },
            { xCm: 400, yCm: 250 },
            { xCm: 0, yCm: 250 },
          ],
          flowerbeds: [
            expect.objectContaining({
              xCm: expect.closeTo(78.18375162901856, 8),
              yCm: 60,
              widthCm: expect.closeTo(123.63249674196288, 8),
              heightCm: 90,
              boundaryPoints: [
                {
                  xCm: 80,
                  yCm: 60,
                  edgeKind: 'elliptical-arc',
                  edgeCurvature: 0.3,
                },
                {
                  xCm: 140,
                  yCm: 96,
                  edgeKind: 'elliptical-arc',
                  edgeCurvature: 0.3,
                },
                { xCm: 200, yCm: 60 },
                { xCm: 200, yCm: 150 },
                { xCm: 80, yCm: 150 },
              ],
            }),
          ],
        }),
      ),
    );
  });

  it.skip('legacy SVG plant rendering (replaced by Fabric canvas coverage)', async () => {
    const design: PropertyPlanDesign = {
      id: 'property-plan-1',
      name: 'Massif rose',
      selectionId: sunnyBorder.id,
      widthCm: 300,
      heightCm: 200,
      flowerbedCount: 1,
      placementCount: 1,
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
      propertyBoundaryPoints: [
        { xCm: 0, yCm: 0 },
        { xCm: 300, yCm: 0 },
        { xCm: 300, yCm: 200 },
        { xCm: 0, yCm: 200 },
      ],
      flowerbeds: [
        {
          id: 'flowerbed-1',
          xCm: 10,
          yCm: 10,
          widthCm: 280,
          heightCm: 180,
          boundaryPoints: [
            { xCm: 10, yCm: 10 },
            { xCm: 290, yCm: 10 },
            { xCm: 290, yCm: 190 },
            { xCm: 10, yCm: 190 },
          ],
        },
      ],
      placements: [
        {
          id: 'placement-1',
          flowerbedId: 'flowerbed-1',
          plantId: rose.id,
          plantNameSnapshot: rose.name,
          spacingCmSnapshot: 40,
          colorSnapshot: 'Rose',
          xCm: 100,
          yCm: 100,
        },
      ],
    };
    listPropertyPlans.mockResolvedValueOnce([design]);
    getPropertyPlan.mockResolvedValueOnce(design);
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(screen.getByRole('button', { name: 'Mes Plans' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }));

    const title = await screen.findByText(/Rose ancienne · diamètre 40 cm/);
    const circle = title.parentElement?.querySelector('circle');
    expect(circle).toHaveStyle({ fill: '#ec4899' });
    const drawing = screen.getByRole('img', {
      name: 'Plan de la propriété 300 par 200 centimètres',
    });
    vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 300,
      bottom: 200,
      width: 300,
      height: 200,
      toJSON: () => ({}),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Déplacer' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Sélectionner le parterre 1' }),
    );
    const flowerbedCorners = screen.getAllByRole('button', {
      name: /Déplacer le coin \d+ du parterre 1/,
    });
    expect(flowerbedCorners).toHaveLength(4);
    const flowerbedCornerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    const flowerbedCornerMove = new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 40,
      clientY: 35,
    });
    const flowerbedCornerUp = new MouseEvent('pointerup', { bubbles: true });
    for (const event of [
      flowerbedCornerDown,
      flowerbedCornerMove,
      flowerbedCornerUp,
    ]) {
      Object.defineProperty(event, 'pointerId', { value: 8 });
    }
    fireEvent(flowerbedCorners[0]!, flowerbedCornerDown);
    fireEvent(drawing, flowerbedCornerMove);
    fireEvent(drawing, flowerbedCornerUp);
    expect(flowerbedCorners[0]).toHaveAttribute('cx', '40');
    expect(flowerbedCorners[0]).toHaveAttribute('cy', '35');
  });

  it('opens the focused Fabric planner without generic drawing controls', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');

    fireEvent.click(screen.getByRole('button', { name: 'Mes Plans' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Dessiner un plan' }),
    );

    expect(screen.getByLabelText('Nom du plan')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Plan interactif du parterre'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '+ Ajouter un parterre' }),
    ).not.toBeInTheDocument();
    const editorToolbar = screen.getByLabelText('Outils du plan');
    expect(
      within(editorToolbar).getByRole('button', { name: '↶ Annuler' }),
    ).toBeDisabled();
    expect(
      within(editorToolbar).getByRole('button', { name: '↷ Rétablir' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Rectangle' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Grille')).not.toBeInTheDocument();

    await screen.findByRole('option', { name: sunnyBorder.name });
    fireEvent.change(screen.getByLabelText('Sélection'), {
      target: { value: sunnyBorder.id },
    });
    expect(await screen.findByText('Rose ancienne')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dimensions' }));
    expect(
      screen.getByRole('dialog', { name: 'Dimensions du parterre' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Largeur (cm)')).toHaveValue(400);
    expect(screen.getByLabelText('Longueur (cm)')).toHaveValue(250);
    fireEvent.change(screen.getByLabelText('Largeur (cm)'), {
      target: { value: '500' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(
      within(editorToolbar).getByRole('button', { name: '↶ Annuler' }),
    ).toBeEnabled();
    expect(screen.getByText('500 × 250 cm')).toBeInTheDocument();
  });
});
