# Schemas

Machine-readable component, interface, project, and other formal schemas are stored here.

Current schemas:

- `component-schema-v1.schema.json` — JSON Schema for published Component Schema V1 documents; resolves port definitions from the sibling Port/Interface schema.
- `port-interface-schema-v1.schema.json` — reusable JSON Schema for standalone and component-embedded ports and interfaces.
- `connection-rule-result-v1.schema.json` — JSON Schema for deterministic connection and Design Check results.
- `project-file-v1.schema.json` — JSON Schema for server persistence, browser recovery, and local project export/import.

These files are the source of truth. `corepack pnpm contracts:generate` produces the browser-safe schema bundle and TypeScript contracts in `shared/src/generated`; `corepack pnpm contracts:check` verifies reproducibility without writing files.
