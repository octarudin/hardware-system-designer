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

  it('reports the contract and unimplemented rule-engine baseline', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/api/v1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      apiVersion: 'v1',
      ruleEngine: {
        rulesetVersion: 'hwsd.connection-rules/1',
        implementationStatus: 'NOT_IMPLEMENTED',
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
