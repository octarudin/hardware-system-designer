import type { ProjectFileV1, ProjectSummary } from '@hwsd/shared';

export interface StoredProject {
  readonly document: ProjectFileV1;
  readonly ownerUserId: string;
}

export interface ProjectRepository {
  list(ownerUserId: string, search?: string): Promise<readonly ProjectSummary[]>;
  get(projectId: string, requesterUserId: string, isAdmin: boolean): Promise<StoredProject | null>;
  create(
    document: ProjectFileV1,
    actorUserId: string,
    action: 'PROJECT_CREATED' | 'PROJECT_IMPORTED',
  ): Promise<StoredProject>;
  save(
    document: ProjectFileV1,
    ownerUserId: string,
    actorUserId: string,
    expectedRevision: number,
  ): Promise<StoredProject>;
  softDelete(projectId: string, ownerUserId: string, actorUserId: string): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}
export interface IdGenerator {
  projectId(): string;
}
