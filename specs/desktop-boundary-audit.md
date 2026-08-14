# Desktop package boundary audit

The Electron application should remain a composition root: it owns IPC,
window/runtime setup, short-lived preview tokens, and orchestration across
adapters. Reusable business rules belong in packages consumed by every app.

## Extracted in this change

Catalog-addition analysis and commit policy now live in `packages/core` beside
the equivalent catalog-modification and deletion rules. Desktop keeps CSV
adapter invocation and preview-token lifetime, as required by the catalog
incremental-update architecture.

## Remaining candidates

- Catalog pagination and plant/selection DTO mapping in `main/catalog-view.ts`
  are platform-independent. They could move to core once photo URL creation is
  represented as an injected port rather than a concrete photo-handling call.
- Photo matching, checksum calculation, staging, and cleanup in
  `main/photo-import.ts` mix reusable photo workflow with SQLite transactions.
  A later change could extract a storage/repository-driven photo import service
  without moving Electron's application-directory selection.
- Property-plan editor transitions in `renderer/pages/property-plans/plan-editor-model.ts`
  are framework-independent and could become a core editing model when another
  client needs the same behavior.

Renderer-only formatting, DOM downloads, IPC handlers, Electron protocol
registration, dev-server discovery, window creation, and platform runtime
configuration remain appropriately desktop-specific.
