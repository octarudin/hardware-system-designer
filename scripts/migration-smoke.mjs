import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for the migration smoke test.');
}

const schemaName = `migration_smoke_${randomUUID().replaceAll('-', '_')}`;
const quotedSchemaName = `"${schemaName}"`;
const migrations = await Promise.all(
  ['0001_initial_schema.sql', '0002_auth_sessions.sql', '0003_datasheet_job_leases.sql'].map(
    async (filename) => readFile(resolve('database/migrations', filename), 'utf8'),
  ),
);
const expectedTables = [
  'audit_events',
  'auth_sessions',
  'component_candidates',
  'component_review_actions',
  'component_revision_datasheets',
  'component_revisions',
  'components',
  'datasheet_import_jobs',
  'datasheets',
  'design_check_runs',
  'projects',
  'users',
];

const client = new Client({ connectionString: databaseUrl });
let connected = false;
let schemaCreated = false;

try {
  await client.connect();
  connected = true;
  await client.query(`CREATE SCHEMA ${quotedSchemaName}`);
  schemaCreated = true;
  await client.query(`SET search_path TO ${quotedSchemaName}`);
  for (const migration of migrations) await client.query(migration);

  const result = await client.query(
    `SELECT tablename
       FROM pg_catalog.pg_tables
      WHERE schemaname = $1
      ORDER BY tablename`,
    [schemaName],
  );
  const actualTables = result.rows.map((row) => row.tablename);

  if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables)) {
    throw new Error(
      `Migration table mismatch. Expected ${expectedTables.join(', ')}, received ${actualTables.join(', ')}.`,
    );
  }

  await client.query(
    `INSERT INTO users (user_id, email, display_name, password_hash, role)
     VALUES ('USR-MIGRATION_SMOKE', 'migration-smoke@example.com', 'Migration Smoke', 'not-a-real-login-hash', 'USER')`,
  );
  await client.query(
    `INSERT INTO auth_sessions (
       session_id, token_digest, user_id, idle_expires_at, absolute_expires_at
     ) VALUES (
       'SES-MIGRATION_SMOKE', repeat('a', 64), 'USR-MIGRATION_SMOKE',
       CURRENT_TIMESTAMP + INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '1 day'
     )`,
  );
  const activeBeforeRevocation = await client.query(
    `SELECT count(*)::INTEGER AS count
       FROM auth_sessions
      WHERE token_digest = repeat('a', 64)
        AND revoked_at IS NULL
        AND idle_expires_at > CURRENT_TIMESTAMP
        AND absolute_expires_at > CURRENT_TIMESTAMP`,
  );
  await client.query(
    `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP
      WHERE session_id = 'SES-MIGRATION_SMOKE'`,
  );
  const activeAfterRevocation = await client.query(
    `SELECT count(*)::INTEGER AS count
       FROM auth_sessions
      WHERE token_digest = repeat('a', 64)
        AND revoked_at IS NULL
        AND idle_expires_at > CURRENT_TIMESTAMP
        AND absolute_expires_at > CURRENT_TIMESTAMP`,
  );
  if (activeBeforeRevocation.rows[0]?.count !== 1 || activeAfterRevocation.rows[0]?.count !== 0) {
    throw new Error('Session expiry/revocation smoke assertion failed.');
  }

  console.info(`Migration smoke test passed with ${actualTables.length} tables.`);
} finally {
  try {
    if (connected && schemaCreated) {
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`);
    }
  } finally {
    if (connected) await client.end();
  }
}
