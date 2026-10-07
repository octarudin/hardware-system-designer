# Scripts

Development and maintenance scripts.

- `migration-smoke.mjs` applies the complete initial migration inside a temporary PostgreSQL schema, verifies the expected tables, and removes the temporary schema. It requires `DATABASE_URL` and does not modify the public schema.
