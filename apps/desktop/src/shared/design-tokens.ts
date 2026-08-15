/**
 * Concrete counterparts for CSS tokens used by APIs that cannot resolve
 * custom properties (Electron BrowserWindow and Fabric.js). The design-system
 * lint checks every annotated value against design-system.css.
 */
export const desktopColor = {
  appSurface: '#f8faf7', // design-token: --color-surface-app
} as const;

export const canvasColor = {
  brand: '#2f7d32', // design-token: --color-brand
  brandDark: '#245e26', // design-token: --color-brand-hover
  danger: '#dc2626', // design-token: --color-danger
  dangerDark: '#991b1b', // design-token: --color-danger-strong
  warning: '#a16207', // design-token: --color-warning
  warningMarker: '#facc15', // design-token: --color-warning-border
  selection: '#f97316', // design-token: --color-accent
  text: '#000', // design-token: --color-text
  label: '#666', // design-token: --color-text-secondary
  propertyBoundary: '#245e26', // design-token: --color-brand-hover
  flowerbedBoundary: '#2f7d32', // design-token: --color-brand
  surface: '#fff', // design-token: --color-surface
  transparentHitArea: 'rgba(0, 0, 0, 0.001)', // design-token: --color-transparent-hit-area
  plantSpace: 'rgba(47, 125, 50, 0.13)', // design-token: --color-brand-fill
  overlappingPlantSpace: 'rgba(220, 38, 38, 0.14)', // design-token: --color-danger-fill
  propertyFill: 'rgba(255, 255, 255, 0.76)', // design-token: --color-surface-translucent
  flowerbedFill: 'rgba(47, 125, 50, 0.13)', // design-token: --color-brand-fill
  previewWarningFill: 'rgba(161, 98, 7, 0.18)', // design-token: --color-warning-fill
  previewDangerFill: 'rgba(220, 38, 38, 0.14)', // design-token: --color-danger-fill
} as const;

export const dataColor = {
  white: '#f8fafc', // design-token: --data-color-white
  blue: '#60a5fa', // design-token: --data-color-blue
  yellow: '#facc15', // design-token: --data-color-yellow
  orange: '#fb923c', // design-token: --data-color-orange
  pink: '#ec4899', // design-token: --data-color-pink
  red: '#ef4444', // design-token: --data-color-red
  green: '#4ade80', // design-token: --data-color-green
  purple: '#a78bfa', // design-token: --data-color-purple
  default: '#6fb570', // design-token: --data-color-default
} as const;
