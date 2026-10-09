import { randomBytes } from 'node:crypto';

import {
  type AuthenticatedUser,
  type ComponentDraft,
  type ComponentListQuery,
  type ComponentReviewAction,
  type ComponentSchemaV1,
  validateComponentSchema,
  validateComponentSemantics,
} from '@hwsd/shared';

import { requireAdmin, requireOwner } from '../auth/authorization.js';
import { ApplicationError } from '../errors.js';
import type { Clock, ComponentRepository, IdGenerator, Publication } from './types.js';

const systemClock: Clock = { now: () => new Date() };
const randomIds: IdGenerator = {
  componentId: () => `CMP-${randomBytes(12).toString('hex').toUpperCase()}`,
};

function validationError(definition: unknown): ComponentSchemaV1 {
  const schema = validateComponentSchema(definition);
  if (!schema.valid) {
    throw new ApplicationError(
      422,
      'COMPONENT_SCHEMA_INVALID',
      'The component definition does not satisfy Component Schema V1.',
      schema.issues.map(({ code, path, message }) => ({ code, path, message })),
    );
  }
  const semantics = validateComponentSemantics(schema.value);
  if (!semantics.valid) {
    throw new ApplicationError(
      422,
      'COMPONENT_SEMANTICS_INVALID',
      'The component definition contains invalid references or engineering values.',
      semantics.issues,
    );
  }
  return schema.value;
}

export class ComponentService {
  public constructor(
    private readonly repository: ComponentRepository,
    private readonly clock: Clock = systemClock,
    private readonly ids: IdGenerator = randomIds,
  ) {}

  public list(query: ComponentListQuery) {
    return this.repository.list({
      ...query,
      sort: query.sort ?? 'name',
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 24,
    });
  }

  public listReviewQueue(user: AuthenticatedUser) {
    requireAdmin(user);
    return this.repository.listReviewQueue();
  }

  public async getRevision(componentId: string, revision: number) {
    const stored = await this.repository.getRevision(componentId, revision);
    if (!stored)
      throw new ApplicationError(
        404,
        'COMPONENT_NOT_FOUND',
        'The component revision was not found.',
      );
    return {
      definition: stored.definition,
      createdBy: stored.createdBy,
      createdAt: stored.createdAt.toISOString(),
    };
  }

