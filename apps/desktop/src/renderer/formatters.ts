import type { CatalogPlant } from '../shared/catalog';

export const EMPTY_VALUE = '-';

const MONTHS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

const KIND_LABELS: Record<NonNullable<CatalogPlant['kind']>, string> = {
  flower: 'Fleur',
  foliage: 'Feuillage',
  grass: 'Graminée',
  other: 'Autre',
};

export const EXPOSURES = {
  sun: { icon: '☀', label: 'Soleil' },
  partial_shade: { icon: '◐', label: 'Mi-ombre' },
  shade: { icon: '●', label: 'Ombre' },
} as const;

export const PERSISTENCE = {
  evergreen: { icon: '✓', label: 'Persistant' },
  semi_evergreen: { icon: '◐', label: 'Semi-persistant' },
  deciduous: { icon: '✕', label: 'Caduc' },
} as const;

const SEASONS = {
  spring: 'Printemps',
  summer: 'Été',
  autumn: 'Automne',
  winter: 'Hiver',
} as const;

const COLOR_EMOJIS: Record<string, string> = {
  blanc: '⚪',
  jaune: '🟡',
  rouge: '🔴',
  violet: '🟣',
  bleu: '🔵',
  rose: '🩷',
  orange: '🟠',
  vert: '🟢',
  marron: '🟤',
  brun: '🟤',
  noir: '⚫',
};

export function colorEmoji(label: string): string | null {
  const key = label.trim().normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  return COLOR_EMOJIS[key] ?? null;
}

export function formatRange(minimum: number | null, maximum: number | null): string {
  if (minimum === null) return EMPTY_VALUE;
  if (maximum === null) return String(minimum);
  return minimum === maximum ? String(minimum) : `${minimum}–${maximum}`;
}

export function formatBloom(start: number | null, end: number | null): string {
  if (start === null || end === null) return EMPTY_VALUE;
  const startLabel = MONTHS[start - 1];
  const endLabel = MONTHS[end - 1];
  if (!startLabel || !endLabel) return EMPTY_VALUE;
  return start === end ? startLabel : `${startLabel}→${endLabel}`;
}

export function formatList(values: readonly string[]): string {
  return values.length === 0 ? EMPTY_VALUE : values.join(', ');
}

export function formatKind(kind: CatalogPlant['kind']): string {
  return kind === null ? EMPTY_VALUE : KIND_LABELS[kind];
}

export function formatSeasons(seasons: CatalogPlant['plantingSeasons']): string {
  return seasons.length === 0 ? EMPTY_VALUE : seasonLabels(seasons).join(', ');
}

export function seasonLabels(seasons: CatalogPlant['plantingSeasons']): string[] {
  return seasons.map((season) => SEASONS[season]);
}

export function formatNumber(value: number | null): string {
  return value === null ? EMPTY_VALUE : String(value);
}
