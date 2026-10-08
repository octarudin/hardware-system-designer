import { describe, expect, it } from 'vitest';

import type {
  AuthenticatedUser,
  ComponentDraft,
  ComponentListResponse,
  ComponentReviewQueueResponse,
} from '@hwsd/shared';

import type { ApplicationError } from '../errors.js';
import { ComponentService } from './component-service.js';
import type { ComponentRepository, Publication, StoredComponentRevision } from './types.js';

const engineer: AuthenticatedUser = {
  userId: 'USR-ENGINEER',
  email: 'engineer@example.com',
  displayName: 'Engineer',
  role: 'USER',
};
const admin: AuthenticatedUser = { ...engineer, userId: 'USR-ADMIN', role: 'ADMIN' };

function draft(): ComponentDraft {
  return {
    identity: { name: 'Environmental controller', manufacturer: 'Acme', part_number: 'EC-1' },
    classification: { category: 'MICROCONTROLLER', abstraction: 'BOARD' },
    provenance: { datasheets: [], field_evidence: [] },
    pins: [],
    ports: [],
    resources: [],
    address_capabilities: [],
    notes: [],
    revision_notes: 'Initial manual definition',
  };
}

class MemoryComponentRepository implements ComponentRepository {
  public readonly revisions: StoredComponentRevision[] = [];
  public readonly publications: Publication[] = [];

  public async list(): Promise<ComponentListResponse> {
    return { items: [], page: 1, pageSize: 24, total: 0 };
  }
  public async listReviewQueue(): Promise<ComponentReviewQueueResponse> {
    return { items: [] };
  }
  public async getRevision(componentId: string, revision: number) {
    return (
      this.revisions.find(
        (stored) =>
          stored.definition.component_id === componentId && stored.definition.revision === revision,
      ) ?? null
    );
  }
  public async getLatest(componentId: string) {
    return (
      this.revisions
        .filter((stored) => stored.definition.component_id === componentId)
        .sort((left, right) => right.definition.revision - left.definition.revision)[0] ?? null
    );
  }
  public async publish(publication: Publication) {
    this.publications.push(publication);
    const value = {
      definition: publication.definition,
      createdBy: publication.actorUserId,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    this.revisions.push(value);
    return value;
  }
}

function setup() {
  const repository = new MemoryComponentRepository();
  const service = new ComponentService(
    repository,
    { now: () => new Date('2026-02-01T00:00:00.000Z') },
    { componentId: () => 'CMP-TEST' },
  );
  return { repository, service };
}

describe('component authoring and review service', () => {
  it('publishes a manual submission with server-owned identity and lifecycle fields', async () => {
    const { repository, service } = setup();

    const created = await service.create(engineer, draft());

    expect(created.definition).toMatchObject({
      schema_version: 'hwsd.component/1',
      component_id: 'CMP-TEST',
      revision: 1,
      lifecycle: { status: 'PENDING_ADMIN_VERIFICATION' },
      provenance: { origin: 'MANUAL' },
    });
    expect(repository.publications[0]).toMatchObject({
      createComponent: true,
      expectedLatestRevision: 0,
      reviewAction: 'SUBMITTED',
    });
  });

  it('rejects semantic errors before the transaction starts', async () => {
    const { repository, service } = setup();
    const invalid = {
      ...draft(),
      ports: [
        {
          port_id: 'PORT-1',
          name: 'Invalid',
          requirement: 'OPTIONAL' as const,
          direction: 'INPUT' as const,
          interface: { type: 'GPIO_INPUT' as const, bus_mode: 'NOT_APPLICABLE' as const },
          bindings: [{ pin_id: 'PIN-MISSING' }],
        },
      ],
    };

    await expect(service.create(engineer, invalid)).rejects.toMatchObject({
      statusCode: 422,
      code: 'COMPONENT_SEMANTICS_INVALID',
    } satisfies Partial<ApplicationError>);
    expect(repository.publications).toHaveLength(0);
  });

  it('creates a new immutable VERIFIED revision when an admin approves', async () => {
    const { repository, service } = setup();
    await service.create(engineer, draft());

    const approved = await service.review(admin, 'CMP-TEST', 1, 'APPROVE', 'Evidence checked');

    expect(approved.definition.revision).toBe(2);
    expect(approved.definition.lifecycle).toEqual({
      status: 'VERIFIED',
      verified_by: 'USR-ADMIN',
      verified_at: '2026-02-01T00:00:00.000Z',
    });
    expect(repository.publications[1]).toMatchObject({ reviewAction: 'APPROVED' });
  });

  it('prevents a non-admin from taking a review action', async () => {
    const { service } = setup();
    await service.create(engineer, draft());

    await expect(
      service.review(engineer, 'CMP-TEST', 1, 'APPROVE', 'Should fail'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_FORBIDDEN' });
  });
});
