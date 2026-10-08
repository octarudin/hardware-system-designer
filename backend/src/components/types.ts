import type {
  ComponentListQuery,
  ComponentListResponse,
  ComponentReviewQueueResponse,
  ComponentSchemaV1,
} from '@hwsd/shared';

export interface StoredComponentRevision {
  readonly definition: ComponentSchemaV1;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export type PersistedReviewAction =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CORRECTED'
  | 'REQUESTED_REVISION'
  | 'DEPRECATED'
  | 'DISABLED';

export interface Publication {
  readonly definition: ComponentSchemaV1;
  readonly actorUserId: string;
  readonly expectedLatestRevision: number;
  readonly createComponent: boolean;
  readonly reviewAction: PersistedReviewAction;
  readonly reviewNote?: string;
}

export interface ComponentRepository {
  list(
    query: Required<Pick<ComponentListQuery, 'page' | 'pageSize' | 'sort'>> & ComponentListQuery,
  ): Promise<ComponentListResponse>;
  listReviewQueue(): Promise<ComponentReviewQueueResponse>;
  getRevision(componentId: string, revision: number): Promise<StoredComponentRevision | null>;
  getLatest(componentId: string): Promise<StoredComponentRevision | null>;
  publish(publication: Publication): Promise<StoredComponentRevision>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  componentId(): string;
}
