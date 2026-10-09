import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import type {
  AuthenticatedUser,
  ComponentSchemaV1,
  ProjectFileV1,
  ProjectSummary,
} from '@hwsd/shared';

import type { ApplicationError } from '../errors.js';
import { ProjectService } from './project-service.js';
import { parseStrictJson } from './strict-json.js';
import type { ComponentRevisionProvider, ProjectRepository, StoredProject } from './types.js';

const owner: AuthenticatedUser = {
  userId: 'USR-OWNER',
  email: 'owner@example.com',
  displayName: 'Owner',
  role: 'USER',
};
const stranger: AuthenticatedUser = {
  ...owner,
  userId: 'USR-STRANGER',
  email: 'stranger@example.com',
};

class MemoryProjectRepository implements ProjectRepository {
  public projects = new Map<string, StoredProject>();
  public audits: string[] = [];
  public designChecks: string[] = [];
  public async list(ownerUserId: string): Promise<readonly ProjectSummary[]> {
    return [...this.projects.values()]
      .filter((project) => project.ownerUserId === ownerUserId)
      .map(({ document }) => ({
        projectId: document.project_id,
        name: document.metadata.name,
        description: document.metadata.description ?? null,
        documentRevision: document.document_revision,
        engineeringRevision: document.engineering_revision,
        updatedAt: document.metadata.updated_at,
        designCheck: null,
      }));
  }
  public async get(projectId: string, requesterUserId: string, isAdmin: boolean) {
    const project = this.projects.get(projectId);
    return project && (project.ownerUserId === requesterUserId || isAdmin) ? project : null;
  }
  public async create(
    document: ProjectFileV1,
    actor: string,
    action: 'PROJECT_CREATED' | 'PROJECT_IMPORTED',
  ) {
    const stored = { document, ownerUserId: document.metadata.owner_user_id };
    this.projects.set(document.project_id, stored);
    this.audits.push(`${actor}:${action}`);
    return stored;
  }
  public async save(
    document: ProjectFileV1,
    ownerUserId: string,
    actor: string,
    expectedRevision: number,
    designCheck?: { readonly id: string },
  ) {
    const current = this.projects.get(document.project_id);
    if (!current || current.document.document_revision !== expectedRevision)
      throw Object.assign(new Error('conflict'), { code: '40001' });
    const stored = { document, ownerUserId };
    this.projects.set(document.project_id, stored);
    this.audits.push(`${actor}:PROJECT_SAVED`);
    if (designCheck) this.designChecks.push(designCheck.id);
    return stored;
  }
  public async softDelete(projectId: string): Promise<boolean> {
    return this.projects.delete(projectId);
  }
}

function setup(components?: ComponentRevisionProvider) {
  const repository = new MemoryProjectRepository();
  let sequence = 0;
  const service = new ProjectService(
    repository,
    { now: () => new Date(`2026-10-08T00:00:0${sequence++}.000Z`) },
    { projectId: () => `PROJ-TEST-${sequence}` },
    components,
  );
  return { repository, service };
}

