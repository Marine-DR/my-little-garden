import { describe, expect, it } from 'vitest';
import { dataColor } from '../src/shared/design-tokens';
import { catalogColorToCss } from '../src/renderer/pages/property-plans/catalog-color';

describe('catalogColorToCss', () => {
  it('translates normalized French catalog values to data colors', () => {
    expect(catalogColorToCss('  Bléu ')).toBe(dataColor.blue);
    expect(catalogColorToCss('ROSE')).toBe(dataColor.pink);
  });

  it('uses the default data color for missing or unknown values', () => {
    expect(catalogColorToCss(null)).toBe(dataColor.default);
    expect(catalogColorToCss('marron')).toBe(dataColor.default);
  });
});
