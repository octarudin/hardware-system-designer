# Backend

Fastify REST API and transactional application-service process.

Foundation endpoints:

- `GET /health` — process liveness.
- `GET /ready` — skeleton readiness; dependency probes are added with their owning milestones.
- `GET /api/v1` — API, schema-contract, and rule-engine baseline metadata.
- `GET /api/v1/openapi.json` — generated OpenAPI document for registered routes.

Every response includes `x-request-id`. HTTP failures use the shared error envelope with a stable code, message, request ID, and details array.

Run from the repository root with `corepack pnpm --filter @hwsd/backend dev`.