describe('project lifecycle service', () => {
  it('creates a canonical empty project with three-second autosave', async () => {
    const { repository, service } = setup();
    const created = await service.create(owner, ' Controller design ');
    expect(created.document).toMatchObject({
      document_revision: 1,
      engineering_revision: 1,
      metadata: { name: 'Controller design', owner_user_id: 'USR-OWNER' },
      settings: { autosave: { enabled: true, interval_ms: 3000 } },
    });
    expect(repository.audits).toEqual(['USR-OWNER:PROJECT_CREATED']);
  });

  it('suppresses no-op saves and increments only the appropriate revisions', async () => {
    const { repository, service } = setup();
    const created = await service.create(owner, 'Revision rules');
    const noOp = await service.save(owner, created.document.project_id, 1, created.document);
    expect(noOp.saved).toBe(false);
    const renamed = await service.rename(owner, created.document.project_id, 1, 'Renamed');
    expect(renamed.document).toMatchObject({ document_revision: 2, engineering_revision: 1 });
    const engineeringEdit = {
      ...renamed.document,
      component_instances: [
        {
          instance_id: 'INST-1',
          layout: { x: 0, y: 0 },
          component_snapshot: {
            schema_version: 'hwsd.component/1',
            component_id: 'CMP-X',
            revision: 1,
            identity: { name: 'X' },
            classification: { category: 'CUSTOM_COMPONENT', abstraction: 'CUSTOM' },
            lifecycle: { status: 'REVIEW_REQUIRED' },
            provenance: { origin: 'MANUAL', datasheets: [], field_evidence: [] },
            pins: [],
            ports: [],
            resources: [],
            address_capabilities: [],
            notes: [],
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            revision_notes: 'fixture',
          },
        },
      ],
    } as ProjectFileV1;
    const saved = await service.save(owner, renamed.document.project_id, 2, engineeringEdit);
    expect(saved.document).toMatchObject({ document_revision: 3, engineering_revision: 2 });
    expect(repository.audits).toHaveLength(3);
  });

  it('returns an explicit conflict for stale writes', async () => {
    const { service } = setup();
    const created = await service.create(owner, 'Conflict');
    await expect(
      service.save(owner, created.document.project_id, 0, created.document),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_SAVE_CONFLICT',
    } satisfies Partial<ApplicationError>);
  });

  it('previews invalid connections without mutating the project', async () => {
    const { repository, service } = setup();
    const created = await service.create(owner, 'Connection preview');
    const result = await service.previewConnection(owner, created.document.project_id, 1, {
      connection_id: 'CONN-TEST',
      topology: 'POINT_TO_POINT',
      endpoints: [
        {
          endpoint_id: 'ENDP-A',
          component_instance_id: 'INST-A',
          port_id: 'PORT-A',
          selected_mapping_ids: [],
          address_selections: [],
        },
        {
          endpoint_id: 'ENDP-B',
          component_instance_id: 'INST-B',
          port_id: 'PORT-B',
          selected_mapping_ids: [],
          address_selections: [],
        },
      ],
      visual: { routing: 'AUTO', waypoints: [] },
    });
    expect(result.result).toMatchObject({
      mode: 'CONNECTION_PREVIEW',
      verdict: 'ERROR',
      allowed: false,
    });
    expect(repository.projects.get(created.document.project_id)?.document.document_revision).toBe(
      1,
    );
  });

  it('persists a versioned Design Check and append-only run marker', async () => {
    const { repository, service } = setup();
    const created = await service.create(owner, 'Checked project');
    const checked = await service.runDesignCheck(owner, created.document.project_id, 1);
    expect(checked.document).toMatchObject({
      document_revision: 2,
      engineering_revision: 1,
      last_design_check: { evaluated_engineering_revision: 1 },
    });
    expect(checked.result.mode).toBe('DESIGN_CHECK');
    expect(repository.designChecks[0]).toMatch(/^CHECK-/u);
  });

  it('adds immutable snapshots and atomically commits a mapped shared bus', async () => {
    const controller = JSON.parse(
      readFileSync(
        new URL(
          '../../../tests/fixtures/contracts/v1/valid/component-representative.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as ComponentSchemaV1;
    const target = {
      ...controller,
      component_id: 'CMP-TARGET',
      identity: { name: 'I2C target' },
      classification: { category: 'SENSOR', abstraction: 'MODULE' },
      ports: controller.ports.map((port) => ({
        ...port,
        interface: { ...port.interface, bus_role: 'TARGET' as const },
      })),
    } satisfies ComponentSchemaV1;
    const targetV2 = {
      ...target,
      revision: 2,
      lifecycle: {
        status: 'VERIFIED' as const,
        verified_by: 'USR-ADMIN',
        verified_at: '2026-01-03T00:00:00.000Z',
      },
      revision_notes: 'Verified target revision',
    } satisfies ComponentSchemaV1;
    const provider: ComponentRevisionProvider = {
      getRevision: async (componentId, revision) => {
        const definition =
          componentId === controller.component_id
            ? controller
            : componentId === target.component_id
              ? revision === 2
                ? targetV2
                : target
              : undefined;
        return definition?.revision === revision ? { definition } : null;
      },
      getLatest: async (componentId) => {
        const definition =
          componentId === controller.component_id
            ? controller
            : componentId === target.component_id
              ? targetV2
              : undefined;
        return definition ? { definition } : null;
      },
    };
    const { service } = setup(provider);
    const created = await service.create(owner, 'I2C design');
    const withController = await service.addComponent(
      owner,
      created.document.project_id,
      1,
      controller.component_id,
      1,
      { x: 0, y: 0 },
    );
    const withTarget = await service.addComponent(
      owner,
      created.document.project_id,
      2,
      target.component_id,
      1,
      { x: 320, y: 0 },
    );
    const [controllerInstance, targetInstance] = withTarget.document.component_instances;
    const connection: ProjectFileV1['connections'][number] = {
      connection_id: 'CONN-I2C',
      topology: 'SHARED_BUS' as const,
      endpoints: [
        {
          endpoint_id: 'ENDP-CONTROLLER',
          component_instance_id: controllerInstance!.instance_id,
          port_id: 'PORT-I2C',
          selected_mapping_ids: ['MAP-I2C1'],
          address_selections: [],
        },
        {
          endpoint_id: 'ENDP-TARGET',
          component_instance_id: targetInstance!.instance_id,
          port_id: 'PORT-I2C',
          selected_mapping_ids: ['MAP-I2C1'],
          address_selections: [{ address_id: 'ADDR-I2C', value: 32 }],
        },
      ],
      visual: { routing: 'AUTO' as const, waypoints: [] },
    };
    const preview = await service.previewConnection(
      owner,
      created.document.project_id,
      3,
      connection,
    );
    expect(preview.result).toMatchObject({
      allowed: true,
      verdict: 'WARNING',
      requires_confirmation: true,
    });
    await expect(
      service.commitConnection(owner, created.document.project_id, 3, connection),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONNECTION_WARNING_CONFIRMATION_REQUIRED',
    });
    const committed = await service.commitConnection(
      owner,
      created.document.project_id,
      3,
      connection,
      preview.result.findings
        .filter(({ severity }) => severity === 'WARNING')
        .map(({ fingerprint }) => ({ fingerprint, note: 'Reviewed in test.' })),
    );
    expect(committed.document).toMatchObject({
      document_revision: 4,
      engineering_revision: 4,
    });
    expect(committed.document.connections).toHaveLength(1);
    expect(committed.document.warning_overrides).not.toHaveLength(0);
    expect(new Set(committed.document.allocations.map(({ endpoint_id }) => endpoint_id))).toEqual(
      new Set(['ENDP-CONTROLLER', 'ENDP-TARGET']),
    );
    expect(withController.document.component_instances[0]?.component_snapshot).toEqual(controller);

    const update = await service.previewComponentUpdate(
      owner,
      created.document.project_id,
      targetInstance!.instance_id,
      4,
    );
    expect(update).toMatchObject({
      currentRevision: 1,
      targetRevision: 2,
      affectedConnectionIds: ['CONN-I2C'],
    });
    const updated = await service.applyComponentUpdate(
      owner,
      created.document.project_id,
      targetInstance!.instance_id,
      4,
      2,
      update.result.findings
        .filter(({ severity }) => severity === 'WARNING')
        .map(({ fingerprint }) => ({ fingerprint })),
    );
    expect(updated.document).toMatchObject({ document_revision: 5, engineering_revision: 5 });
    expect(
      updated.document.component_instances.find(
        ({ instance_id }) => instance_id === targetInstance!.instance_id,
      )?.component_snapshot.revision,
    ).toBe(2);
  });

  it("does not disclose another user's project", async () => {
    const { service } = setup();
    const created = await service.create(owner, 'Private project');

    await expect(service.get(stranger, created.document.project_id)).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('round-trips export through Create Copy while replacing identity', async () => {
    const { service } = setup();
    const created = await service.create(owner, 'Portable project');
    const exported = await service.export(owner, created.document.project_id);
    const imported = await service.importCopy(
      owner,
      Buffer.from(exported.content, 'utf8').toString('base64'),
    );
    expect(exported.filename).toBe('Portable-project.txt');
    expect(imported.document.project_id).not.toBe(created.document.project_id);
    expect(imported.document).toMatchObject({
      document_revision: 1,
      engineering_revision: 1,
      component_instances: [],
      connections: [],
    });
  });
});

describe('strict project JSON parser', () => {
  it('rejects duplicate keys and excessive nesting', () => {
    expect(() => parseStrictJson('{"name":"first","name":"second"}')).toThrowError(/valid JSON/u);
    expect(() => parseStrictJson(`${'['.repeat(102)}0${']'.repeat(102)}`)).toThrowError(
      /valid JSON/u,
    );
  });

  it('rejects an unsupported project schema version before persistence', async () => {
    const { service } = setup();
    const content = Buffer.from('{"schema_version":"hwsd.project/2"}', 'utf8').toString('base64');

    await expect(service.importCopy(owner, content)).rejects.toMatchObject({
      statusCode: 422,
      code: 'PROJECT_SCHEMA_VERSION_UNSUPPORTED',
    });
  });
});
