# ADR 0008: OpenAI Structured Datasheet Extraction

- Status: `ACCEPTED`
- Date: 2026-10-09
- Decision gate: `D3`

## Context

M7 needs a provider adapter that can distinguish multiple parts in extracted PDF text and return
reviewable Component Schema V1 drafts. AI output is evidence-bearing input to a human workflow; it
must never bypass deterministic validation or acquire authority over engineering decisions.

## Decision

Use the OpenAI Responses API with strict Structured Outputs. The configurable default model is
`gpt-5.4-mini`. The worker records the model identifier returned by the API, prompt version, bounded
input character count, attempt count, and sanitized failure state.

The application sends extracted text only, capped at 100 pages and 200,000 characters. It does not
send the original PDF. Requests set `store: false`, cap output at 12,000 tokens, time out after 60
seconds, and retry only rate limits and server failures for at most three total attempts. Production
deployment requires an organization-approved OpenAI project, data-processing terms, and regional
configuration appropriate to the deployment; without `OPENAI_API_KEY`, processing remains disabled.

At the published model rates reviewed on the decision date, the bounded request has a conservative
application budget of USD 0.10 per import. The alias can be replaced through `OPENAI_MODEL`; production
must pin an approved model version after the release evaluation.

The release evaluation corpus must score at least 90% on candidate segmentation and required identity
fields, retain page evidence for at least 95% of scored extracted claims, and produce zero silently
invented required values. The deterministic adapter and normalization corpus is part of M7; the live,
credentialed quality score is release evidence for M8 and may change the pinned model without changing
the provider port.

## Consequences

- Provider output is parsed and runtime-validated even after schema-constrained generation.
- Missing values remain absent; empty engineering arrays are review prompts, not inferred facts.
- Every candidate must pass Component Schema V1 and semantic validation before publication.
- Provider or parsing failure only changes the import job and cannot mutate the component library.
- Switching providers requires a new adapter and evaluation evidence, not domain-model changes.

## Verification

M7 unit tests cover strict/non-stored request construction, resolved model capture, invalid-output
rejection, bounded PDF extraction, and provenance normalization. The PostgreSQL smoke test covers
leases, heartbeat, retry/failure, expired-lease recovery, candidate persistence, and recorded model.

Official references reviewed for this decision:

- <https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses>
- <https://developers.openai.com/api/reference/resources/responses/methods/create>
- <https://developers.openai.com/api/docs/models/gpt-5.4-mini>
