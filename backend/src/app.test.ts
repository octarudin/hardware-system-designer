import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('API skeleton', () => {
  it('reports liveness', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ service: 'api', status: 'ok', version: 'v1' });
  });

  it('reports the contract and implemented rule-engine baseline', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/api/v1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      apiVersion: 'v1',
      ruleEngine: {
        rulesetVersion: 'hwsd.connection-rules/1',
        implementationStatus: 'IMPLEMENTED',
        ruleCount: 38,
      },
    });
  });

  it('generates OpenAPI for versioned product routes', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    const document = response.json<{ paths: Record<string, unknown> }>();

    expect(response.statusCode).toBe(200);
    expect(document.paths).toHaveProperty('/api/v1');
    expect(document.paths).toHaveProperty('/api/v1/session/login');
    expect(document.paths).toHaveProperty('/api/v1/session');
    expect(document.paths).toHaveProperty('/api/v1/session/logout');
    expect(document.paths).toHaveProperty('/api/v1/components');
    expect(document.paths).toHaveProperty('/api/v1/components/{componentId}/revisions/{revision}');
    expect(document.paths).toHaveProperty('/api/v1/admin/component-reviews');
    expect(document.paths).toHaveProperty('/api/v1/projects');
    expect(document.paths).toHaveProperty('/api/v1/projects/{projectId}');
    expect(document.paths).toHaveProperty('/api/v1/projects/import');
    expect(document.paths).toHaveProperty('/api/v1/projects/{projectId}/export');
  });

  it('returns the standard error envelope with a request id', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/missing',
      headers: { 'x-request-id': 'request-m1-test' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toBe('request-m1-test');
    expect(response.json()).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested route does not exist.',
        requestId: 'request-m1-test',
        details: [],
      },
    });
  });
});
