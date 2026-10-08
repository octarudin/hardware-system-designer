import { afterEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@hwsd/shared';

import { buildApp } from '../app.js';
import { ApplicationError } from '../errors.js';
import { Argon2PasswordVerifier, hashPassword } from './argon2-password.js';
import { requireAdmin, requireOwner, requireUser } from './authorization.js';
import { AuthService } from './auth-service.js';
import type {
  AuthRepository,
  Clock,
  NewSession,
  PasswordVerifier,
  SessionRecord,
  UserAccount,
} from './types.js';

class TestClock implements Clock {
  public constructor(public value = new Date('2026-01-01T00:00:00.000Z')) {}
  public now(): Date {
    return new Date(this.value);
  }
}

class TestPasswordVerifier implements PasswordVerifier {
  public async verify(passwordHash: string | undefined, password: string): Promise<boolean> {
    return passwordHash === `hash:${password}`;
  }
}

class MemoryAuthRepository implements AuthRepository {
  public readonly sessions = new Map<string, NewSession & { revokedAt?: Date }>();
  public readonly users: UserAccount[] = [];

  public async findUserByEmail(email: string): Promise<UserAccount | null> {
    return this.users.find((user) => user.email.toLowerCase() === email) ?? null;
  }
  public async createSession(session: NewSession): Promise<void> {
    this.sessions.set(session.tokenDigest, session);
  }
  public async findActiveSessionByDigest(digest: string, now: Date): Promise<SessionRecord | null> {
    const session = this.sessions.get(digest);
    const user = session && this.users.find((candidate) => candidate.userId === session.userId);
    if (
      !session ||
      !user ||
      session.revokedAt ||
      session.idleExpiresAt <= now ||
      session.absoluteExpiresAt <= now
    )
      return null;
    return {
      sessionId: session.sessionId,
      user,
      accountStatus: user.accountStatus,
      lastUsedAt: session.lastUsedAt,
      idleExpiresAt: session.idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    };
  }
  public async touchSession(
    sessionId: string,
    lastUsedAt: Date,
    idleExpiresAt: Date,
  ): Promise<void> {
    for (const [digest, session] of this.sessions) {
      if (session.sessionId === sessionId)
        this.sessions.set(digest, { ...session, lastUsedAt, idleExpiresAt });
    }
  }
  public async revokeSessionByDigest(digest: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(digest);
    if (session) this.sessions.set(digest, { ...session, revokedAt });
  }
  public async recordSuccessfulLogin(): Promise<void> {}
}

function user(overrides: Partial<UserAccount> = {}): UserAccount {
  return {
    userId: 'USR-TEST',
    email: 'engineer@example.com',
    displayName: 'Test Engineer',
    passwordHash: 'hash:correct horse',
    role: 'USER',
    accountStatus: 'ACTIVE',
    ...overrides,
  };
}

function setup() {
  const repository = new MemoryAuthRepository();
  const clock = new TestClock();
  repository.users.push(user());
  return {
    repository,
    clock,
    service: new AuthService(repository, new TestPasswordVerifier(), clock),
  };
}

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map(async (app) => app.close())));

