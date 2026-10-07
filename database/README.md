# Database

PostgreSQL schemas, migrations, seeds, and related documentation are stored here.

## Current Schema

- Engine: PostgreSQL 16+
- Specification: `../docs/specifications/database-schema-v1.md`
- Initial migration: `migrations/0001_initial_schema.sql`

The migration expects an empty database and runs transactionally. Canonical component and project JSON documents must pass their JSON Schema and semantic validators before database writes; SQL constraints provide an additional envelope-integrity layer.
