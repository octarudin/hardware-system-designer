# Backend

Fastify REST API and transactional application-service process.

M0 endpoints:

- `GET /health` — process liveness.
- `GET /ready` — skeleton readiness; dependency probes are added with their owning milestones.
- `GET /api/v1` — API, schema-contract, and rule-engine baseline metadata.

Run from the repository root with `corepack pnpm --filter @hwsd/backend dev`.
