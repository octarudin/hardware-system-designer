# Scripts

`component-smoke.mjs` runs the real M3 publication repository against an isolated PostgreSQL
schema. It verifies manual submission, administrator verification, projection updates, review and
audit records, and the immutable-revision trigger. Run it with `pnpm db:component:smoke` after
setting `DATABASE_URL`.

Development and maintenance scripts.

- `migration-smoke.mjs` applies every migration inside a temporary PostgreSQL schema, verifies the expected tables, and removes the temporary schema. It requires `DATABASE_URL` and does not modify the public schema.
- `migrate.mjs` applies pending SQL migrations transactionally under a PostgreSQL advisory lock and rejects checksum drift in previously applied files.
- `generate-contracts.mjs` deterministically derives browser-safe schema assets and TypeScript contracts from `docs/schemas`; pass `--check` to fail on drift without writing files.
