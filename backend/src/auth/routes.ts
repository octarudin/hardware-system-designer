import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { API_VERSION, type LoginRequest, type SessionResponse } from '@hwsd/shared';

import { ApplicationError } from '../errors.js';
import { SESSION_COOKIE_NAME } from './auth-service.js';
import type { AuthService } from './auth-service.js';

const loginBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email', maxLength: 320 },
    password: { type: 'string', minLength: 1, maxLength: 1024 },
  },
} as const;

const sessionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['user', 'expiresAt'],
  properties: {
    user: {
      type: 'object',
      additionalProperties: false,
      required: ['userId', 'email', 'displayName', 'role'],
      properties: {
        userId: { type: 'string' },
        email: { type: 'string' },
        displayName: { type: 'string' },
        role: { type: 'string', enum: ['USER', 'ADMIN'] },
      },
    },
    expiresAt: { type: 'string', format: 'date-time' },
  },
} as const;

async function requireCsrfHeader(request: FastifyRequest): Promise<void> {
  if (request.headers['x-hwsd-csrf'] !== '1') {
    throw new ApplicationError(403, 'CSRF_CHECK_FAILED', 'The request could not be authorized.');
  }
}

function createLoginThrottle() {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return async (request: FastifyRequest): Promise<void> => {
    const now = Date.now();
    const current = attempts.get(request.ip);
    const window =
      !current || current.resetAt <= now ? { count: 0, resetAt: now + 900_000 } : current;
    window.count += 1;
    attempts.set(request.ip, window);
    if (window.count > 5) {
      throw new ApplicationError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Try again later.');
    }
  };
}

function cookieOptions(secure: boolean) {
  return {
    path: `/api/${API_VERSION}`,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
  };
}

async function preventCaching(
  _request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
): Promise<unknown> {
  void reply.header('cache-control', 'no-store');
  return payload;
}

export interface AuthRouteOptions {
  readonly service: AuthService | undefined;
  readonly secureCookies: boolean;
}

export function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): void {
  const service = options.service;
  const throttleLogin = createLoginThrottle();
  const requireService = (): AuthService => {
    if (!service) {
      throw new ApplicationError(
        503,
        'AUTH_SERVICE_UNAVAILABLE',
        'Authentication is temporarily unavailable.',
      );
    }
    return service;
  };

  app.post<{ Body: LoginRequest }>(
    `/api/${API_VERSION}/session/login`,
    {
      schema: {
        operationId: 'login',
        tags: ['session'],
        body: loginBodySchema,
        response: { 200: sessionResponseSchema },
      },
      onSend: preventCaching,
      preHandler: [requireCsrfHeader, throttleLogin],
    },
    async (request, reply): Promise<SessionResponse> => {
      const grant = await requireService().login(request.body.email, request.body.password);
      void reply.setCookie(SESSION_COOKIE_NAME, grant.token, cookieOptions(options.secureCookies));
      return { user: grant.user, expiresAt: grant.expiresAt.toISOString() };
    },
  );

  app.get(
    `/api/${API_VERSION}/session`,
    {
      schema: {
        operationId: 'getCurrentSession',
        tags: ['session'],
        response: { 200: sessionResponseSchema },
      },
      onSend: preventCaching,
    },
    async (request): Promise<SessionResponse> => {
      const grant = await requireService().authenticate(request.cookies[SESSION_COOKIE_NAME]);
      return { user: grant.user, expiresAt: grant.expiresAt.toISOString() };
    },
  );

  app.post(
    `/api/${API_VERSION}/session/logout`,
    {
      schema: {
        operationId: 'logout',
        tags: ['session'],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['loggedOut'],
            properties: { loggedOut: { const: true } },
          },
        },
      },
      onSend: preventCaching,
      preHandler: requireCsrfHeader,
    },
    async (request, reply) => {
      await requireService().logout(request.cookies[SESSION_COOKIE_NAME]);
      void reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions(options.secureCookies));
      return { loggedOut: true as const };
    },
  );
}
