# Architecture Decisions

Accepted architecture decisions are immutable records. A later decision may supersede an earlier one, but does not rewrite its history.

Current decisions:

- `0001-typescript-pnpm-workspace.md` — Node.js and TypeScript monorepo baseline.
- `0002-package-and-process-boundaries.md` — dependency direction and deployable processes.
- `0003-server-side-session-authentication.md` — V1 password and session model.
- `0004-postgresql-queue-and-s3-storage.md` — background-job and binary-storage infrastructure.
- `0005-json-schema-source-of-truth.md` — schema-first contract ownership and validation.
- `0006-session-threat-model.md` — concrete session expiry, cookie, CSRF, and throttling controls.
- `0007-editor-performance-envelope.md` — supported V1 project size and editor latency budgets.

Statuses are `PROPOSED`, `ACCEPTED`, `SUPERSEDED`, or `REJECTED`.
