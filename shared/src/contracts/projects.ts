import type { HardwareSystemDesignerConnectionRuleResultV1 as ConnectionRuleResultV1 } from '../generated/connection-rule-result-v1.js';
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

export interface AddProjectComponentRequest {
  readonly expectedDocumentRevision: number;
  readonly componentId: string;
  readonly revision: number;
  readonly layout: { readonly x: number; readonly y: number };
}

export interface PreviewConnectionRequest {
  readonly expectedDocumentRevision: number;
  readonly connection: ProjectFileV1['connections'][number];
}

export interface ConnectionEvaluationResponse {
  readonly result: ConnectionRuleResultV1;
}

export interface CommitConnectionRequest extends PreviewConnectionRequest {
  readonly confirmedWarnings?: readonly {
    readonly fingerprint: string;
    readonly note?: string;
  }[];
}

export interface ConnectionCommitResponse extends ProjectResponse {
  readonly result: ConnectionRuleResultV1;
}

export interface RunDesignCheckRequest {
  readonly expectedDocumentRevision: number;
}

export interface DesignCheckResponse extends ProjectResponse {
  readonly result: ConnectionRuleResultV1 & { readonly mode: 'DESIGN_CHECK' };
}

export interface PreviewComponentUpdateRequest {
  readonly expectedDocumentRevision: number;
  readonly targetRevision?: number;
}

export interface ComponentUpdatePreviewResponse {
  readonly instanceId: string;
  readonly componentId: string;
  readonly currentRevision: number;
  readonly targetRevision: number;
  readonly affectedConnectionIds: readonly string[];
  readonly result: ConnectionRuleResultV1 & { readonly mode: 'DESIGN_CHECK' };
}

export interface ApplyComponentUpdateRequest extends PreviewComponentUpdateRequest {
  readonly confirmedWarnings?: readonly { readonly fingerprint: string; readonly note?: string }[];
}