describe('authentication service', () => {
  it('hashes and verifies passwords with Argon2id', async () => {
    const passwordHash = await hashPassword('correct horse battery staple');
    const verifier = new Argon2PasswordVerifier();

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verifier.verify(passwordHash, 'correct horse battery staple')).resolves.toBe(true);
    await expect(verifier.verify(passwordHash, 'incorrect')).resolves.toBe(false);
  });

  it('creates a digest-only session for an active user', async () => {
    const { repository, service } = setup();
    const grant = await service.login(' Engineer@Example.com ', 'correct horse');
    const stored = [...repository.sessions.values()][0];

    expect(grant.user).toMatchObject({ userId: 'USR-TEST', role: 'USER' });
    expect(stored?.tokenDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(stored?.tokenDigest).not.toContain(grant.token);
  });

  it('uses the same failure for disabled, missing, and incorrect credentials', async () => {
    const { repository, service } = setup();
    repository.users.push(
      user({ userId: 'USR-DISABLED', email: 'disabled@example.com', accountStatus: 'DISABLED' }),
    );

    for (const [email, password] of [
      ['disabled@example.com', 'correct horse'],
      ['missing@example.com', 'anything'],
      ['engineer@example.com', 'wrong'],
    ]) {
      await expect(service.login(email ?? '', password ?? '')).rejects.toMatchObject({
        statusCode: 401,
        code: 'AUTH_INVALID_CREDENTIALS',
      });
    }
  });

  it('revokes a session on logout', async () => {
    const { service } = setup();
    const grant = await service.login('engineer@example.com', 'correct horse');
    await expect(service.authenticate(grant.token)).resolves.toMatchObject({ user: grant.user });
    await service.logout(grant.token);
    await expect(service.authenticate(grant.token)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });

  it('rejects expired sessions and sessions whose user becomes disabled', async () => {
    const { clock, repository, service } = setup();
    const expired = await service.login('engineer@example.com', 'correct horse');
    clock.value = new Date('2026-01-01T13:00:00.000Z');
    await expect(service.authenticate(expired.token)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });

    clock.value = new Date('2026-01-02T00:00:00.000Z');
    const disabled = await service.login('engineer@example.com', 'correct horse');
    repository.users[0] = user({ accountStatus: 'DISABLED' });
    await expect(service.authenticate(disabled.token)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });
});

describe('session HTTP boundary', () => {
  it('requires CSRF proof and completes login, current-session, and logout', async () => {
    const { service } = setup();
    const app = buildApp({ authService: service, secureCookies: false });
    apps.push(app);

    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/session/login',
      payload: { email: 'engineer@example.com', password: 'correct horse' },
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.json()).toMatchObject({ error: { code: 'CSRF_CHECK_FAILED' } });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/session/login',
      headers: { 'x-hwsd-csrf': '1' },
      payload: { email: 'engineer@example.com', password: 'correct horse' },
    });
    const cookie = login.cookies[0];
    expect(login.statusCode).toBe(200);
    expect(login.headers['cache-control']).toBe('no-store');
    expect(cookie).toMatchObject({ name: 'hwsd_session', httpOnly: true, sameSite: 'Lax' });

    const current = await app.inject({
      method: 'GET',
      url: '/api/v1/session',
      cookies: { hwsd_session: cookie?.value ?? '' },
    });
    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({ user: { userId: 'USR-TEST' } });

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/session/logout',
      headers: { 'x-hwsd-csrf': '1' },
      cookies: { hwsd_session: cookie?.value ?? '' },
    });
    expect(logout.statusCode).toBe(200);

    const afterLogout = await app.inject({
      method: 'GET',
      url: '/api/v1/session',
      cookies: { hwsd_session: cookie?.value ?? '' },
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it('rate-limits repeated credential attempts without changing the error envelope', async () => {
    const { service } = setup();
    const app = buildApp({ authService: service, secureCookies: false });
    apps.push(app);

    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/api/v1/session/login',
          headers: { 'x-hwsd-csrf': '1' },
          payload: { email: 'engineer@example.com', password: 'wrong' },
        }),
      );
    }
    expect(responses.slice(0, 5).every((response) => response.statusCode === 401)).toBe(true);
    expect(responses[5]?.statusCode).toBe(429);
    expect(responses[5]?.json()).toMatchObject({ error: { code: 'RATE_LIMIT_EXCEEDED' } });
  });
});

describe('authorization policies', () => {
  const principal: AuthenticatedUser = {
    userId: 'USR-TEST',
    email: 'engineer@example.com',
    displayName: 'Test Engineer',
    role: 'USER',
  };

  it('fails closed for admin-only actions', () => {
    expect(() => requireUser(null)).toThrowError(ApplicationError);
    expect(() => requireAdmin(principal)).toThrowError(ApplicationError);
    expect(() => requireAdmin({ ...principal, role: 'ADMIN' })).not.toThrow();
  });

  it('hides both absent and other-user resources behind the same response', () => {
    for (const owner of [null, 'USR-SOMEONE-ELSE']) {
      try {
        requireOwner(principal, owner);
        throw new Error('Expected ownership rejection');
      } catch (error) {
        expect(error).toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
      }
    }
    expect(() => requireOwner(principal, 'USR-TEST')).not.toThrow();
  });
});
