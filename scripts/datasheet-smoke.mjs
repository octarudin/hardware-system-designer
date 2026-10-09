import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Client, Pool } from 'pg';

import { DatasheetJobRepository } from '../ai/dist/job-repository.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for the datasheet smoke test.');

const schemaName = `datasheet_smoke_${randomUUID().replaceAll('-', '_')}`;
const quotedSchemaName = `"${schemaName}"`;
const migrations = await Promise.all(
  ['0001_initial_schema.sql', '0002_auth_sessions.sql', '0003_datasheet_job_leases.sql'].map(
    (filename) => readFile(resolve('database/migrations', filename), 'utf8'),
  ),
);
const administrator = new Client({ connectionString: databaseUrl });
let pool;
let schemaCreated = false;

async function insertImport(importId, datasheetId, suffix, maxAttempts = 3) {
  await pool.query(
    `INSERT INTO datasheets (
       datasheet_id, uploaded_by, original_filename, byte_size, page_count, sha256, object_key
     ) VALUES ($1, 'USR-DATASHEET-SMOKE', $2, 512, 1, $3, $4)`,
    [datasheetId, `${suffix}.pdf`, suffix.repeat(64).slice(0, 64), `datasheets/${suffix}.pdf`],
  );
  await pool.query(
    `INSERT INTO datasheet_import_jobs (import_id, datasheet_id, requested_by, max_attempts)
     VALUES ($1, $2, 'USR-DATASHEET-SMOKE', $3)`,
    [importId, datasheetId, maxAttempts],
  );
}

try {
  await administrator.connect();
  await administrator.query(`CREATE SCHEMA ${quotedSchemaName}`);
  schemaCreated = true;
  await administrator.query(`SET search_path TO ${quotedSchemaName}`);
  for (const migration of migrations) await administrator.query(migration);

  pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
  await pool.query(
    `INSERT INTO users (user_id, email, display_name, password_hash, role)
     VALUES ('USR-DATASHEET-SMOKE', 'datasheet-smoke@example.com', 'Datasheet Smoke', 'smoke-only', 'USER')`,
  );
  await insertImport('IMPORT-SMOKE-SUCCESS', 'DS-SMOKE-SUCCESS', 'a');
  await insertImport('IMPORT-SMOKE-FAIL', 'DS-SMOKE-FAIL', 'b', 1);
  await insertImport('IMPORT-SMOKE-LEASE', 'DS-SMOKE-LEASE', 'c', 2);

  const repository = new DatasheetJobRepository(pool);
  const completed = await repository.claim('worker-success');
  if (!completed || completed.importId !== 'IMPORT-SMOKE-SUCCESS')
    throw new Error('The first queued import was not leased.');
  if (!(await repository.heartbeat(completed.importId, 'worker-success')))
    throw new Error('The active lease could not be renewed.');
  await repository.complete(
    completed,
    'worker-success',
    'gpt-5.4-mini-test',
    'hwsd.datasheet-extraction/1',
    128,
    [
      {
        label: 'Smoke sensor',
        confidence: 0.9,
        document: {
          identity: { name: 'Smoke sensor' },
          classification: { category: 'SENSOR', abstraction: 'RAW_IC' },
          provenance: { datasheets: [], field_evidence: [] },
          pins: [],
          ports: [],
          resources: [],
          address_capabilities: [],
          notes: [],
          revision_notes: 'Smoke extraction',
        },
      },
    ],
  );

  const failed = await repository.claim('worker-fail');
  if (!failed || failed.importId !== 'IMPORT-SMOKE-FAIL')
    throw new Error('The failure fixture was not leased.');
  await repository.fail(failed, 'worker-fail', 'PROVIDER_UNAVAILABLE', 'Sanitized failure.');

  const expired = await repository.claim('worker-expired', -1);
  if (!expired || expired.importId !== 'IMPORT-SMOKE-LEASE')
    throw new Error('The lease recovery fixture was not leased.');
  const recovered = await repository.claim('worker-recovered');
  if (!recovered || recovered.importId !== 'IMPORT-SMOKE-LEASE' || recovered.attemptCount !== 2)
    throw new Error('An expired lease was not safely recovered.');
  await repository.fail(recovered, 'worker-recovered', 'JOB_LEASE_EXPIRED', 'Sanitized failure.');

  const result = await pool.query(
    `SELECT
       (SELECT status FROM datasheet_import_jobs WHERE import_id = 'IMPORT-SMOKE-SUCCESS') AS success_status,
       (SELECT model_name FROM datasheet_import_jobs WHERE import_id = 'IMPORT-SMOKE-SUCCESS') AS model_name,
       (SELECT count(*)::integer FROM component_candidates WHERE import_id = 'IMPORT-SMOKE-SUCCESS') AS candidate_count,
       (SELECT status FROM datasheet_import_jobs WHERE import_id = 'IMPORT-SMOKE-FAIL') AS failed_status,
       (SELECT error_code FROM datasheet_import_jobs WHERE import_id = 'IMPORT-SMOKE-FAIL') AS error_code,
       (SELECT status FROM datasheet_import_jobs WHERE import_id = 'IMPORT-SMOKE-LEASE') AS lease_status`,
  );
  const state = result.rows[0];
  if (
    state?.success_status !== 'REVIEW_REQUIRED' ||
    state?.model_name !== 'gpt-5.4-mini-test' ||
    state?.candidate_count !== 1 ||
    state?.failed_status !== 'FAILED' ||
    state?.error_code !== 'PROVIDER_UNAVAILABLE' ||
    state?.lease_status !== 'FAILED'
  )
    throw new Error(`Datasheet queue assertions failed: ${JSON.stringify(state)}`);

  console.info(
    'Datasheet smoke test passed: lease, heartbeat, completion, candidate persistence, terminal failure, and expired-lease recovery are correct.',
  );
} finally {
  if (pool) await pool.end();
  try {
    if (schemaCreated) {
      await administrator.query('SET search_path TO public');
      await administrator.query(`DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`);
    }
  } finally {
    await administrator.end().catch(() => undefined);
  }
}
