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
  CatalogImportResult,
  CatalogPage,
  CatalogPlant,
  PhotoDeleteResult,
  PhotoImportResult,
} from '../src/shared/catalog';
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

function page(number: number): CatalogPage {
  return {
    items: [{ ...rose, id: `rose-${number}`, name: `Rose page ${number}` }],
    page: number,
    pageSize: 25,
    total: 26,
  };
}

describe('App catalog', () => {
  const listPlants = vi.fn<(page: number) => Promise<CatalogPage>>();
  const replaceCatalog =
    vi.fn<(filename: string, csv: string) => Promise<CatalogImportResult>>();
  const importPhotos =
    vi.fn<
      (
        files: readonly { name: string; bytes: Uint8Array }[],
      ) => Promise<PhotoImportResult>
    >();
  const deletePhoto = vi.fn<(plantId: string) => Promise<PhotoDeleteResult>>();

  beforeEach(() => {
    vi.clearAllMocks();
    listPlants.mockImplementation(async (number) => page(number));
    replaceCatalog.mockResolvedValue({ ok: true, imported: 1 });
    importPhotos.mockResolvedValue({ ok: true, imported: 1, unmatched: [] });
    deletePhoto.mockResolvedValue({ ok: true });
    window.catalogApi = {
      listPlants,
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
    expect(screen.queryByText('Catalogue des plantes')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Gérer le catalogue/u }),
    ).toHaveClass('secondary-button');
    expect(
      screen.getAllByRole('columnheader').map((heading) => heading.textContent),
    ).toEqual([
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
  });

  it('loads the next group of 25 plants from the database boundary', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    await waitFor(() => expect(listPlants).toHaveBeenLastCalledWith(2));
    expect(await screen.findByText('Rose page 2')).toBeInTheDocument();
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
    await waitFor(() => expect(listPlants).toHaveBeenLastCalledWith(1));
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
});
