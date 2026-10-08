import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  API_VERSION,
  type ComponentListQuery,
  type PublishComponentRequest,
  type ReviewComponentRequest,
} from '@hwsd/shared';

import { SESSION_COOKIE_NAME, type AuthService } from '../auth/auth-service.js';
import { ApplicationError } from '../errors.js';
import type { ComponentService } from './component-service.js';

const categories = [
  'MICROCONTROLLER',
  'SENSOR',
  'ACTUATOR',
  'RELAY',
  'DISPLAY',
  'ETHERNET_CONTROLLER',
  'GSM_LTE_MODULE',
  'RF_MODULE',
  'BATTERY',
  'CHARGER',
  'CONNECTOR',
  'EXTERNAL_SERVER_CLOUD',
  'COMPUTER_SBC',
  'POWER_SUPPLY',
  'VOLTAGE_REGULATOR',
  'INTERFACE_CONVERTER_TRANSCEIVER',
  'COMMUNICATION_MODULE',
  'GENERIC_IC',
  'GENERIC_MODULE',
  'GENERIC_BOARD',
  'CUSTOM_COMPONENT',
] as const;
const abstractions = ['RAW_IC', 'MODULE', 'FINISHED_SENSOR', 'BOARD', 'SYSTEM', 'CUSTOM'] as const;
const statuses = [
  'AI_GENERATED',
  'REVIEW_REQUIRED',
  'USER_REVIEWED',
  'PENDING_ADMIN_VERIFICATION',
  'VERIFIED',
  'DEPRECATED',
  'DISABLED',
] as const;

const componentBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['definition'],
  properties: { definition: { type: 'object' } },
} as const;

async function requireCsrf(request: FastifyRequest): Promise<void> {
  if (request.headers['x-hwsd-csrf'] !== '1')
    throw new ApplicationError(403, 'CSRF_CHECK_FAILED', 'The request could not be authorized.');
}

export interface ComponentRouteOptions {
  readonly service: ComponentService | undefined;
  readonly authService: AuthService | undefined;
}

export function registerComponentRoutes(
  app: FastifyInstance,
  options: ComponentRouteOptions,
): void {
  const dependencies = () => {
    if (!options.service || !options.authService)
      throw new ApplicationError(
        503,
        'COMPONENT_SERVICE_UNAVAILABLE',
        'The component library is temporarily unavailable.',
      );
    return { service: options.service, auth: options.authService };
  };
  const authenticate = async (request: FastifyRequest) => {
    const { auth } = dependencies();
    return (await auth.authenticate(request.cookies[SESSION_COOKIE_NAME])).user;
  };

  app.get<{ Querystring: ComponentListQuery }>(
    `/api/${API_VERSION}/components`,
    {
      schema: {
        operationId: 'listComponents',
        tags: ['components'],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 200 },
            category: { type: 'string', enum: categories },
            abstraction: { type: 'string', enum: abstractions },
            status: { type: 'string', enum: statuses },
            manufacturer: { type: 'string', minLength: 1, maxLength: 200 },
            sort: { type: 'string', enum: ['name', 'updated'] },
            page: { type: 'integer', minimum: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (request) => {
      await authenticate(request);
      return dependencies().service.list(request.query);
    },
  );

  app.get<{ Params: { componentId: string; revision: number } }>(
    `/api/${API_VERSION}/components/:componentId/revisions/:revision`,
    {
      schema: {
        operationId: 'getComponentRevision',
        tags: ['components'],
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['componentId', 'revision'],
          properties: {
            componentId: { type: 'string', pattern: '^CMP-[A-Z0-9][A-Z0-9_-]*$' },
            revision: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => {
      await authenticate(request);
      return dependencies().service.getRevision(
        request.params.componentId,
        request.params.revision,
      );
    },
  );

  app.post<{ Body: PublishComponentRequest }>(
    `/api/${API_VERSION}/components`,
    {
      schema: { operationId: 'createComponent', tags: ['components'], body: componentBodySchema },
      preHandler: requireCsrf,
    },
    async (request, reply) => {
      const user = await authenticate(request);
      const result = await dependencies().service.create(user, request.body.definition);
      void reply.status(201);
      return result;
    },
  );

  app.post<{ Params: { componentId: string }; Body: PublishComponentRequest }>(
    `/api/${API_VERSION}/components/:componentId/revisions`,
    {
      schema: {
        operationId: 'reviseComponent',
        tags: ['components'],
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['componentId'],
          properties: { componentId: { type: 'string', pattern: '^CMP-[A-Z0-9][A-Z0-9_-]*$' } },
        },
        body: componentBodySchema,
      },
      preHandler: requireCsrf,
    },
    async (request, reply) => {
      const user = await authenticate(request);
      const result = await dependencies().service.revise(
        user,
        request.params.componentId,
        request.body.definition,
      );
      void reply.status(201);
      return result;
    },
  );

  app.get(`/api/${API_VERSION}/admin/component-reviews`, async (request) => {
    const user = await authenticate(request);
    return dependencies().service.listReviewQueue(user);
  });

  app.post<{
    Params: { componentId: string; revision: number };
    Body: ReviewComponentRequest;
  }>(
    `/api/${API_VERSION}/admin/component-reviews/:componentId/:revision/actions`,
    {
      schema: {
        operationId: 'reviewComponent',
        tags: ['component-reviews'],
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['componentId', 'revision'],
          properties: {
            componentId: { type: 'string', pattern: '^CMP-[A-Z0-9][A-Z0-9_-]*$' },
            revision: { type: 'integer', minimum: 1 },
          },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['action', 'note'],
          properties: {
            action: {
              type: 'string',
              enum: ['APPROVE', 'REQUEST_REVISION', 'REJECT', 'DEPRECATE', 'DISABLE'],
            },
            note: { type: 'string', minLength: 1, maxLength: 4000 },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request, reply) => {
      const user = await authenticate(request);
      const result = await dependencies().service.review(
        user,
        request.params.componentId,
        request.params.revision,
        request.body.action,
        request.body.note,
      );
      void reply.status(201);
      return result;
    },
  );
}
