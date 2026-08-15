# Renderer design system

`design-system.css` is the single source of truth for renderer typography,
spacing, shapes, semantic colors, and elevation. `styles.css` contains page and
component rules and should consume those custom properties instead of repeating
literal design values.

## Token choices

- Prefer semantic color names such as `--color-brand` and
  `--color-danger-surface`. Features use the same application palette; do not
  create feature-specific themes.
- Use the fixed four-pixel spacing scale (`--space-4`, `--space-8`, and so on)
  for gaps and repeated padding. `--space-2` is reserved for small optical
  adjustments.
- Reuse the radius, control, icon, focus, overlay, and shadow tokens before
  introducing another literal effect.
- Add a new token only when a value represents a reusable visual decision. A
  one-off geometry value (canvas dimensions, grid columns, or positioning) stays
  with its component.

Fabric.js and Electron's window configuration need concrete color strings rather
than CSS custom properties. Their equivalent runtime palette lives in
`../shared/design-tokens.ts`. Every value is annotated with its CSS counterpart
and checked by the linter. French catalog color values are translated at the
property-plan domain boundary rather than being part of the design system.

`npm run lint:design-system` protects the boundary: it rejects unused or missing
tokens, inconsistent runtime counterparts, feature-specific planner tokens, and
raw pixels, colors, numeric font weights, or box shadows in component CSS.
