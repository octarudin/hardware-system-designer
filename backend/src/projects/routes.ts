import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  API_VERSION,
  type AddProjectComponentRequest,
  type ApplyComponentUpdateRequest,
  type CommitConnectionRequest,
  type CreateProjectRequest,
  type ImportProjectRequest,
  type RenameProjectRequest,
  type PreviewComponentUpdateRequest,
  type PreviewConnectionRequest,
  type RunDesignCheckRequest,
  type SaveProjectRequest,
} from '@hwsd/shared';

import { SESSION_COOKIE_NAME, type AuthService } from '../auth/auth-service.js';
import { ApplicationError } from '../errors.js';
import type { ProjectService } from './project-service.js';

async function requireCsrf(request: FastifyRequest): Promise<void> {
  if (request.headers['x-hwsd-csrf'] !== '1')
    throw new ApplicationError(403, 'CSRF_CHECK_FAILED', 'The request could not be authorized.');
}

const projectParams = {
  type: 'object',
  additionalProperties: false,
  required: ['projectId'],
  properties: { projectId: { type: 'string', pattern: '^PROJ-[A-Z0-9][A-Z0-9_-]*$' } },
} as const;
const instanceParams = {
  type: 'object',
  additionalProperties: false,
  required: ['projectId', 'instanceId'],
  properties: {
    projectId: { type: 'string', pattern: '^PROJ-[A-Z0-9][A-Z0-9_-]*$' },
    instanceId: { type: 'string', pattern: '^INST-[A-Z0-9][A-Z0-9_-]*$' },
  },
} as const;
const expectedRevision = { type: 'integer', minimum: 1 } as const;

