# Rule Engine

Pure deterministic engineering validation package.

The package depends only on `@hwsd/shared` and performs no network, filesystem, database, clock,
random, UI, or AI operations.

M5 provides:

- an immutable 38-rule V1 registry and ordered evaluation pipeline;
- connection preview, revision-aware commit, and full Design Check modes;
- structural, interface, electrical, allocation, shared-bus, power, and completeness rules;
- stable finding ordering, pure SHA-256 fingerprints, warning acknowledgement, and normalized
  allocation effects;
- decimal-safe current-budget comparisons and stale Design Check detection.

The public entry points are `evaluate`, `RULE_REGISTRY`, `canonicalJson`, `sha256`, and
`isDesignCheckCurrent`.
