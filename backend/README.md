# Backend

Fastify REST API and transactional application-service process.

Foundation endpoints:

- `GET /health` — process liveness.
- `GET /ready` — skeleton readiness; dependency probes are added with their owning milestones.
- `GET /api/v1` — API, schema-contract, and rule-engine baseline metadata.
- `GET /api/v1/openapi.json` — generated OpenAPI document for registered routes.
- `POST /api/v1/session/login` — create a rate-limited server-side session.
- `GET /api/v1/session` — return the active session principal.
- `POST /api/v1/session/logout` — revoke the active session.

Every response includes `x-request-id`. HTTP failures use the shared error envelope with a stable code, message, request ID, and details array.

Run from the repository root with `corepack pnpm --filter @hwsd/backend dev`.

To create the first local account after applying migrations, set `HWSD_BOOTSTRAP_PASSWORD` to a temporary value of at least 12 characters and run:

```text
corepack pnpm --filter @hwsd/backend user:create -- --email=admin@example.com --name="Local Admin" --role=ADMIN
```

Remove the temporary environment variable immediately afterward. Passwords are never accepted as command-line arguments.
