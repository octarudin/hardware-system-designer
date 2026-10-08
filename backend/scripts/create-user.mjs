import { randomBytes } from 'node:crypto';

import { argon2id, hash } from 'argon2';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
const password = process.env.HWSD_BOOTSTRAP_PASSWORD;
const values = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...rest] = argument.split('=');
    return [key, rest.join('=')];
  }),
);
const email = values.get('--email')?.trim().toLowerCase();
const displayName = values.get('--name')?.trim();
const role = values.get('--role') ?? 'USER';

if (!databaseUrl) throw new Error('DATABASE_URL is required.');
if (!password || password.length < 12) {
  throw new Error('HWSD_BOOTSTRAP_PASSWORD must contain at least 12 characters.');
}
if (!email || !displayName || !['USER', 'ADMIN'].includes(role)) {
  throw new Error('Usage: --email=user@example.com --name="Display Name" [--role=USER|ADMIN]');
}

const passwordHash = await hash(password, {
  type: argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
});
const userId = `USR-${randomBytes(12).toString('hex').toUpperCase()}`;
const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(
    `INSERT INTO users (user_id, email, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, email, displayName, passwordHash, role],
  );
  console.info(`Created ${role} account ${userId} for ${email}.`);
} finally {
  await client.end();
}
