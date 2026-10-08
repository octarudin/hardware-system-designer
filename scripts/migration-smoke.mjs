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
const migration = await readFile(resolve('database/migrations/0001_initial_schema.sql'), 'utf8');
const expectedTables = [
  'audit_events',
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
  await client.query(migration);

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
