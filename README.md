# Hardware System Designer

Web-based engineering tool for designing hardware system block diagrams with datasheet-driven component generation, pin-level interface validation, power checks, peripheral allocation, and design rule checking.

## Current Status

M5 deterministic connection and engineering Rule Engine. The pure shared engine implements the 38
required V1 structural, interface, electrical, allocation, bus, power, completeness, and lifecycle
rules across preview, commit, and full Design Check modes.

## Prerequisites

- Node.js 24 LTS
- Corepack
- Docker with Compose for PostgreSQL and object-storage services

The project pins pnpm through the root `packageManager` field; a global pnpm installation is not required.

## Quick Start

```text
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
corepack pnpm infra:up
corepack pnpm db:migrate
corepack pnpm dev
```

On non-PowerShell shells, copy `.env.example` to `.env` with the equivalent local command. The web shell is served at `http://127.0.0.1:5173`, the API at `http://127.0.0.1:3000`, and the MinIO console at `http://127.0.0.1:9001`.

Run the complete non-container verification gate with:

```text
corepack pnpm verify
```

After changing a canonical file in `docs/schemas`, regenerate and review the derived artifacts with `corepack pnpm contracts:generate`. CI rejects uncommitted generated drift.

With PostgreSQL running and `DATABASE_URL` loaded from `.env`, verify all migrations in an isolated schema with:

```text
corepack pnpm db:migrate:smoke
```

To exercise the complete M3 publication transaction against an isolated PostgreSQL schema, run:

```text
corepack pnpm db:component:smoke
```

To verify the M4 compare-and-swap, export/Create Copy import, audit, and soft-delete flow against
PostgreSQL, run:

```text
corepack pnpm db:project:smoke
```

## Repository Structure

- `docs/` — engineering specifications, architecture, schemas, UI/UX, and design decisions.
- `frontend/` — web application frontend.
- `backend/` — backend API and application services.
- `ai/` — datasheet parsing and AI-related logic.
- `rule-engine/` — deterministic engineering validation rules.
- `database/` — database schema, migrations, and related documentation.
- `shared/` — shared types, constants, and utilities.
- `tests/` — automated and integration tests.
- `scripts/` — development, maintenance, and utility scripts.

## Architecture Boundaries

- `shared` has no dependency on application packages.
- `rule-engine` is pure and depends only on `shared`.
- `backend` owns synchronous authorization, application commands, and transactions.
- `ai` is a separate worker process and has no engineering-decision authority.
- `frontend` may preview engineering behavior, but the backend always revalidates persistent changes.

See `docs/architecture/implementation-plan-v1.md` and `docs/decisions/` for the normative implementation baseline.

## V1 Focus

V1 focuses on engineering-aware hardware block diagram design, datasheet-based component creation, pin-level modeling, interface compatibility, power validation, peripheral allocation, and Design Check.

Schematic generation and PCB design/export are outside the V1 scope.
