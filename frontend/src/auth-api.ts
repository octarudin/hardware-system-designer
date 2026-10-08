import type {
  HttpErrorEnvelope,
  LoginRequest,
  LogoutResponse,
  SessionResponse,
} from '@hwsd/shared';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'content-type': 'application/json', 'x-hwsd-csrf': '1' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as HttpErrorEnvelope | null;
    throw new ApiError(
      response.status,
      payload?.error.code ?? 'REQUEST_FAILED',
      payload?.error.message ?? 'The request could not be completed.',
    );
  }
  return response.json() as Promise<T>;
}

export const authApi = {
  current: () => apiRequest<SessionResponse>('/session'),
  login: (credentials: LoginRequest) =>
    apiRequest<SessionResponse>('/session/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  logout: () => apiRequest<LogoutResponse>('/session/logout', { method: 'POST', body: '{}' }),
};
