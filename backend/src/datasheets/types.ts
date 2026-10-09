import type {
  AuthenticatedUser,
  ComponentDraft,
  DatasheetCandidateStatus,
  DatasheetImportResponse,
} from '@hwsd/shared';

export interface DatasheetMetadata {
  readonly datasheetId: string;
  readonly filename: string;
  readonly mediaType: 'application/pdf';
  readonly byteSize: number;
  readonly pageCount: number;
  readonly sha256: string;
  readonly objectKey: string;
  readonly uploadedBy: string;
}

export interface DatasheetCandidateRecord {
  readonly candidateId: string;
  readonly importId: string;
  readonly document: unknown;
  readonly status: DatasheetCandidateStatus;
  readonly modelName: string | null;
  readonly datasheet: ComponentDraft['provenance']['datasheets'][number];
}

export interface DatasheetRepository {
  createImport(metadata: DatasheetMetadata, importId: string): Promise<void>;
  list(requester: AuthenticatedUser): Promise<readonly DatasheetImportResponse[]>;
  get(importId: string, requester: AuthenticatedUser): Promise<DatasheetImportResponse | null>;
  getCandidate(
    candidateId: string,
    requester: AuthenticatedUser,
  ): Promise<DatasheetCandidateRecord | null>;
  updateCandidate(
    candidateId: string,
    requester: AuthenticatedUser,
    status: 'SELECTED' | 'REJECTED',
    document?: unknown,
  ): Promise<boolean>;
  retry(importId: string, requester: AuthenticatedUser): Promise<boolean>;
}

export interface ObjectStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  signedDownload(key: string, filename: string, expiresInSeconds: number): Promise<string>;
}

export interface DatasheetIds {
  datasheetId(): string;
  importId(): string;
}
