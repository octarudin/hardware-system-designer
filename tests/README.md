# Tests

Cross-package architecture, schema, integration, and end-to-end tests.

Package-local unit tests live beside their source. Root suites verify schema asset identities and the dependency rules from ADR-0002. M1 canonical contract fixtures live in `fixtures/contracts/v1` and cover valid minimal/representative documents plus structural and semantic boundaries. Browser tests are configured separately from the pull-request gate.
