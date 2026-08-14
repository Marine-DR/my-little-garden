/**
 * Runtime counterparts to visual tokens that non-CSS APIs need as concrete
 * color strings. Keep these values aligned with renderer/design-system.css.
 */
export const desktopColor = {
  appSurface: '#f8faf7',
} as const;

export const canvasColor = {
  brand: '#2f7d32',
  brandDark: '#245e26',
  danger: '#dc2626',
  dangerDark: '#991b1b',
  warning: '#d97706',
  warningMarker: '#f59e0b',
  selection: '#f97316',
  text: '#173e18',
  label: '#526455',
  propertyBoundary: '#315a34',
  flowerbedBoundary: '#53824d',
  surface: '#fff',
  transparentHitArea: 'rgba(0, 0, 0, 0.001)',
  plantSpace: 'rgba(47, 125, 50, 0.12)',
  overlappingPlantSpace: 'rgba(220, 38, 38, 0.14)',
  propertyFill: 'rgba(255, 255, 255, 0.76)',
  flowerbedFill: 'rgba(104, 155, 93, 0.16)',
  previewWarningFill: 'rgba(217, 119, 6, 0.18)',
  previewDangerFill: 'rgba(220, 38, 38, 0.2)',
} as const;

const plantColorByLabel: Readonly<Record<string, string>> = {
  blanc: '#f8fafc',
  bleu: '#60a5fa',
  jaune: '#facc15',
  orange: '#fb923c',
  rose: '#ec4899',
  rouge: '#ef4444',
  vert: '#4ade80',
  violet: '#a78bfa',
};

const defaultPlantColor = '#6fb570';

export function colorLabelToCss(label: string | null): string {
  if (!label) {
    return defaultPlantColor;
  }

  const normalized = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .trim();

  return plantColorByLabel[normalized] ?? defaultPlantColor;
}
