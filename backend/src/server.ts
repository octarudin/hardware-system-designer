import { buildApp } from './app.js';
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';

import { Argon2PasswordVerifier } from './auth/argon2-password.js';
import { AuthService } from './auth/auth-service.js';
import { PostgresAuthRepository } from './auth/postgres-auth-repository.js';
import { ComponentService } from './components/component-service.js';
import { PostgresComponentRepository } from './components/postgres-component-repository.js';
import { DatasheetService } from './datasheets/datasheet-service.js';
import { PostgresDatasheetRepository } from './datasheets/postgres-datasheet-repository.js';
import { S3ObjectStore } from './datasheets/s3-object-store.js';
import { PostgresProjectRepository } from './projects/postgres-project-repository.js';
import { ProjectService } from './projects/project-service.js';

const host = process.env.API_HOST ?? '127.0.0.1';
const parsedPort = Number.parseInt(process.env.API_PORT ?? '3000', 10);

if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const pool = new Pool({ connectionString: databaseUrl });
const authService = new AuthService(new PostgresAuthRepository(pool), new Argon2PasswordVerifier());
const componentRepository = new PostgresComponentRepository(pool);
const componentService = new ComponentService(componentRepository);
const s3AccessKey = process.env.S3_ACCESS_KEY;
const s3SecretKey = process.env.S3_SECRET_KEY;
const s3Client = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  ...(s3AccessKey && s3SecretKey
    ? { credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey } }
    : {}),
});
const datasheetService = new DatasheetService(
  new PostgresDatasheetRepository(pool),
  new S3ObjectStore(
    s3Client,
    process.env.S3_BUCKET ?? 'hwsd-datasheets',
    process.env.S3_SERVER_SIDE_ENCRYPTION === 'AES256' ? 'AES256' : undefined,
  ),
  componentService,
);
const projectService = new ProjectService(
  new PostgresProjectRepository(pool),
  undefined,
  undefined,
  componentRepository,
);
const app = buildApp({
  authService,
  componentService,
  projectService,
  datasheetService,
  logger: true,
});
app.addHook('onClose', async () => {
  s3Client.destroy();
  await pool.end();
});

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutdown requested');
  await app.close();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

try {
  await app.listen({ host, port: parsedPort });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
