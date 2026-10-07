import Fastify, { type FastifyInstance } from 'fastify';

import { getRuleEngineDescriptor } from '@hwsd/rule-engine';
import { API_VERSION, CONTRACT_VERSIONS, type ServiceStatus } from '@hwsd/shared';

export interface BuildAppOptions {
  readonly logger?: boolean;
}

const statusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['service', 'status', 'version'],
  properties: {
    service: { type: 'string' },
    status: { type: 'string', enum: ['ok', 'ready'] },
    version: { type: 'string' },
  },
} as const;

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    requestIdHeader: 'x-request-id',
  });

  app.get(
    '/health',
    {
      schema: {
        response: { 200: statusSchema },
      },
    },
    async (): Promise<ServiceStatus> => ({
      service: 'api',
      status: 'ok',
      version: API_VERSION,
    }),
  );

  app.get(
    '/ready',
    {
      schema: {
        response: { 200: statusSchema },
      },
    },
    async (): Promise<ServiceStatus> => ({
      service: 'api',
      status: 'ready',
      version: API_VERSION,
    }),
  );

  app.get(`/api/${API_VERSION}`, async () => ({
    service: 'api',
    apiVersion: API_VERSION,
    contracts: CONTRACT_VERSIONS,
    ruleEngine: getRuleEngineDescriptor(),
  }));

  return app;
}
