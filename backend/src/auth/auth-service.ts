import { createHash, randomBytes } from 'node:crypto';

import type { AuthenticatedUser } from '@hwsd/shared';

import { ApplicationError } from '../errors.js';
import type { AuthRepository, Clock, PasswordVerifier, SessionRecord } from './types.js';

const IDLE_DURATION_MS = 12 * 60 * 60 * 1000;
const ABSOLUTE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const SESSION_COOKIE_NAME = 'hwsd_session';

export interface SessionGrant {
  readonly token: string;
  readonly user: AuthenticatedUser;
  readonly expiresAt: Date;
}

const systemClock: Clock = { now: () => new Date() };

export function digestSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function invalidCredentials(): ApplicationError {
  return new ApplicationError(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.');
}

export class AuthService {
  public constructor(
    private readonly repository: AuthRepository,
    private readonly passwordVerifier: PasswordVerifier,
    private readonly clock: Clock = systemClock,
  ) {}

  public async login(email: string, password: string): Promise<SessionGrant> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.repository.findUserByEmail(normalizedEmail);
    const passwordMatches = await this.passwordVerifier.verify(user?.passwordHash, password);

    if (!user || !passwordMatches || user.accountStatus !== 'ACTIVE') throw invalidCredentials();

    const now = this.clock.now();
    const token = randomBytes(32).toString('base64url');
    const idleExpiresAt = new Date(now.getTime() + IDLE_DURATION_MS);
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_DURATION_MS);
    await this.repository.createSession({
      sessionId: `SES-${randomBytes(16).toString('hex').toUpperCase()}`,
      tokenDigest: digestSessionToken(token),
      userId: user.userId,
      createdAt: now,
      lastUsedAt: now,
      idleExpiresAt,
      absoluteExpiresAt,
    });
    await this.repository.recordSuccessfulLogin(user.userId, now);

    return { token, user: this.toPrincipal(user), expiresAt: idleExpiresAt };
  }

  public async authenticate(token: string | undefined): Promise<SessionGrant> {
    if (!token) throw new ApplicationError(401, 'AUTH_REQUIRED', 'Authentication is required.');

    const now = this.clock.now();
    const digest = digestSessionToken(token);
    const session = await this.repository.findActiveSessionByDigest(digest, now);
    if (!session || session.accountStatus !== 'ACTIVE') {
      if (session) await this.repository.revokeSessionByDigest(digest, now);
      throw new ApplicationError(401, 'AUTH_REQUIRED', 'Authentication is required.');
    }

    const shouldTouch = now.getTime() - session.lastUsedAt.getTime() >= TOUCH_INTERVAL_MS;
    const idleExpiresAt = shouldTouch
      ? this.refreshedIdleExpiry(session, now)
      : session.idleExpiresAt;
    if (shouldTouch) {
      await this.repository.touchSession(session.sessionId, now, idleExpiresAt);
    }
    return { token, user: session.user, expiresAt: idleExpiresAt };
  }

  public async logout(token: string | undefined): Promise<void> {
    if (token)
      await this.repository.revokeSessionByDigest(digestSessionToken(token), this.clock.now());
  }

  private refreshedIdleExpiry(session: SessionRecord, now: Date): Date {
    return new Date(
      Math.min(now.getTime() + IDLE_DURATION_MS, session.absoluteExpiresAt.getTime()),
    );
  }

  private toPrincipal(user: AuthenticatedUser): AuthenticatedUser {
    return {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }
}
