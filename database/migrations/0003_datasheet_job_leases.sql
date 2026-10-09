BEGIN;

ALTER TABLE datasheet_import_jobs
    ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
    ADD COLUMN available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN lease_owner TEXT,
    ADD COLUMN lease_expires_at TIMESTAMPTZ,
    ADD COLUMN heartbeat_at TIMESTAMPTZ,
    ADD COLUMN prompt_version TEXT,
    ADD COLUMN extracted_character_count INTEGER
        CHECK (extracted_character_count IS NULL OR extracted_character_count >= 0),
    ADD CONSTRAINT datasheet_import_job_lease_shape CHECK (
        (lease_owner IS NULL AND lease_expires_at IS NULL)
        OR
        (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
    );

CREATE INDEX datasheet_import_jobs_claim_idx
    ON datasheet_import_jobs (available_at, requested_at)
    WHERE status = 'QUEUED';

CREATE INDEX datasheet_import_jobs_expired_lease_idx
    ON datasheet_import_jobs (lease_expires_at)
    WHERE status = 'PROCESSING';

COMMIT;
