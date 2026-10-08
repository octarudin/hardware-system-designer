import type { AuthenticatedUser } from '@hwsd/shared';

export interface UserAccount extends AuthenticatedUser {
  readonly passwordHash: string;
  readonly accountStatus: 'ACTIVE' | 'DISABLED';
}

export interface SessionRecord {
  readonly sessionId: string;
  readonly user: AuthenticatedUser;
  readonly accountStatus: 'ACTIVE' | 'DISABLED';
  readonly lastUsedAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export interface NewSession {
  readonly sessionId: string;
  readonly tokenDigest: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserAccount | null>;
  createSession(session: NewSession): Promise<void>;
  findActiveSessionByDigest(tokenDigest: string, now: Date): Promise<SessionRecord | null>;
  touchSession(sessionId: string, lastUsedAt: Date, idleExpiresAt: Date): Promise<void>;
  revokeSessionByDigest(tokenDigest: string, revokedAt: Date): Promise<void>;
  recordSuccessfulLogin(userId: string, loggedInAt: Date): Promise<void>;
}

export interface PasswordVerifier {
  verify(passwordHash: string | undefined, password: string): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}
