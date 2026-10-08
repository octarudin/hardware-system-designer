import type { Pool } from 'pg';

import type { AuthRepository, NewSession, SessionRecord, UserAccount } from './types.js';

interface UserRow {
  readonly user_id: string;
  readonly email: string;
  readonly display_name: string;
  readonly password_hash: string;
  readonly role: 'USER' | 'ADMIN';
  readonly account_status: 'ACTIVE' | 'DISABLED';
}

interface SessionRow extends UserRow {
  readonly session_id: string;
  readonly last_used_at: Date;
  readonly idle_expires_at: Date;
  readonly absolute_expires_at: Date;
}

function toUser(row: UserRow): UserAccount {
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    role: row.role,
    accountStatus: row.account_status,
  };
}

export class PostgresAuthRepository implements AuthRepository {
  public constructor(private readonly pool: Pool) {}

  public async findUserByEmail(email: string): Promise<UserAccount | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT user_id, email, display_name, password_hash, role, account_status
         FROM users
        WHERE lower(email) = $1
        LIMIT 1`,
      [email],
    );
    const row = result.rows[0];
    return row ? toUser(row) : null;
  }

  public async createSession(session: NewSession): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_sessions (
         session_id, token_digest, user_id, created_at, last_used_at,
         idle_expires_at, absolute_expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session.sessionId,
        session.tokenDigest,
        session.userId,
        session.createdAt,
        session.lastUsedAt,
        session.idleExpiresAt,
        session.absoluteExpiresAt,
      ],
    );
  }

  public async findActiveSessionByDigest(
    tokenDigest: string,
    now: Date,
  ): Promise<SessionRecord | null> {
    const result = await this.pool.query<SessionRow>(
      `SELECT s.session_id, s.last_used_at, s.idle_expires_at, s.absolute_expires_at,
              u.user_id, u.email, u.display_name, u.password_hash, u.role, u.account_status
         FROM auth_sessions s
         JOIN users u ON u.user_id = s.user_id
        WHERE s.token_digest = $1
          AND s.revoked_at IS NULL
          AND s.idle_expires_at > $2
          AND s.absolute_expires_at > $2
        LIMIT 1`,
      [tokenDigest, now],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      sessionId: row.session_id,
      user: toUser(row),
      accountStatus: row.account_status,
      lastUsedAt: row.last_used_at,
      idleExpiresAt: row.idle_expires_at,
      absoluteExpiresAt: row.absolute_expires_at,
    };
  }

  public async touchSession(
    sessionId: string,
    lastUsedAt: Date,
    idleExpiresAt: Date,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE auth_sessions
          SET last_used_at = $2,
              idle_expires_at = LEAST($3, absolute_expires_at)
        WHERE session_id = $1
          AND revoked_at IS NULL`,
      [sessionId, lastUsedAt, idleExpiresAt],
    );
  }

  public async revokeSessionByDigest(tokenDigest: string, revokedAt: Date): Promise<void> {
    await this.pool.query(
      `UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, $2)
        WHERE token_digest = $1`,
      [tokenDigest, revokedAt],
    );
  }

  public async recordSuccessfulLogin(userId: string, loggedInAt: Date): Promise<void> {
    await this.pool.query('UPDATE users SET last_login_at = $2 WHERE user_id = $1', [
      userId,
      loggedInAt,
    ]);
  }
}
