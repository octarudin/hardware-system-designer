import type { HardwareSystemDesignerComponentSchemaV1 as ComponentSchemaV1 } from '../generated/component-schema-v1.js';

export type ComponentLifecycleStatus = ComponentSchemaV1['lifecycle']['status'];
export type ComponentCategory = ComponentSchemaV1['classification']['category'];
export type ComponentAbstraction = ComponentSchemaV1['classification']['abstraction'];

export type ComponentDraft = Omit<
  ComponentSchemaV1,
  | 'schema_version'
  | 'component_id'
  | 'revision'
  | 'lifecycle'
  | 'provenance'
  | 'created_at'
  | 'updated_at'
> & {
  readonly provenance: Omit<
    ComponentSchemaV1['provenance'],
    'origin' | 'extracted_at' | 'extraction_model'
  >;
};

export interface PublishComponentRequest {
  readonly definition: ComponentDraft;
}

export interface ComponentListQuery {
  readonly q?: string;
  readonly category?: ComponentCategory;
  readonly abstraction?: ComponentAbstraction;
  readonly status?: ComponentLifecycleStatus;
  readonly manufacturer?: string;
  readonly sort?: 'name' | 'updated';
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ComponentListItem {
  readonly componentId: string;
  readonly name: string;
  readonly manufacturer: string | null;
  readonly partNumber: string | null;
  readonly category: ComponentCategory;
  readonly abstraction: ComponentAbstraction;
  readonly lifecycleStatus: ComponentLifecycleStatus;
  readonly latestRevision: number;
  readonly hasDatasheet: boolean;
  readonly updatedAt: string;
}

export interface ComponentListResponse {
  readonly items: readonly ComponentListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface ComponentRevisionResponse {
  readonly definition: ComponentSchemaV1;
  readonly createdBy: string;
  readonly createdAt: string;
}

export type ComponentReviewAction =
  'APPROVE' | 'REQUEST_REVISION' | 'REJECT' | 'DEPRECATE' | 'DISABLE';

export interface ReviewComponentRequest {
  readonly action: ComponentReviewAction;
  readonly note: string;
}

export interface ComponentReviewQueueItem extends ComponentListItem {
  readonly submittedBy: string;
  readonly submittedAt: string;
}

export interface ComponentReviewQueueResponse {
  readonly items: readonly ComponentReviewQueueItem[];
}
