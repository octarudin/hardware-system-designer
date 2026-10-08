import { buildApp } from './app.js';
import { Pool } from 'pg';

import { Argon2PasswordVerifier } from './auth/argon2-password.js';
import { AuthService } from './auth/auth-service.js';
import { PostgresAuthRepository } from './auth/postgres-auth-repository.js';

const host = process.env.API_HOST ?? '127.0.0.1';
const parsedPort = Number.parseInt(process.env.API_PORT ?? '3000', 10);

if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const pool = new Pool({ connectionString: databaseUrl });
const authService = new AuthService(new PostgresAuthRepository(pool), new Argon2PasswordVerifier());
const app = buildApp({ authService, logger: true });
app.addHook('onClose', async () => pool.end());

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
