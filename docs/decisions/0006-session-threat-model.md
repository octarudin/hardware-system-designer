# ADR-0006: Session Threat Model and Browser Defenses

**Status:** ACCEPTED  
**Date:** 2026-10-08

## Context

ADR-0003 selects first-party email/password authentication with Argon2id and revocable server-side sessions. Decision gate D1 requires the concrete cookie, expiry, CSRF, and throttling behavior before session storage is implemented.

## Decision

- Successful login creates a 256-bit opaque token. Only its SHA-256 digest is stored in PostgreSQL.
- The browser receives `hwsd_session` as an `HttpOnly`, `SameSite=Lax` cookie scoped to `/api/v1`. It is `Secure` outside local development and is never exposed to JavaScript or local storage.
- Sessions expire after 12 hours of inactivity and after an absolute maximum of seven days. Activity refresh is persisted at most once every five minutes.
- Logout revokes the server-side row before clearing the cookie. Expired, revoked, missing, and disabled-user sessions all fail as unauthenticated.
- Unsafe browser requests require JSON content and `X-HWSD-CSRF: 1`. Combined with same-origin deployment, no permissive CORS policy, and the custom header's preflight requirement, this prevents cross-site form submission from authorizing mutations.
- Login is limited to five attempts per 15 minutes per source address. Authentication failures use one response regardless of whether the account is absent, disabled, or has the wrong password.
- Authorization runs for every protected request. Ownership failures use the same unavailable response as missing resources; admin checks fail closed.

## Consequences

- Horizontal API deployments need a shared rate-limit store before production scale-out.
- HTTPS is mandatory outside local development.
- Browser and API must remain same-origin in production unless this threat model is explicitly revised.
- Account recovery, MFA, and cross-origin public API tokens remain outside M2.
