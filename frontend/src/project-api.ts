import type {
  CreateProjectRequest,
  DeleteProjectResponse,
  ImportProjectRequest,
  ProjectExportResponse,
  ProjectFileV1,
  ProjectListResponse,
  ProjectResponse,
  RenameProjectRequest,
  SaveProjectRequest,
} from '@hwsd/shared';

import { apiRequest } from './auth-api.js';

export const projectApi = {
  list: (search = '') =>
    apiRequest<ProjectListResponse>(`/projects${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  get: (projectId: string) => apiRequest<ProjectResponse>(`/projects/${projectId}`),
  create: (request: CreateProjectRequest) =>
    apiRequest<ProjectResponse>('/projects', { method: 'POST', body: JSON.stringify(request) }),
  save: (projectId: string, expectedDocumentRevision: number, document: ProjectFileV1) =>
    apiRequest<ProjectResponse>(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ expectedDocumentRevision, document } satisfies SaveProjectRequest),
    }),
  rename: (projectId: string, request: RenameProjectRequest) =>
    apiRequest<ProjectResponse>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    }),
  delete: (projectId: string) =>
    apiRequest<DeleteProjectResponse>(`/projects/${projectId}`, { method: 'DELETE', body: '{}' }),
  export: (projectId: string) => apiRequest<ProjectExportResponse>(`/projects/${projectId}/export`),
  importCopy: (request: ImportProjectRequest) =>
    apiRequest<ProjectResponse>('/projects/import', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};

export function downloadText(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
