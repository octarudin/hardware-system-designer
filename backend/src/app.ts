import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';

import { getRuleEngineDescriptor } from '@hwsd/rule-engine';
import {
  API_VERSION,
  CONTRACT_VERSIONS,
  type HttpErrorEnvelope,
  type ServiceStatus,
} from '@hwsd/shared';

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

const errorEnvelopeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message', 'requestId', 'details'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              path: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    requestIdHeader: 'x-request-id',
  });

  void app.register(swagger, {
    openapi: {
      info: {
        title: 'Hardware System Designer API',
        description: 'Versioned HTTP API for Hardware System Designer.',
        version: '1.0.0',
      },
    },
  });

  app.addHook('onSend', async (request, reply, payload) => {
    void reply.header('x-request-id', request.id);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    const apiError = error as {
      readonly statusCode?: number;
      readonly validation?: readonly {
        readonly instancePath: string;
        readonly keyword: string;
        readonly message?: string;
      }[];
    };
    const statusCode =
      apiError.statusCode && apiError.statusCode >= 400 ? apiError.statusCode : 500;
    const isValidationError = Boolean(apiError.validation);
    const envelope: HttpErrorEnvelope = {
      error: {
        code: isValidationError ? 'REQUEST_VALIDATION_FAILED' : 'INTERNAL_SERVER_ERROR',
        message: isValidationError
          ? 'The request does not satisfy the API contract.'
          : 'An unexpected error occurred.',
        requestId: request.id,
        details: (apiError.validation ?? []).map((issue) => ({
          code: `REQUEST_${issue.keyword.toUpperCase()}`,
          path: issue.instancePath || '/',
          message: issue.message ?? 'Request validation failed',
        })),
      },
    };
    void reply.status(statusCode).send(envelope);
  });

  app.setNotFoundHandler((request, reply) => {
    const envelope: HttpErrorEnvelope = {
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested route does not exist.',
        requestId: request.id,
        details: [],
      },
    };
    void reply.status(404).send(envelope);
  });

  void app.register(async (routes) => {
    routes.get(
      '/health',
      {
        schema: {
          operationId: 'getHealth',
          tags: ['system'],
          response: { 200: statusSchema },
        },
      },
      async (): Promise<ServiceStatus> => ({
        service: 'api',
        status: 'ok',
        version: API_VERSION,
      }),
    );

    routes.get(
      '/ready',
      {
        schema: {
          operationId: 'getReadiness',
          tags: ['system'],
          response: { 200: statusSchema },
        },
      },
      async (): Promise<ServiceStatus> => ({
        service: 'api',
        status: 'ready',
        version: API_VERSION,
      }),
    );

    routes.get(
      `/api/${API_VERSION}`,
      {
        schema: {
          operationId: 'getApiDescriptor',
          tags: ['system'],
          response: {
            500: errorEnvelopeSchema,
          },
        },
      },
      async () => ({
        service: 'api',
        apiVersion: API_VERSION,
        contracts: CONTRACT_VERSIONS,
        ruleEngine: getRuleEngineDescriptor(),
      }),
    );

    routes.get(
      `/api/${API_VERSION}/openapi.json`,
      { schema: { hide: true } },
      async (_request, reply) => reply.type('application/json').send(app.swagger()),
    );
  });

  return app;
}
