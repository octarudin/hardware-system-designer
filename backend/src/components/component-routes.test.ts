import { afterEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@hwsd/shared';

import { buildApp } from '../app.js';
import type { AuthService } from '../auth/auth-service.js';
import { ComponentService } from './component-service.js';
import type { ComponentRepository } from './types.js';

const user: AuthenticatedUser = {
  userId: 'USR-ROUTE-TEST',
  email: 'route@example.com',
  displayName: 'Route Test',
  role: 'USER',
};

const repository: ComponentRepository = {
  list: async (query) => ({ items: [], page: query.page, pageSize: query.pageSize, total: 0 }),
  listReviewQueue: async () => ({ items: [] }),
  getRevision: async () => null,
  getLatest: async () => null,
  publish: async () => {
    throw new Error('not used');
  },
};

function authentication(principal: AuthenticatedUser): AuthService {
  return {
    authenticate: async () => ({
      token: 'route-test',
      user: principal,
      expiresAt: new Date('2026-10-09T00:00:00.000Z'),
    }),
  } as unknown as AuthService;
}

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map(async (app) => app.close())));

describe('component HTTP authorization boundary', () => {
  it('serves the authenticated component read model', async () => {
    const app = buildApp({
      authService: authentication(user),
      componentService: new ComponentService(repository),
    });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/components?page=1&pageSize=10',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], page: 1, pageSize: 10, total: 0 });
  });

  it('rejects a state-changing request without the CSRF header', async () => {
    const app = buildApp({
      authService: authentication(user),
      componentService: new ComponentService(repository),
    });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/components',
      payload: { definition: {} },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'CSRF_CHECK_FAILED' } });
  });

  it('rejects the admin review queue for a regular user', async () => {
    const app = buildApp({
      authService: authentication(user),
      componentService: new ComponentService(repository),
    });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/component-reviews' });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'AUTH_FORBIDDEN' } });
  });
});
