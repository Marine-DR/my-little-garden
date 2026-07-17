import type { ExposureCode } from '@my-little-garden/core';

export const MONTH_LABELS = [
  'Jan',
  'Fév',
  'Mars',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
] as const;

export const EXPOSURE_LABELS: Record<
  ExposureCode,
  { readonly icon: string; readonly label: string }
> = {
  sun: { icon: '☀', label: 'Soleil' },
  partial_shade: { icon: '◐', label: 'Mi-ombre' },
  shade: { icon: '●', label: 'Ombre' },
};