export function registerProjectRoutes(
  app: FastifyInstance,
  options: {
    readonly service: ProjectService | undefined;
    readonly authService: AuthService | undefined;
  },
): void {
  const dependencies = () => {
    if (!options.service || !options.authService)
      throw new ApplicationError(
        503,
        'PROJECT_SERVICE_UNAVAILABLE',
        'Project persistence is temporarily unavailable.',
      );
    return { service: options.service, auth: options.authService };
  };
  const authenticate = async (request: FastifyRequest) =>
    (await dependencies().auth.authenticate(request.cookies[SESSION_COOKIE_NAME])).user;

  app.get<{ Querystring: { q?: string } }>(
    `/api/${API_VERSION}/projects`,
    {
      schema: {
        operationId: 'listProjects',
        tags: ['projects'],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { q: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
    },
    async (request) => dependencies().service.list(await authenticate(request), request.query.q),
  );

  app.post<{ Body: CreateProjectRequest }>(
    `/api/${API_VERSION}/projects`,
    {
      schema: {
        operationId: 'createProject',
        tags: ['projects'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            description: { type: 'string', minLength: 1, maxLength: 2000 },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request, reply) => {
      const result = await dependencies().service.create(
        await authenticate(request),
        request.body.name,
        request.body.description,
      );
      void reply.status(201);
      return result;
    },
  );

  app.post<{ Body: ImportProjectRequest }>(
    `/api/${API_VERSION}/projects/import`,
    {
      schema: {
        operationId: 'importProjectCopy',
        tags: ['projects'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['contentBase64'],
          properties: { contentBase64: { type: 'string', minLength: 1, maxLength: 7_100_000 } },
        },
      },
      preHandler: requireCsrf,
    },
    async (request, reply) => {
      const result = await dependencies().service.importCopy(
        await authenticate(request),
        request.body.contentBase64,
      );
      void reply.status(201);
      return result;
    },
  );

  app.get<{ Params: { projectId: string } }>(
    `/api/${API_VERSION}/projects/:projectId`,
    { schema: { operationId: 'getProject', tags: ['projects'], params: projectParams } },
    async (request) =>
      dependencies().service.get(await authenticate(request), request.params.projectId),
  );

  app.put<{ Params: { projectId: string }; Body: SaveProjectRequest }>(
    `/api/${API_VERSION}/projects/:projectId`,
    {
      schema: {
        operationId: 'saveProject',
        tags: ['projects'],
        params: projectParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedDocumentRevision', 'document'],
          properties: {
            expectedDocumentRevision: { type: 'integer', minimum: 1 },
            document: { type: 'object' },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request) =>
      dependencies().service.save(
        await authenticate(request),
        request.params.projectId,
        request.body.expectedDocumentRevision,
        request.body.document,
      ),
  );

  app.post<{ Params: { projectId: string }; Body: AddProjectComponentRequest }>(
    `/api/${API_VERSION}/projects/:projectId/components`,
    {
      schema: {
        operationId: 'addProjectComponent',
        tags: ['projects'],
        params: projectParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedDocumentRevision', 'componentId', 'revision', 'layout'],
          properties: {
            expectedDocumentRevision: expectedRevision,
            componentId: { type: 'string', minLength: 1 },
            revision: { type: 'integer', minimum: 1 },
            layout: {
              type: 'object',
              additionalProperties: false,
              required: ['x', 'y'],
              properties: { x: { type: 'number' }, y: { type: 'number' } },
            },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request, reply) => {
      const result = await dependencies().service.addComponent(
        await authenticate(request),
        request.params.projectId,
        request.body.expectedDocumentRevision,
        request.body.componentId,
        request.body.revision,
        request.body.layout,
      );
      void reply.status(201);
      return result;
    },
  );

  app.post<{ Params: { projectId: string }; Body: PreviewConnectionRequest }>(
    `/api/${API_VERSION}/projects/:projectId/connections/preview`,
    {
      schema: {
        operationId: 'previewProjectConnection',
        tags: ['projects'],
        params: projectParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedDocumentRevision', 'connection'],
          properties: {
            expectedDocumentRevision: expectedRevision,
            connection: { type: 'object' },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request) =>
      dependencies().service.previewConnection(
        await authenticate(request),
        request.params.projectId,
        request.body.expectedDocumentRevision,
        request.body.connection,
      ),
  );

  app.post<{ Params: { projectId: string }; Body: CommitConnectionRequest }>(
    `/api/${API_VERSION}/projects/:projectId/connections/commit`,
    {
      schema: {
        operationId: 'commitProjectConnection',
        tags: ['projects'],
        params: projectParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedDocumentRevision', 'connection'],
          properties: {
            expectedDocumentRevision: expectedRevision,
            connection: { type: 'object' },
            confirmedWarnings: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['fingerprint'],
                properties: {
                  fingerprint: { type: 'string', minLength: 1 },
                  note: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request) =>
      dependencies().service.commitConnection(
        await authenticate(request),
        request.params.projectId,
        request.body.expectedDocumentRevision,
        request.body.connection,
        request.body.confirmedWarnings,
      ),
  );

  app.post<{ Params: { projectId: string }; Body: RunDesignCheckRequest }>(
    `/api/${API_VERSION}/projects/:projectId/design-checks`,
    {
      schema: {
        operationId: 'runProjectDesignCheck',
        tags: ['projects'],
        params: projectParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedDocumentRevision'],
          properties: { expectedDocumentRevision: expectedRevision },
        },
      },
      preHandler: requireCsrf,
    },
    async (request, reply) => {
      const result = await dependencies().service.runDesignCheck(
        await authenticate(request),
        request.params.projectId,
        request.body.expectedDocumentRevision,
      );
      void reply.status(201);
      return result;
    },
  );

  app.post<{
    Params: { projectId: string; instanceId: string };
    Body: PreviewComponentUpdateRequest;
  }>(
    `/api/${API_VERSION}/projects/:projectId/components/:instanceId/update-preview`,
    {
      schema: {
        operationId: 'previewProjectComponentUpdate',
        tags: ['projects'],
        params: instanceParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedDocumentRevision'],
          properties: {
            expectedDocumentRevision: expectedRevision,
            targetRevision: { type: 'integer', minimum: 1 },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request) =>
      dependencies().service.previewComponentUpdate(
        await authenticate(request),
        request.params.projectId,
        request.params.instanceId,
        request.body.expectedDocumentRevision,
        request.body.targetRevision,
      ),
  );

  app.post<{
    Params: { projectId: string; instanceId: string };
    Body: ApplyComponentUpdateRequest;
  }>(
    `/api/${API_VERSION}/projects/:projectId/components/:instanceId/apply-update`,
    {
      schema: {
        operationId: 'applyProjectComponentUpdate',
        tags: ['projects'],
        params: instanceParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedDocumentRevision'],
          properties: {
            expectedDocumentRevision: expectedRevision,
            targetRevision: { type: 'integer', minimum: 1 },
            confirmedWarnings: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['fingerprint'],
                properties: {
                  fingerprint: { type: 'string', minLength: 1 },
                  note: { type: 'string', minLength: 1 },
                },
              },
            },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request) =>
      dependencies().service.applyComponentUpdate(
        await authenticate(request),
        request.params.projectId,
        request.params.instanceId,
        request.body.expectedDocumentRevision,
        request.body.targetRevision,
        request.body.confirmedWarnings,
      ),
  );

  app.patch<{ Params: { projectId: string }; Body: RenameProjectRequest }>(
    `/api/${API_VERSION}/projects/:projectId`,
    {
      schema: {
        operationId: 'renameProject',
        tags: ['projects'],
        params: projectParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['expectedDocumentRevision', 'name'],
          properties: {
            expectedDocumentRevision: { type: 'integer', minimum: 1 },
            name: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request) =>
      dependencies().service.rename(
        await authenticate(request),
        request.params.projectId,
        request.body.expectedDocumentRevision,
        request.body.name,
      ),
  );

  app.get<{ Params: { projectId: string } }>(
    `/api/${API_VERSION}/projects/:projectId/export`,
    { schema: { operationId: 'exportProject', tags: ['projects'], params: projectParams } },
    async (request) =>
      dependencies().service.export(await authenticate(request), request.params.projectId),
  );

  app.delete<{ Params: { projectId: string } }>(
    `/api/${API_VERSION}/projects/:projectId`,
    {
      schema: { operationId: 'deleteProject', tags: ['projects'], params: projectParams },
      preHandler: requireCsrf,
    },
    async (request) =>
      dependencies().service.softDelete(await authenticate(request), request.params.projectId),
  );
}
