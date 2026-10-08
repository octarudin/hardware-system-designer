# Database

PostgreSQL schemas, migrations, seeds, and related documentation are stored here.

## Current Schema

- Engine: PostgreSQL 16+
- Specification: `../docs/specifications/database-schema-v1.md`
- Initial domain migration: `migrations/0001_initial_schema.sql`
- Authentication session migration: `migrations/0002_auth_sessions.sql`

The migration expects an empty database and runs transactionally. Canonical component and project JSON documents must pass their JSON Schema and semantic validators before database writes; SQL constraints provide an additional envelope-integrity layer.

## Local Infrastructure

From the repository root:

```text
corepack pnpm infra:up
corepack pnpm db:migrate
corepack pnpm db:migrate:smoke
```

The smoke test uses a temporary schema and removes it after verification. It does not install the application schema into the local `public` schema.
