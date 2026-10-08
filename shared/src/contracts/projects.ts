import type { HardwareSystemDesignerProjectFileV1 as ProjectFileV1 } from '../generated/project-file-v1.js';

export interface ProjectSummary {
  readonly projectId: string;
  readonly name: string;
  readonly description: string | null;
  readonly documentRevision: number;
  readonly engineeringRevision: number;
  readonly updatedAt: string;
  readonly designCheck: {
    readonly verdict: 'VALID' | 'WARNING' | 'ERROR';
    readonly current: boolean;
  } | null;
}

export interface ProjectListResponse {
  readonly items: readonly ProjectSummary[];
}

export interface ProjectResponse {
  readonly document: ProjectFileV1;
  readonly saved: boolean;
}

export interface CreateProjectRequest {
  readonly name: string;
  readonly description?: string;
}

export interface SaveProjectRequest {
  readonly expectedDocumentRevision: number;
  readonly document: ProjectFileV1;
}

export interface RenameProjectRequest {
  readonly expectedDocumentRevision: number;
  readonly name: string;
}

export interface ImportProjectRequest {
  readonly contentBase64: string;
}

export interface ProjectExportResponse {
  readonly filename: string;
  readonly content: string;
}

export interface DeleteProjectResponse {
  readonly deleted: true;
}
