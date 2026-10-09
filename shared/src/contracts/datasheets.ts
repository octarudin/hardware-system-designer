import type { ComponentDraft } from './components.js';

export type DatasheetImportStatus =
  'QUEUED' | 'PROCESSING' | 'REVIEW_REQUIRED' | 'COMPLETED' | 'FAILED';

export type DatasheetCandidateStatus = 'DETECTED' | 'SELECTED' | 'REJECTED' | 'PUBLISHED';

export interface UploadDatasheetRequest {
  readonly filename: string;
  readonly mediaType: 'application/pdf';
  readonly contentBase64: string;
}

export interface DatasheetCandidateSummary {
  readonly candidateId: string;
  readonly ordinal: number;
  readonly detectedLabel: string | null;
  readonly overallConfidence: number | null;
  readonly status: DatasheetCandidateStatus;
  readonly document: unknown;
  readonly publishedComponentId: string | null;
  readonly publishedRevision: number | null;
}

export interface DatasheetImportResponse {
  readonly importId: string;
  readonly datasheetId: string;
  readonly filename: string;
  readonly byteSize: number;
  readonly pageCount: number;
  readonly sha256: string;
  readonly status: DatasheetImportStatus;
  readonly modelName: string | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly candidates: readonly DatasheetCandidateSummary[];
}

export interface DatasheetImportListResponse {
  readonly items: readonly DatasheetImportResponse[];
}

export interface UpdateDatasheetCandidateRequest {
  readonly status: 'SELECTED' | 'REJECTED';
  readonly document?: unknown;
}

export interface PublishDatasheetCandidateRequest {
  readonly definition: ComponentDraft;
}

export interface DatasheetDownloadResponse {
  readonly url: string;
  readonly expiresAt: string;
}

export interface ExtractedClaim {
  readonly field: string;
  readonly value: string;
  readonly page: number;
  readonly sourceExcerpt: string;
  readonly confidence: number;
}

export interface ExtractedComponentCandidate {
  readonly label: string;
  readonly name: string;
  readonly manufacturer: string | null;
  readonly partNumber: string | null;
  readonly category: ComponentDraft['classification']['category'];
  readonly abstraction: ComponentDraft['classification']['abstraction'];
  readonly confidence: number;
  readonly claims: readonly ExtractedClaim[];
}

export interface DatasheetExtractionResult {
  readonly candidates: readonly ExtractedComponentCandidate[];
}