  public async create(user: AuthenticatedUser, draft: ComponentDraft) {
    const now = this.clock.now().toISOString();
    const definition = this.buildDefinition(draft, {
      componentId: this.ids.componentId(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lifecycle: { status: 'PENDING_ADMIN_VERIFICATION' },
      origin: 'MANUAL',
    });
    return this.publish({
      definition,
      actorUserId: user.userId,
      expectedLatestRevision: 0,
      createComponent: true,
      reviewAction: 'SUBMITTED',
    });
  }

  public async createFromCandidate(
    user: AuthenticatedUser,
    candidateId: string,
    draft: ComponentDraft,
    extractionModel: string,
  ) {
    const now = this.clock.now().toISOString();
    const definition = this.buildDefinition(draft, {
      componentId: this.ids.componentId(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lifecycle: { status: 'PENDING_ADMIN_VERIFICATION' },
      origin: 'AI_DATASHEET_EXTRACTION',
      extractedAt: now,
      extractionModel,
    });
    return this.publish({
      definition,
      actorUserId: user.userId,
      expectedLatestRevision: 0,
      createComponent: true,
      reviewAction: 'SUBMITTED',
      sourceCandidateId: candidateId,
    });
  }

  public async revise(user: AuthenticatedUser, componentId: string, draft: ComponentDraft) {
    const latest = await this.requireLatest(componentId);
    requireOwner(user, latest.createdBy);
    if (latest.definition.lifecycle.status === 'DISABLED') {
      throw new ApplicationError(
        409,
        'COMPONENT_DISABLED',
        'A disabled component cannot be revised.',
      );
    }
    const definition = this.buildDefinition(draft, {
      componentId,
      revision: latest.definition.revision + 1,
      createdAt: latest.definition.created_at,
      updatedAt: this.clock.now().toISOString(),
      lifecycle: { status: 'PENDING_ADMIN_VERIFICATION' },
      origin: 'MANUAL',
    });
    return this.publish({
      definition,
      actorUserId: user.userId,
      expectedLatestRevision: latest.definition.revision,
      createComponent: false,
      reviewAction: 'SUBMITTED',
    });
  }

  public async review(
    user: AuthenticatedUser,
    componentId: string,
    reviewedRevision: number,
    action: ComponentReviewAction,
    note: string,
  ) {
    requireAdmin(user);
    const latest = await this.requireLatest(componentId);
    if (latest.definition.revision !== reviewedRevision) {
      throw new ApplicationError(
        409,
        'COMPONENT_REVISION_STALE',
        'The review target is no longer the latest component revision.',
      );
    }
    const normalizedNote = note.trim();
    if (!normalizedNote) {
      throw new ApplicationError(400, 'REVIEW_NOTE_REQUIRED', 'A review note is required.');
    }

    const now = this.clock.now().toISOString();
    const lifecycle = this.reviewLifecycle(action, user.userId, now, normalizedNote);
    const definition = validationError({
      ...latest.definition,
      revision: reviewedRevision + 1,
      lifecycle,
      updated_at: now,
      revision_notes: normalizedNote,
    });
    const actions = {
      APPROVE: 'APPROVED',
      REQUEST_REVISION: 'REQUESTED_REVISION',
      REJECT: 'REJECTED',
      DEPRECATE: 'DEPRECATED',
      DISABLE: 'DISABLED',
    } as const;
    return this.publish({
      definition,
      actorUserId: user.userId,
      expectedLatestRevision: reviewedRevision,
      createComponent: false,
      reviewAction: actions[action],
      reviewNote: normalizedNote,
    });
  }

  private async requireLatest(componentId: string) {
    const latest = await this.repository.getLatest(componentId);
    if (!latest)
      throw new ApplicationError(404, 'COMPONENT_NOT_FOUND', 'The component was not found.');
    return latest;
  }

  private buildDefinition(
    draft: ComponentDraft,
    trusted: {
      componentId: string;
      revision: number;
      createdAt: string;
      updatedAt: string;
      lifecycle: ComponentSchemaV1['lifecycle'];
      origin: ComponentSchemaV1['provenance']['origin'];
      extractedAt?: string;
      extractionModel?: string;
    },
  ): ComponentSchemaV1 {
    return validationError({
      ...draft,
      schema_version: 'hwsd.component/1',
      component_id: trusted.componentId,
      revision: trusted.revision,
      lifecycle: trusted.lifecycle,
      provenance: {
        ...draft.provenance,
        origin: trusted.origin,
        ...(trusted.extractedAt ? { extracted_at: trusted.extractedAt } : {}),
        ...(trusted.extractionModel ? { extraction_model: trusted.extractionModel } : {}),
      },
      created_at: trusted.createdAt,
      updated_at: trusted.updatedAt,
    });
  }

  private reviewLifecycle(
    action: ComponentReviewAction,
    actor: string,
    now: string,
    reason: string,
  ): ComponentSchemaV1['lifecycle'] {
    if (action === 'APPROVE') return { status: 'VERIFIED', verified_by: actor, verified_at: now };
    if (action === 'DEPRECATE') return { status: 'DEPRECATED', status_reason: reason };
    if (action === 'DISABLE' || action === 'REJECT')
      return { status: 'DISABLED', status_reason: reason };
    return { status: 'REVIEW_REQUIRED', status_reason: reason };
  }

  private async publish(publication: Publication) {
    const stored = await this.repository.publish(publication);
    return {
      definition: stored.definition,
      createdBy: stored.createdBy,
      createdAt: stored.createdAt.toISOString(),
    };
  }
}
