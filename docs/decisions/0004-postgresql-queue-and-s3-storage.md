# ADR-0004: PostgreSQL Queue and S3-Compatible Storage

**Status:** ACCEPTED  
**Date:** 2026-10-07

## Context

Datasheet imports are asynchronous, retryable, and auditable. The existing database schema already models import jobs. PDF binaries can be large and have different retention, access, and backup characteristics from relational metadata.

## Decision

Use PostgreSQL as the V1 job queue and S3-compatible object storage for datasheet binaries.

Workers claim jobs with row locking and leases. Job execution is idempotent, bounded by attempt and timeout limits, and records sanitized terminal failure information. An additive migration in M7 adds lease owner, lease expiry, attempt count, and next-attempt fields.

The `datasheets` row stores metadata, SHA-256 digest, and an opaque object key. The API authorizes access before issuing or proxying a download. Object keys are never treated as credentials or local paths.

Local development uses PostgreSQL 16 and a pinned MinIO image through Compose. Production vendors remain replaceable behind PostgreSQL and S3 protocols.

## Consequences

- V1 needs no Redis or dedicated queue service.
- Queue and domain operations can share transactions where necessary.
- Polling and leasing add database load that must be measured before scaling worker count.
- Binary backup and retention procedures are separate from relational backup procedures.

## Alternatives Considered

- Redis-backed queue: rejected for V1 to avoid another required stateful service.
- In-process queue: rejected because work would be lost on restart and could not be leased across workers.
- PostgreSQL binary storage: rejected because large retained PDFs do not belong in transactional rows.
- Local filesystem storage: rejected because it is not portable across API/worker replicas.
