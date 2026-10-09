# Frontend

React and Vite browser application.

M3 provides the searchable/filterable component library, immutable revision detail, manual
Component Schema V1 authoring with structural and semantic validation, and an administrator review
queue with revision comparison and lifecycle decisions. It stores neither credentials nor session
tokens in browser storage.

M4 adds the project dashboard and persistent editor shell: create, search, rename, open, export,
Create Copy import, confirmed soft deletion, three-second idle autosave, browser recovery, retry,
and explicit optimistic-concurrency conflict handling.

M6 adds the command-based engineering editor with bounded undo/redo, keyboard and pointer layout,
pan/zoom persistence, component/connection inspection, bus and power setup, live rule findings,
explicit warning confirmation, Design Check staleness, and component revision impact review.

Run from the repository root with `corepack pnpm --filter @hwsd/frontend dev`.
