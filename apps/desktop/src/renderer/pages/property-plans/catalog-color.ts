import { dataColor } from '../../../shared/design-tokens';

type DataColorName = Exclude<keyof typeof dataColor, 'default'>;

/** Catalog color values are French because they come directly from imported
 * French catalog data. Keep the translation here at that domain boundary. */
const dataColorNameByFrenchCatalogValue: Readonly<
  Record<string, DataColorName>
> = {
  blanc: 'white',
  bleu: 'blue',
  jaune: 'yellow',
  orange: 'orange',
  rose: 'pink',
  rouge: 'red',
  vert: 'green',
  violet: 'purple',
};

export function catalogColorToCss(value: string | null): string {
  if (!value) {
    return dataColor.default;
  }

  const normalizedValue = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .trim();
  const colorName = dataColorNameByFrenchCatalogValue[normalizedValue];

  return colorName ? dataColor[colorName] : dataColor.default;
}
