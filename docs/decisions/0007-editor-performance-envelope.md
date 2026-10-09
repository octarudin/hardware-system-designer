# ADR 0007: Editor Performance Envelope

- Status: `ACCEPTED`
- Date: 2026-10-09
- Decision gate: `D2`

## Context

M6 introduces a command-based engineering editor that keeps canonical Project File V1 documents in memory, derives lookup indexes, evaluates connection candidates, and persists complete JSONB documents. The architecture needs an explicit supported-size target before canvas implementation choices become difficult to change.

## Decision

The V1 desktop editor supports projects containing up to:

- 250 component instances;
- 500 connections;
- 1,500 endpoints; and
- 5,000 persisted allocations.

Within that envelope, the engineering editor targets these warm-runtime budgets on a current evergreen desktop browser and a typical four-core development workstation:

- local selection and command dispatch: p95 below 50 ms;
- node move feedback: at least 30 frames per second;
- derived-index rebuild: p95 below 50 ms;
- connection preview, excluding network latency: p95 below 250 ms;
- full Design Check, excluding network latency: p95 below 1 second; and
- project save API, excluding network latency: p95 below 500 ms.

The editor uses canonical Project File V1 objects as its persisted model, an immutable command history capped at 50 document states, and derived maps for instance, connection, and allocation lookup. It does not introduce a private persistence representation. Canvas rendering uses a single transformed stage with SVG connection geometry and HTML component controls.

These values define the supported and testable target, not a schema-level rejection limit. M8 will measure representative maximum-size fixtures and may introduce guarded product limits if evidence shows that larger documents create an unsafe failure mode.

## Consequences

- Editor commands remain deterministic and independently unit-testable.
- Undo memory is bounded by the 50-state history cap.
- Complete-document autosave remains acceptable for V1 but must be measured at the upper envelope.
- Rendering or rule-evaluation optimizations may be added without changing the canonical contract.
- Projects beyond this envelope may work, but V1 makes no responsiveness guarantee for them.

## Verification

M6 verifies command behavior, bounded history, derived indexes, and the connection vertical slice. M8 performance tests will generate the upper-envelope fixture and record browser, rule-engine, and API percentiles against these budgets.
