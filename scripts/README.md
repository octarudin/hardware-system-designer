# Scripts

`component-smoke.mjs` runs the real M3 publication repository against an isolated PostgreSQL
schema. It verifies manual submission, administrator verification, projection updates, review and
audit records, and the immutable-revision trigger. Run it with `pnpm db:component:smoke` after
setting `DATABASE_URL`.

`project-smoke.mjs` exercises the M4 repository and command service against an isolated PostgreSQL
schema. It verifies compare-and-swap conflicts, cosmetic revision behavior, UTF-8 export/Create Copy
import, audit events, and soft deletion. Run it with `pnpm db:project:smoke`.

`datasheet-smoke.mjs` exercises the M7 PostgreSQL worker queue in an isolated schema. It verifies
lease claiming and heartbeat, candidate completion, recorded model metadata, terminal failure, and
expired-lease recovery. Run it with `pnpm db:datasheet:smoke`.

Development and maintenance scripts.

- `migration-smoke.mjs` applies every migration inside a temporary PostgreSQL schema, verifies the expected tables, and removes the temporary schema. It requires `DATABASE_URL` and does not modify the public schema.
- `migrate.mjs` applies pending SQL migrations transactionally under a PostgreSQL advisory lock and rejects checksum drift in previously applied files.
- `generate-contracts.mjs` deterministically derives browser-safe schema assets and TypeScript contracts from `docs/schemas`; pass `--check` to fail on drift without writing files.
