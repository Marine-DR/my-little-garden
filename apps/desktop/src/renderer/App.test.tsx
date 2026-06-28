import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogPage, CatalogPlant } from '../shared/catalog';
import { App } from './App';

const rose: CatalogPlant = {
  id: 'rose', name: 'Rose ancienne', photoUrl: null, heightMinCm: 50, heightMaxCm: 80,
  type: 'Vivace', kind: 'flower', soils: ['Drainé'], exposures: ['sun'],
  bloomStartMonth: 6, bloomEndMonth: 9, flowerColors: ['Rose'], leafColors: [],
  minimumTemperatureCelsius: -10, foliagePersistence: 'deciduous', spacingCm: 40,
  plantingSeasons: ['spring', 'autumn'],
};

function page(number: number): CatalogPage {
  return { items: [{ ...rose, id: `rose-${number}`, name: `Rose page ${number}` }], page: number, pageSize: 25, total: 26 };
}

describe('App catalog', () => {
  const listPlants = vi.fn<(page: number) => Promise<CatalogPage>>();

  beforeEach(() => {
    listPlants.mockImplementation(async (number) => page(number));
    window.catalogApi = { listPlants };
  });

  afterEach(cleanup);

  it('shows every requested column and uses placeholders on a single plant row', async () => {
    render(<App />);
    const row = await screen.findByRole('row', { name: /Rose page 1/ });
    expect(screen.getAllByRole('columnheader').map((heading) => heading.textContent)).toEqual([
      'Photo', 'Nom', 'Hauteur (cm)', 'Type', 'Fleur/autre', 'Sol', 'Exposition',
      'Floraison', 'Couleurs fleurs', 'Couleurs feuilles', 'Température min',
      'Feuillage persistant', 'Espace (cm)', 'Plantation',
    ]);
    expect(within(row).getAllByText('-')).toHaveLength(1);
    expect(row).toHaveTextContent('50–80');
    expect(row).toHaveTextContent('Juin→Sep');
    expect(row).toHaveTextContent('Printemps, Automne');
  });

  it('loads the next group of 25 plants from the database boundary', async () => {
    render(<App />);
    await screen.findByText('Rose page 1');
    fireEvent.click(screen.getByRole('button', { name: 'Suivant →' }));
    await waitFor(() => expect(listPlants).toHaveBeenLastCalledWith(2));
    expect(await screen.findByText('Rose page 2')).toBeInTheDocument();
  });
});
