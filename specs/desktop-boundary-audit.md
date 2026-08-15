# Desktop package boundary audit

The Electron application should remain a composition root: it owns IPC,
window/runtime setup, short-lived preview tokens, and orchestration across
adapters. Reusable business rules belong in packages consumed by every app.

## Extracted in this change

Catalog-addition analysis and commit policy now live in `packages/core` beside
the equivalent catalog-modification and deletion rules. Desktop keeps CSV
adapter invocation and preview-token lifetime, as required by the catalog
incremental-update architecture.

Catalog pagination and plant/selection DTO mapping now live in `packages/core`.
Photo URL creation is an injected port, while desktop wires the `garden-photo`
implementation to the reusable mapping functions.

Photo matching, checksum calculation, staging policy, persistence ordering,
rollback cleanup, and previous-file cleanup now live in
`packages/photo-handling` behind repository, storage, and transaction ports.
Desktop selects the Electron application directory and supplies filesystem and
SQLite adapters.

Property-plan editor transitions and geometry now live in `packages/core`. The
renderer owns only Fabric and React interaction around that shared model.

Renderer-only formatting, DOM downloads, IPC handlers, Electron protocol
registration, dev-server discovery, window creation, and platform runtime
configuration remain appropriately desktop-specific.
