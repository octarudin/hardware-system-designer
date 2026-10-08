import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const migrationDirectory = resolve('database/migrations');
const filenames = (await readdir(migrationDirectory))
  .filter((filename) => /^\d{4}_[a-z0-9_]+\.sql$/.test(filename))
  .sort();
const client = new Client({ connectionString: databaseUrl });

function migrationBody(content) {
  return content.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
}

await client.connect();
try {
  await client.query('SELECT pg_advisory_lock(728194620001)');
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  for (const filename of filenames) {
    const content = await readFile(resolve(migrationDirectory, filename), 'utf8');
    const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
    const existing = await client.query(
      'SELECT sha256 FROM schema_migrations WHERE filename = $1',
      [filename],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].sha256 !== sha256) {
        throw new Error(`Applied migration was modified: ${filename}`);
      }
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query(migrationBody(content));
      await client.query('INSERT INTO schema_migrations (filename, sha256) VALUES ($1, $2)', [
        filename,
        sha256,
      ]);
      await client.query('COMMIT');
      console.info(`Applied ${filename}.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(728194620001)').catch(() => undefined);
  await client.end();
}
