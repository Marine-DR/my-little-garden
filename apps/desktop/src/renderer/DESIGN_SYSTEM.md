# Renderer design system

`design-system.css` is the single source of truth for renderer typography,
spacing, shapes, semantic colors, and elevation. `styles.css` contains page and
component rules and should consume those custom properties instead of repeating
literal design values.

## Token choices

- Prefer semantic color names such as `--color-brand` and
  `--color-danger-surface`. The `--color-planner-*` group is deliberately scoped
  to the focused planner, whose softer palette differs from the application
  chrome.
- Use the numeric spacing tokens (`--space-8`, `--space-16`, and so on) for gaps
  and repeated padding. Their suffix is the rendered pixel value, which makes
  dense desktop layouts easy to review.
- Reuse the radius, control, icon, focus, overlay, and shadow tokens before
  introducing another literal effect.
- Add a new token only when a value represents a reusable visual decision. A
  one-off geometry value (canvas dimensions, grid columns, or positioning) stays
  with its component.

Fabric.js and Electron's window configuration need concrete color strings rather
than CSS custom properties. Their equivalent runtime palette and the shared
plant-label mapping live in `../shared/design-tokens.ts`; components should
import from there rather than define local color maps.

`npm run lint:design-system` protects the boundary: component CSS may not add
raw colors, font sizes, numeric font weights, gaps, or box shadows. Define or
reuse a token first.
