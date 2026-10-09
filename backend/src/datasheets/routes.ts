import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  API_VERSION,
  type PublishDatasheetCandidateRequest,
  type UpdateDatasheetCandidateRequest,
  type UploadDatasheetRequest,
} from '@hwsd/shared';

import { SESSION_COOKIE_NAME, type AuthService } from '../auth/auth-service.js';
import { ApplicationError } from '../errors.js';
import type { DatasheetService } from './datasheet-service.js';

async function requireCsrf(request: FastifyRequest): Promise<void> {
  if (request.headers['x-hwsd-csrf'] !== '1')
    throw new ApplicationError(403, 'CSRF_CHECK_FAILED', 'The request could not be authorized.');
}

export function registerDatasheetRoutes(
  app: FastifyInstance,
  options: {
    readonly service: DatasheetService | undefined;
    readonly authService: AuthService | undefined;
  },
): void {
  const dependencies = () => {
    if (!options.service || !options.authService)
      throw new ApplicationError(
        503,
        'DATASHEET_SERVICE_UNAVAILABLE',
        'The datasheet service is temporarily unavailable.',
      );
    return { service: options.service, auth: options.authService };
  };
  const authenticate = async (request: FastifyRequest) =>
    (await dependencies().auth.authenticate(request.cookies[SESSION_COOKIE_NAME])).user;

  app.get(
    `/api/${API_VERSION}/datasheet-imports`,
    { schema: { operationId: 'listDatasheetImports', tags: ['datasheets'] } },
    async (request) => dependencies().service.list(await authenticate(request)),
  );

  app.post<{ Body: UploadDatasheetRequest }>(
    `/api/${API_VERSION}/datasheet-imports`,
    {
      bodyLimit: 14_100_000,
      schema: {
        operationId: 'uploadDatasheet',
        tags: ['datasheets'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['filename', 'mediaType', 'contentBase64'],
          properties: {
            filename: { type: 'string', minLength: 1, maxLength: 255 },
            mediaType: { const: 'application/pdf' },
            contentBase64: { type: 'string', minLength: 1, maxLength: 13_981_016 },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request, reply) => {
      const result = await dependencies().service.upload(await authenticate(request), request.body);
      void reply.status(202);
      return result;
    },
  );

  app.get<{ Params: { importId: string } }>(
    `/api/${API_VERSION}/datasheet-imports/:importId`,
    { schema: { operationId: 'getDatasheetImport', tags: ['datasheets'] } },
    async (request) =>
      dependencies().service.get(request.params.importId, await authenticate(request)),
  );

  app.get<{ Params: { importId: string } }>(
    `/api/${API_VERSION}/datasheet-imports/:importId/download`,
    { schema: { operationId: 'downloadDatasheet', tags: ['datasheets'] } },
    async (request) =>
      dependencies().service.download(request.params.importId, await authenticate(request)),
  );

  app.post<{ Params: { importId: string } }>(
    `/api/${API_VERSION}/datasheet-imports/:importId/retry`,
    {
      schema: { operationId: 'retryDatasheetImport', tags: ['datasheets'] },
      preHandler: requireCsrf,
    },
    async (request) =>
      dependencies().service.retry(request.params.importId, await authenticate(request)),
  );

  app.patch<{
    Params: { candidateId: string };
    Body: UpdateDatasheetCandidateRequest;
  }>(
    `/api/${API_VERSION}/datasheet-candidates/:candidateId`,
    {
      schema: {
        operationId: 'updateDatasheetCandidate',
        tags: ['datasheets'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: {
            status: { enum: ['SELECTED', 'REJECTED'] },
            document: { type: 'object' },
          },
        },
      },
      preHandler: requireCsrf,
    },
    async (request) =>
      dependencies().service.updateCandidate(
        request.params.candidateId,
        await authenticate(request),
        request.body,
      ),
  );

  app.post<{
    Params: { candidateId: string };
    Body: PublishDatasheetCandidateRequest;
  }>(
    `/api/${API_VERSION}/datasheet-candidates/:candidateId/publish`,
    {
      schema: {
        operationId: 'publishDatasheetCandidate',
        tags: ['datasheets'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['definition'],
          properties: { definition: { type: 'object' } },
        },
      },
      preHandler: requireCsrf,
    },
    async (request, reply) => {
      const result = await dependencies().service.publishCandidate(
        request.params.candidateId,
        await authenticate(request),
        request.body.definition,
      );
      void reply.status(201);
      return result;
    },
  );
}
