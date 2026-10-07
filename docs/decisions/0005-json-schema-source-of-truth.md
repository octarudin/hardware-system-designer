# ADR-0005: JSON Schema as the Contract Source of Truth

**Status:** ACCEPTED  
**Date:** 2026-10-07

## Context

Component, port/interface, rule-result, and project documents cross browser, API, database, import/export, recovery, and worker boundaries. Hand-maintained TypeScript types would not validate untrusted runtime data and could diverge from the approved specifications.

## Decision

Treat the committed JSON Schema Draft 2020-12 documents in `docs/schemas` as source artifacts. Validate them with one strict Ajv 2020 registry that resolves known `$ref` values offline by exact `$id`.

TypeScript contract types are derived artifacts. They are reproducible and never manually edited. Structural schema validation is followed by explicit semantic validation for references, uniqueness, lifecycle, allocation, and rule behavior.

Unknown schema and ruleset versions fail closed. Every write path, including administrative and worker paths, uses the same validators before persistence. PostgreSQL constraints provide defense in depth but do not replace application validation.

## Consequences

- Runtime validation and static types share one declared contract.
- CI must detect schema/type drift and validate canonical fixtures.
- Validation errors require a stable application mapping rather than exposing raw library errors.
- Schema evolution requires a new identifier and an explicit migration path.

## Alternatives Considered

- TypeScript-first schemas: rejected because the normative machine-readable schemas already exist and non-TypeScript consumers may need them.
- Database-only validation: rejected because PostgreSQL does not implement the full cross-file and semantic contract.
- Independent frontend/backend validators: rejected because they would create divergent acceptance behavior.
