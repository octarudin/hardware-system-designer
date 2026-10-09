# AI

Standalone M7 datasheet-import worker process. It claims PostgreSQL jobs with expiring leases,
extracts bounded PDF text from S3-compatible storage, calls the configured structured-output provider,
normalizes claim evidence, and persists review candidates atomically.

Set `DATABASE_URL`, the S3 variables from `.env.example`, and `OPENAI_API_KEY` to enable processing.
`OPENAI_MODEL` defaults to `gpt-5.4-mini`. If the database URL or API key is absent, the process stays
healthy but reports that processing is disabled.
