# Hardware System Designer

Web-based engineering tool for designing hardware system block diagrams with datasheet-driven component generation, pin-level interface validation, power checks, peripheral allocation, and design rule checking.

## Current Status

V1 implementation-planning phase. Engineering, data, database, and UI/UX baselines are established; application coding has not started.

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

## V1 Focus

V1 focuses on engineering-aware hardware block diagram design, datasheet-based component creation, pin-level modeling, interface compatibility, power validation, peripheral allocation, and Design Check.

Schematic generation and PCB design/export are outside the V1 scope.
