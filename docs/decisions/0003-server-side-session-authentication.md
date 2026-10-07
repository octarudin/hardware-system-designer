# ADR-0003: Server-Side Session Authentication

**Status:** ACCEPTED  
**Date:** 2026-10-07

## Context

V1 supports email/password login, `USER` and `ADMIN` roles, owner-scoped projects, and privileged component review. The browser application and API share a first-party deployment boundary. Session revocation and disabled-account enforcement are more important than stateless cross-service authentication.

## Decision

Use Argon2id password hashes and opaque, high-entropy session tokens. Store only a token digest in PostgreSQL. Send the raw token in a `Secure`, `HttpOnly`, same-site cookie.

The server validates session expiry, revocation, user status, role, and resource ownership for every protected request. State-changing requests use a documented CSRF defense selected at decision gate D1. Login endpoints are rate-limited and do not reveal whether an email exists.

Session storage is introduced by an additive migration in M2. Credentials and tokens never enter project documents, logs, audit metadata, or browser local storage.

## Consequences

- Sessions can be revoked immediately and disabled users can be denied centrally.
- API and browser deployment must preserve HTTPS and cookie attributes.
- PostgreSQL participates in authenticated request availability.
- A future public API may require a separate token design; this decision does not pre-authorize one.

## Alternatives Considered

- Browser-stored JWT bearer tokens: rejected due to revocation and browser token-exposure tradeoffs.
- External identity provider only: deferred because provider selection and account migration are not V1 prerequisites.
- HTTP Basic authentication: rejected because it does not provide the required session lifecycle.
