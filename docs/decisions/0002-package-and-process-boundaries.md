# ADR-0002: Package and Process Boundaries

**Status:** ACCEPTED  
**Date:** 2026-10-07

## Context

The system contains UI concerns, transactional application services, deterministic engineering rules, and untrusted asynchronous AI extraction. These responsibilities have different failure modes and must not share authority accidentally.

## Decision

Adopt a modular monorepo with three deployable processes:

- `web` serves the browser application.
- `api` owns authentication, authorization, synchronous application commands, and database transactions.
- `worker` processes leased datasheet-import jobs and calls the selected AI provider.

Dependency direction is fixed:

```text
shared <- rule-engine <- backend
   ^          ^            ^
   |          |            |
frontend -----+          ai (through explicit ports)
```

`shared` has no application-package dependency. `rule-engine` is pure and depends only on browser-safe `shared` exports. `frontend` cannot import backend internals. `backend` cannot import concrete UI or provider code. The worker may publish only through the same validators and application transaction used by the API.

## Consequences

- Engineering behavior can be tested independently and run in both browser and server.
- A worker or provider outage cannot take down synchronous project editing.
- Backend validation remains authoritative even when the frontend performs previews.
- Some types and adapters are intentionally duplicated at process boundaries when sharing would introduce an invalid dependency.

## Alternatives Considered

- One Node.js process: rejected because AI workloads and retries need an independent failure and scaling boundary.
- Microservices per domain: rejected as unnecessary operational complexity for V1.
- Frontend-only rule validation: rejected because a client result cannot authorize persistent engineering changes.
