import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';

import { getRuleEngineDescriptor } from '@hwsd/rule-engine';
import {
  API_VERSION,
  CONTRACT_VERSIONS,
  type HttpErrorEnvelope,
  type ServiceStatus,
} from '@hwsd/shared';

import type { AuthService } from './auth/auth-service.js';
import { registerAuthRoutes } from './auth/routes.js';
import type { ComponentService } from './components/component-service.js';
import { registerComponentRoutes } from './components/routes.js';
import { ApplicationError } from './errors.js';
import type { ProjectService } from './projects/project-service.js';
import { registerProjectRoutes } from './projects/routes.js';

export interface BuildAppOptions {
  readonly authService?: AuthService;
  readonly componentService?: ComponentService;
  readonly projectService?: ProjectService;
  readonly logger?: boolean;
  readonly secureCookies?: boolean;
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
  void app.register(cookie);

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
    const applicationError = error instanceof ApplicationError ? error : undefined;
    const statusCode = applicationError
      ? applicationError.statusCode
      : apiError.statusCode && apiError.statusCode >= 400
        ? apiError.statusCode
        : 500;
    const isValidationError = Boolean(apiError.validation);
    const isRateLimited = statusCode === 429;
    const envelope: HttpErrorEnvelope = {
      error: {
        code:
          applicationError?.code ??
          (isValidationError
            ? 'REQUEST_VALIDATION_FAILED'
            : isRateLimited
              ? 'RATE_LIMIT_EXCEEDED'
              : 'INTERNAL_SERVER_ERROR'),
        message:
          applicationError?.message ??
          (isValidationError
            ? 'The request does not satisfy the API contract.'
            : isRateLimited
              ? 'Too many requests. Try again later.'
              : 'An unexpected error occurred.'),
        requestId: request.id,
        details:
          applicationError?.details ??
          (apiError.validation ?? []).map((issue) => ({
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

  void app.register(async (authApp) =>
    registerAuthRoutes(authApp, {
      service: options.authService,
      secureCookies: options.secureCookies ?? process.env.NODE_ENV === 'production',
    }),
  );

  void app.register(async (componentApp) =>
    registerComponentRoutes(componentApp, {
      service: options.componentService,
      authService: options.authService,
    }),
  );

  void app.register(async (projectApp) =>
    registerProjectRoutes(projectApp, {
      service: options.projectService,
      authService: options.authService,
    }),
  );

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
