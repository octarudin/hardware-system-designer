# ADR-0001: TypeScript and pnpm Workspace

**Status:** ACCEPTED  
**Date:** 2026-10-07

## Context

V1 requires browser, API, worker, deterministic rule-engine, and shared-contract code. The rule engine and schema-derived contracts must execute consistently in browser and server environments. Independent repositories would add publication and version-skew overhead before the first product release.

## Decision

Use a private pnpm workspace on Node.js 24 LTS. Application and shared packages use strict TypeScript. The root `packageManager`, lockfile, engine constraints, and CI runtime pin the executable toolchain.

The initial package set is:

- `@hwsd/frontend`
- `@hwsd/backend`
- `@hwsd/ai`
- `@hwsd/rule-engine`
- `@hwsd/shared`

Exact dependency resolution is committed in `pnpm-lock.yaml`. Dependency upgrades are isolated from feature changes after M0.

The M0 compatibility matrix is:

| Tool or framework         |                      Baseline |
| ------------------------- | ----------------------------: |
| Node.js                   | 24.12.0 LTS (`>=24.12.0 <25`) |
| pnpm                      |                        12.9.1 |
| TypeScript                |                         6.0.3 |
| React / React DOM         |                        19.3.0 |
| Vite / React plugin       |                 8.3.3 / 6.1.2 |
| React Flow                |                       12.12.0 |
| Fastify                   |                        5.12.5 |
| Ajv                       |                        8.20.0 |
| Vitest                    |                         5.0.3 |
| Playwright                |                        1.63.0 |
| PostgreSQL local/CI image |                  16.15 Alpine |

TypeScript 7 was evaluated and rejected from the baseline because the stable TypeScript ESLint parser selected for M0 supports TypeScript versions below 6.1. The project uses the latest compatible stable TypeScript line instead of suppressing the peer incompatibility.

## Consequences

- Cross-package changes can be atomic and tested together.
- Browser-safe domain code can be reused without publishing packages.
- pnpm's declared-dependency isolation exposes accidental imports early.
- The workspace must actively enforce package boundaries to avoid becoming an unstructured monolith.
- Node.js 24 and pnpm 12 are development and CI prerequisites.

## Alternatives Considered

- Multiple repositories: rejected for V1 because contract publication and coordinated versioning add avoidable delivery overhead.
- npm workspaces: viable, but pnpm provides stricter dependency isolation and an explicit workspace protocol.
- A non-TypeScript backend: rejected because it would duplicate core contract and rule representations across runtimes.
