BEGIN;

CREATE TABLE auth_sessions (
    session_id TEXT PRIMARY KEY
        CHECK (session_id ~ '^SES-[A-Z0-9][A-Z0-9_-]*$'),
    token_digest TEXT NOT NULL UNIQUE
        CHECK (token_digest ~ '^[a-f0-9]{64}$'),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    idle_expires_at TIMESTAMPTZ NOT NULL,
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CHECK (last_used_at >= created_at),
    CHECK (idle_expires_at > created_at),
    CHECK (absolute_expires_at >= idle_expires_at),
    CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX auth_sessions_user_active_idx
    ON auth_sessions (user_id, absolute_expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX auth_sessions_expiry_idx
    ON auth_sessions (LEAST(idle_expires_at, absolute_expires_at))
    WHERE revoked_at IS NULL;

COMMENT ON TABLE auth_sessions IS
    'Revocable server-side browser sessions. Only SHA-256 token digests are persisted.';

COMMIT;
