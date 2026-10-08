# Shared

Browser-safe shared contracts, identifiers, and validation utilities.

`@hwsd/shared` is the lowest-level workspace package and must not depend on any application package. M1 provides:

- an Ajv 2020 registry containing all four V1 schemas with offline cross-schema references;
- generated TypeScript contract types;
- stable structural validation issues with JSON Pointer paths;
- pure component and project semantic validators; and
- the shared HTTP error envelope.
