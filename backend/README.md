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

M3 component endpoints:

- `GET /api/v1/components` — search and filter latest component projections.
- `GET /api/v1/components/:componentId/revisions/:revision` — retrieve an immutable definition.
- `POST /api/v1/components` — validate and submit a manual component.
- `POST /api/v1/components/:componentId/revisions` — submit an owner-authored revision.
- `GET /api/v1/admin/component-reviews` — list pending administrator reviews.
- `POST /api/v1/admin/component-reviews/:componentId/:revision/actions` — publish an immutable
  administrator lifecycle decision.

M4 project endpoints:

- `GET /api/v1/projects` and `GET /api/v1/projects/:projectId` — owner-scoped project reads.
- `POST /api/v1/projects` — create an empty canonical project.
- `PUT /api/v1/projects/:projectId` — schema-validated compare-and-swap save.
- `PATCH /api/v1/projects/:projectId` — rename through the same revision rules.
- `GET /api/v1/projects/:projectId/export` — generate the portable UTF-8 representation.
- `POST /api/v1/projects/import` — fail-closed Create Copy import.
- `DELETE /api/v1/projects/:projectId` — soft-delete a project with an audit event.

Create Copy import now runs the M5 full Design Check after structural and semantic validation.
Engineering-incomplete projects may retain `COMP-001` findings, while forbidden persisted
connections, electrical conflicts, allocation conflicts, and invalid buses fail closed.

M6 project commands add immutable component snapshots, connection preview and atomic commit,
server-side warning revalidation, allocation persistence, transactional Design Check history, and
explicit component revision replacement with impact evaluation.

M7 adds owner-scoped datasheet import, short-lived authorized download, retry, candidate correction,
rejection, and atomic publication endpoints. PDF signature, parseability, size, and page limits are
validated before S3-compatible storage and queue creation.

Every response includes `x-request-id`. HTTP failures use the shared error envelope with a stable code, message, request ID, and details array.

Run from the repository root with `corepack pnpm --filter @hwsd/backend dev`.

To create the first local account after applying migrations, set `HWSD_BOOTSTRAP_PASSWORD` to a temporary value of at least 12 characters and run:

```text
corepack pnpm --filter @hwsd/backend user:create -- --email=admin@example.com --name="Local Admin" --role=ADMIN
```

Remove the temporary environment variable immediately afterward. Passwords are never accepted as command-line arguments.
