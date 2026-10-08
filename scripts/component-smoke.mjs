import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Client, Pool } from 'pg';

import { ComponentService } from '../backend/dist/components/component-service.js';
import { PostgresComponentRepository } from '../backend/dist/components/postgres-component-repository.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for the component smoke test.');

const schemaName = `component_smoke_${randomUUID().replaceAll('-', '_')}`;
const quotedSchemaName = `"${schemaName}"`;
const migrations = await Promise.all(
  ['0001_initial_schema.sql', '0002_auth_sessions.sql'].map((filename) =>
    readFile(resolve('database/migrations', filename), 'utf8'),
  ),
);
const administrator = new Client({ connectionString: databaseUrl });
let pool;
let schemaCreated = false;

try {
  await administrator.connect();
  await administrator.query(`CREATE SCHEMA ${quotedSchemaName}`);
  schemaCreated = true;
  await administrator.query(`SET search_path TO ${quotedSchemaName}`);
  for (const migration of migrations) await administrator.query(migration);

  pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
  await pool.query(
    `INSERT INTO users (user_id, email, display_name, password_hash, role)
     VALUES
       ('USR-COMPONENT_AUTHOR', 'author@example.com', 'Component Author', 'smoke-only', 'USER'),
       ('USR-COMPONENT_ADMIN', 'admin@example.com', 'Component Admin', 'smoke-only', 'ADMIN')`,
  );
  const service = new ComponentService(
    new PostgresComponentRepository(pool),
    { now: () => new Date('2026-10-08T12:00:00.000Z') },
    { componentId: () => 'CMP-COMPONENT_SMOKE' },
  );
  const created = await service.create(
    {
      userId: 'USR-COMPONENT_AUTHOR',
      email: 'author@example.com',
      displayName: 'Component Author',
      role: 'USER',
    },
    {
      identity: { name: 'Smoke test controller', manufacturer: 'HWSD', part_number: 'SMOKE-1' },
      classification: { category: 'MICROCONTROLLER', abstraction: 'BOARD' },
      provenance: { datasheets: [], field_evidence: [] },
      pins: [],
      ports: [],
      resources: [],
      address_capabilities: [],
      notes: [],
      revision_notes: 'Initial smoke-test submission',
    },
  );
  const approved = await service.review(
    {
      userId: 'USR-COMPONENT_ADMIN',
      email: 'admin@example.com',
      displayName: 'Component Admin',
      role: 'ADMIN',
    },
    created.definition.component_id,
    created.definition.revision,
    'APPROVE',
    'Smoke-test evidence verified',
  );

  const persisted = await pool.query(
    `SELECT c.latest_revision, c.current_status,
            (SELECT count(*)::integer FROM component_revisions) AS revision_count,
            (SELECT count(*)::integer FROM component_review_actions) AS review_count,
            (SELECT count(*)::integer FROM audit_events) AS audit_count
       FROM components c
      WHERE c.component_id = 'CMP-COMPONENT_SMOKE'`,
  );
  const state = persisted.rows[0];
  if (
    approved.definition.revision !== 2 ||
    state?.latest_revision !== 2 ||
    state?.current_status !== 'VERIFIED' ||
    state?.revision_count !== 2 ||
    state?.review_count !== 2 ||
    state?.audit_count !== 2
  ) {
    throw new Error(`Component publication assertions failed: ${JSON.stringify(state)}`);
  }

  let immutableGuardCode;
  try {
    await pool.query(
      `UPDATE component_revisions SET revision_notes = 'mutated'
        WHERE component_id = 'CMP-COMPONENT_SMOKE' AND revision = 1`,
    );
  } catch (error) {
    immutableGuardCode = error.code;
  }
  if (immutableGuardCode !== '55000') {
    throw new Error(`Expected immutable revision SQLSTATE 55000, received ${immutableGuardCode}.`);
  }

  console.info(
    'Component smoke test passed: submission and VERIFIED revision are atomic and immutable.',
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
