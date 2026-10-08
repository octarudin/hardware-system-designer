import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Client, Pool } from 'pg';

import { PostgresProjectRepository } from '../backend/dist/projects/postgres-project-repository.js';
import { ProjectService } from '../backend/dist/projects/project-service.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for the project smoke test.');

const schemaName = `project_smoke_${randomUUID().replaceAll('-', '_')}`;
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
     VALUES ('USR-PROJECT-SMOKE', 'project-smoke@example.com', 'Project Smoke', 'smoke-only', 'USER')`,
  );
  const principal = {
    userId: 'USR-PROJECT-SMOKE',
    email: 'project-smoke@example.com',
    displayName: 'Project Smoke',
    role: 'USER',
  };
  let idSequence = 0;
  let timeSequence = 0;
  const service = new ProjectService(
    new PostgresProjectRepository(pool),
    { now: () => new Date(`2026-10-08T12:00:0${timeSequence++}.000Z`) },
    { projectId: () => `PROJ-SMOKE-${++idSequence}` },
  );

  const created = await service.create(principal, 'Project persistence smoke');
  const renamed = await service.rename(
    principal,
    created.document.project_id,
    created.document.document_revision,
    'Project persistence smoke renamed',
  );
  let conflictCode;
  try {
    await service.save(principal, created.document.project_id, 1, created.document);
  } catch (error) {
    conflictCode = error.code;
  }
  const exported = await service.export(principal, created.document.project_id);
  const imported = await service.importCopy(
    principal,
    Buffer.from(exported.content, 'utf8').toString('base64'),
  );
  await service.softDelete(principal, created.document.project_id);

  const persisted = await pool.query(
    `SELECT
       (SELECT count(*)::integer FROM projects) AS project_count,
       (SELECT count(*)::integer FROM projects WHERE deleted_at IS NULL) AS active_count,
       (SELECT count(*)::integer FROM audit_events) AS audit_count`,
  );
  const state = persisted.rows[0];
  if (
    renamed.document.document_revision !== 2 ||
    renamed.document.engineering_revision !== 1 ||
    conflictCode !== 'PROJECT_SAVE_CONFLICT' ||
    imported.document.project_id === created.document.project_id ||
    state?.project_count !== 2 ||
    state?.active_count !== 1 ||
    state?.audit_count !== 4
  ) {
    throw new Error(`Project persistence assertions failed: ${JSON.stringify(state)}`);
  }

  console.info(
    'Project smoke test passed: CAS conflict, export/import Create Copy, audit, and soft delete are correct.',
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
