import type {
  ComponentRevisionResponse,
  DatasheetDownloadResponse,
  DatasheetImportListResponse,
  DatasheetImportResponse,
  PublishDatasheetCandidateRequest,
  UpdateDatasheetCandidateRequest,
  UploadDatasheetRequest,
} from '@hwsd/shared';

import { apiRequest } from './auth-api.js';

export const datasheetApi = {
  list: () => apiRequest<DatasheetImportListResponse>('/datasheet-imports'),
  upload: (request: UploadDatasheetRequest) =>
    apiRequest<DatasheetImportResponse>('/datasheet-imports', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
  get: (importId: string) => apiRequest<DatasheetImportResponse>(`/datasheet-imports/${importId}`),
  download: (importId: string) =>
    apiRequest<DatasheetDownloadResponse>(`/datasheet-imports/${importId}/download`),
  retry: (importId: string) =>
    apiRequest<DatasheetImportResponse>(`/datasheet-imports/${importId}/retry`, {
      method: 'POST',
    }),
  updateCandidate: (candidateId: string, request: UpdateDatasheetCandidateRequest) =>
    apiRequest<DatasheetImportResponse>(`/datasheet-candidates/${candidateId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    }),
  publishCandidate: (candidateId: string, request: PublishDatasheetCandidateRequest) =>
    apiRequest<ComponentRevisionResponse>(`/datasheet-candidates/${candidateId}/publish`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};
