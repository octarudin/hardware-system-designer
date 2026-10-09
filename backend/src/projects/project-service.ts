import { randomBytes } from 'node:crypto';

import {
  type AuthenticatedUser,
  type ConnectionRuleResultV1,
  type ProjectFileV1,
  validateProjectFileSchema,
  validateProjectSemantics,
} from '@hwsd/shared';
import { evaluate } from '@hwsd/rule-engine';

import { ApplicationError } from '../errors.js';
import { parseStrictJson } from './strict-json.js';
import type {
  Clock,
  ComponentRevisionProvider,
  IdGenerator,
  ProjectRepository,
  StoredProject,
} from './types.js';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const systemClock: Clock = { now: () => new Date() };
const randomIds: IdGenerator = {
  projectId: () => `PROJ-${randomBytes(12).toString('hex').toUpperCase()}`,
};
const randomId = (prefix: string) => `${prefix}-${randomBytes(12).toString('hex').toUpperCase()}`;
type Connection = ProjectFileV1['connections'][number];

function endpointForAllocation(
  project: ProjectFileV1,
  connection: Connection,
  effect: ConnectionRuleResultV1['allocation_effects'][number],
) {
  const candidates = connection.endpoints.filter(
    ({ component_instance_id }) => component_instance_id === effect.component_instance_id,
  );
  const matching = candidates.filter((candidate) => {
    const instance = project.component_instances.find(
      ({ instance_id }) => instance_id === candidate.component_instance_id,
    );
    const port = instance?.component_snapshot.ports.find(
      ({ port_id }) => port_id === candidate.port_id,
    );
    const directlyBound = port?.bindings.some((binding) => {
      if (effect.resource_kind === 'PIN') return binding.pin_id === effect.resource_id;
      if (effect.resource_kind === 'FUNCTION') return binding.function_id === effect.resource_id;
      if (effect.resource_kind === 'CHANNEL')
        return binding.resource_id === effect.resource_id && binding.channel === effect.channel;
      return binding.resource_id === effect.resource_id;
    });
    if (directlyBound) return true;
    return candidate.selected_mapping_ids.some((mappingId) =>
      instance?.component_snapshot.resources.some((resource) =>
        resource.compatible_pin_mappings.some(
          (mapping) =>
            mapping.mapping_id === mappingId &&
            mapping.assignments.some((assignment) =>
              effect.resource_kind === 'PIN'
                ? assignment.pin_id === effect.resource_id
                : effect.resource_kind === 'FUNCTION' &&
                  assignment.function_id === effect.resource_id,
            ),
        ),
      ),
    );
  });
  if (matching.length === 1) return matching[0];
  if (matching.length === 0 && candidates.length === 1) return candidates[0];
  return undefined;
}

function validateConnectionShape(project: ProjectFileV1, connection: Connection): Connection {
  const candidate = {
    ...project,
    connections: [
      ...project.connections.filter(
        ({ connection_id }) => connection_id !== connection.connection_id,
      ),
      connection,
    ],
  };
  const schema = validateProjectFileSchema(candidate);
  if (!schema.valid)
    throw new ApplicationError(
      422,
      'CONNECTION_SCHEMA_INVALID',
      'The connection does not satisfy Project File Schema V1.',
      schema.issues.map(({ code, path, message }) => ({ code, path, message })),
    );
  return schema.value.connections.find(
    ({ connection_id }) => connection_id === connection.connection_id,
  )!;
}

function validateProject(value: unknown): ProjectFileV1 {
  const schema = validateProjectFileSchema(value);
  if (!schema.valid) {
    throw new ApplicationError(
      422,
      'PROJECT_SCHEMA_INVALID',
      'The project does not satisfy Project File Schema V1.',
      schema.issues.map(({ code, path, message }) => ({ code, path, message })),
    );
  }
  const semantics = validateProjectSemantics(schema.value);
  if (!semantics.valid) {
    throw new ApplicationError(
      422,
      'PROJECT_SEMANTICS_INVALID',
      'The project contains inconsistent engineering references.',
      semantics.issues,
    );
  }
  return schema.value;
}

function engineeringState(document: ProjectFileV1): unknown {
  return {
    component_instances: document.component_instances.map(
      ({ instance_id, component_snapshot }) => ({ instance_id, component_snapshot }),
    ),
    connections: document.connections,
    allocations: document.allocations,
    warning_overrides: document.warning_overrides,
  };
}

function comparable(document: ProjectFileV1): unknown {
  return {
    schema_version: document.schema_version,
    ruleset_version: document.ruleset_version,
    project_id: document.project_id,
    engineering_revision: document.engineering_revision,
    metadata: {
      name: document.metadata.name,
      description: document.metadata.description,
      owner_user_id: document.metadata.owner_user_id,
      created_at: document.metadata.created_at,
    },
    settings: {
      autosave: {
        enabled: document.settings.autosave.enabled,
        interval_ms: document.settings.autosave.interval_ms,
      },
    },
    canvas: document.canvas,
    component_instances: document.component_instances,
    connections: document.connections,
    allocations: document.allocations,
    engineering_notes: document.engineering_notes,
    warning_overrides: document.warning_overrides,
    last_design_check: document.last_design_check,
  };
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class ProjectService {
  public constructor(
    private readonly repository: ProjectRepository,
    private readonly clock: Clock = systemClock,
    private readonly ids: IdGenerator = randomIds,
    private readonly components?: ComponentRevisionProvider,
  ) {}

  public async list(user: AuthenticatedUser, search?: string) {
    return { items: await this.repository.list(user.userId, search?.trim() || undefined) };
  }

  public async get(user: AuthenticatedUser, projectId: string) {
    const project = await this.requireProject(user, projectId);
    return { document: project.document, saved: true };
  }

  public async create(user: AuthenticatedUser, name: string, description?: string) {
    const normalizedName = name.trim();
    if (!normalizedName)
      throw new ApplicationError(400, 'PROJECT_NAME_REQUIRED', 'A project name is required.');
    const now = this.clock.now().toISOString();
    const document = validateProject({
      schema_version: 'hwsd.project/1',
      ruleset_version: 'hwsd.connection-rules/1',
      project_id: this.ids.projectId(),
      document_revision: 1,
      engineering_revision: 1,
      metadata: {
        name: normalizedName,
        ...(description?.trim() ? { description: description.trim() } : {}),
        owner_user_id: user.userId,
        created_at: now,
        updated_at: now,
      },
      settings: { autosave: { enabled: true, interval_ms: 3000, last_saved_at: now } },
      canvas: { viewport: { x: 0, y: 0, zoom: 1 }, grid: { size: 16, snap_to_grid: true } },
      component_instances: [],
      connections: [],
      allocations: [],
      engineering_notes: [],
      warning_overrides: [],
    });
    const stored = await this.repository.create(document, user.userId, 'PROJECT_CREATED');
    return { document: stored.document, saved: true };
  }

  public async save(
    user: AuthenticatedUser,
    projectId: string,
    expectedRevision: number,
    proposed: ProjectFileV1,
    designCheck?: {
      readonly id: string;
      readonly result: ConnectionRuleResultV1;
      readonly createdAt: string;
    },
  ) {
    const current = await this.requireProject(user, projectId);
    if (expectedRevision !== current.document.document_revision) throw this.conflict();
    const trustedCandidate = {
      ...proposed,
      project_id: projectId,
      metadata: {
        ...proposed.metadata,
        owner_user_id: current.ownerUserId,
        created_at: current.document.metadata.created_at,
      },
    };
    if (same(comparable(trustedCandidate), comparable(current.document)))
      return { document: current.document, saved: false };
    const now = this.clock.now().toISOString();
    const engineeringChanged = !same(
      engineeringState(trustedCandidate),
      engineeringState(current.document),
    );
    const document = validateProject({
      ...trustedCandidate,
      schema_version: 'hwsd.project/1',
      ruleset_version: 'hwsd.connection-rules/1',
      document_revision: expectedRevision + 1,
      engineering_revision: current.document.engineering_revision + (engineeringChanged ? 1 : 0),
      metadata: {
        ...trustedCandidate.metadata,
        owner_user_id: current.ownerUserId,
        created_at: current.document.metadata.created_at,
        updated_at: now,
      },
      settings: {
        ...trustedCandidate.settings,
        autosave: { ...trustedCandidate.settings.autosave, last_saved_at: now },
      },
    });
    try {
      const stored = await this.repository.save(
        document,
        current.ownerUserId,
        user.userId,
        expectedRevision,
        designCheck,
      );
      return { document: stored.document, saved: true };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      const pg = error as { code?: string };
      if (pg.code === '40001') throw this.conflict();
      throw error;
    }
  }

  public async addComponent(
    user: AuthenticatedUser,
    projectId: string,
    expectedRevision: number,
    componentId: string,
    revision: number,
    layout: { readonly x: number; readonly y: number },
  ) {
    const provider = this.requireComponents();
    const source = await provider.getRevision(componentId, revision);
    if (!source)
      throw new ApplicationError(
        404,
        'COMPONENT_REVISION_NOT_FOUND',
        'The component revision was not found.',
      );
    if (source.definition.lifecycle.status === 'DISABLED')
      throw new ApplicationError(
        422,
        'COMPONENT_DISABLED',
        'A disabled component revision cannot be inserted.',
      );
    const current = await this.requireProject(user, projectId);
    return this.save(user, projectId, expectedRevision, {
      ...current.document,
      component_instances: [
        ...current.document.component_instances,
        {
          instance_id: randomId('INST'),
          display_name: source.definition.identity.name,
          layout: { x: layout.x, y: layout.y },
          component_snapshot: source.definition,
        },
      ],
    });
  }

  public async previewConnection(
    user: AuthenticatedUser,
    projectId: string,
    expectedRevision: number,
    connection: Connection,
  ) {
    const current = await this.requireExpectedProject(user, projectId, expectedRevision);
    const validated = validateConnectionShape(current.document, connection);
    return {
      result: evaluate({
        project: current.document,
        mode: 'CONNECTION_PREVIEW',
        connection: validated,
      }),
    };
  }

  public async commitConnection(
    user: AuthenticatedUser,
    projectId: string,
    expectedRevision: number,
    connection: Connection,
    confirmedWarnings: readonly { readonly fingerprint: string; readonly note?: string }[] = [],
  ) {
    const current = await this.requireExpectedProject(user, projectId, expectedRevision);
    const validated = validateConnectionShape(current.document, connection);
    const result = evaluate({
      project: current.document,
      mode: 'CONNECTION_COMMIT',
      connection: validated,
      expectedDocumentRevision: expectedRevision,
    });
    if (!result.allowed)
      throw new ApplicationError(
        422,
        'CONNECTION_BLOCKED',
        'The connection is blocked by engineering rules.',
        result.findings
          .filter(({ severity }) => severity === 'ERROR')
          .map((finding) => ({
            code: finding.code,
            ...(finding.locations[0]?.path ? { path: finding.locations[0].path } : {}),
            message: finding.message,
          })),
      );
    const confirmations = new Map(
      confirmedWarnings.map((warning) => [warning.fingerprint, warning]),
    );
    const warnings = result.findings.filter(
      ({ severity, acknowledged }) => severity === 'WARNING' && !acknowledged,
    );
    if (warnings.some(({ fingerprint }) => !confirmations.has(fingerprint)))
      throw new ApplicationError(
        409,
        'CONNECTION_WARNING_CONFIRMATION_REQUIRED',
        'Every current warning must be explicitly confirmed before commit.',
        warnings.map((finding) => ({ code: finding.code, message: finding.message })),
      );
    const now = this.clock.now().toISOString();
    const withoutPrevious = current.document.allocations.filter(
      ({ connection_id }) => connection_id !== connection.connection_id,
    );
    const allocations: ProjectFileV1['allocations'] = result.allocation_effects.map((effect) => {
      const endpoint = endpointForAllocation(current.document, validated, effect);
      if (!endpoint)
        throw new ApplicationError(
          422,
          'ALLOCATION_ENDPOINT_AMBIGUOUS',
          'The selected endpoints do not identify a unique allocation target.',
        );
      return {
        allocation_id: randomId('ALLOC'),
        connection_id: validated.connection_id,
        endpoint_id: endpoint.endpoint_id,
        component_instance_id: effect.component_instance_id,
        resource_kind: effect.resource_kind,
        resource_id: effect.resource_id,
        ...(effect.channel ? { channel: effect.channel } : {}),
        allocation_mode: effect.action === 'SHARE' ? 'SHARED' : 'EXCLUSIVE',
      };
    });
    const overrides: ProjectFileV1['warning_overrides'] = warnings.map((finding) => ({
      override_id: randomId('OVERRIDE'),
      ruleset_version: 'hwsd.connection-rules/1',
      rule_id: finding.rule_id,
      code: finding.code,
      message: finding.message,
      fingerprint: finding.fingerprint,
      subject: { project_id: projectId, connection_id: connection.connection_id },
      confirmed_by: user.userId,
      confirmed_at: now,
      ...(confirmations.get(finding.fingerprint)?.note?.trim()
        ? { engineering_note: confirmations.get(finding.fingerprint)!.note!.trim() }
        : {}),
    }));
    const response = await this.save(user, projectId, expectedRevision, {
      ...current.document,
      connections: [
        ...current.document.connections.filter(
          ({ connection_id }) => connection_id !== connection.connection_id,
        ),
        validated,
      ],
      allocations: [...withoutPrevious, ...allocations],
      warning_overrides: [...current.document.warning_overrides, ...overrides],
    });
    return { ...response, result };
  }

  public async runDesignCheck(
    user: AuthenticatedUser,
    projectId: string,
    expectedRevision: number,
  ) {
    const current = await this.requireExpectedProject(user, projectId, expectedRevision);
    const result = evaluate({
      project: current.document,
      mode: 'DESIGN_CHECK',
    }) as ConnectionRuleResultV1 & {
      mode: 'DESIGN_CHECK';
    };
    const createdAt = this.clock.now().toISOString();
    const response = await this.save(
      user,
      projectId,
      expectedRevision,
      {
        ...current.document,
        last_design_check: {
          evaluated_engineering_revision: current.document.engineering_revision,
          evaluated_at: createdAt,
          result,
        },
      },
      { id: randomId('CHECK'), result, createdAt },
    );
    return { ...response, result };
  }

  public async previewComponentUpdate(
    user: AuthenticatedUser,
    projectId: string,
    instanceId: string,
    expectedRevision: number,
    targetRevision?: number,
  ) {
    const current = await this.requireExpectedProject(user, projectId, expectedRevision);
    const index = current.document.component_instances.findIndex(
      ({ instance_id }) => instance_id === instanceId,
    );
    const instance = current.document.component_instances[index];
    if (!instance)
      throw new ApplicationError(
        404,
        'COMPONENT_INSTANCE_NOT_FOUND',
        'The component instance was not found.',
      );
    const provider = this.requireComponents();
    const target = targetRevision
      ? await provider.getRevision(instance.component_snapshot.component_id, targetRevision)
      : await provider.getLatest(instance.component_snapshot.component_id);
    if (!target)
      throw new ApplicationError(
        404,
        'COMPONENT_REVISION_NOT_FOUND',
        'The target component revision was not found.',
      );
    if (target.definition.lifecycle.status === 'DISABLED')
      throw new ApplicationError(
        422,
        'COMPONENT_DISABLED',
        'A disabled component revision cannot replace the current snapshot.',
      );
    const candidate = {
      ...current.document,
      component_instances: current.document.component_instances.map((value, candidateIndex) =>
        candidateIndex === index ? { ...value, component_snapshot: target.definition } : value,
      ),
    };
    const result = evaluate({
      project: candidate,
      mode: 'DESIGN_CHECK',
    }) as ConnectionRuleResultV1 & { mode: 'DESIGN_CHECK' };
    return {
      instanceId,
      componentId: instance.component_snapshot.component_id,
      currentRevision: instance.component_snapshot.revision,
      targetRevision: target.definition.revision,
      affectedConnectionIds: current.document.connections
        .filter(({ endpoints }) =>
          endpoints.some(({ component_instance_id }) => component_instance_id === instanceId),
        )
        .map(({ connection_id }) => connection_id),
      result,
    };
  }

  public async applyComponentUpdate(
    user: AuthenticatedUser,
    projectId: string,
    instanceId: string,
    expectedRevision: number,
    targetRevision?: number,
    confirmedWarnings: readonly { readonly fingerprint: string; readonly note?: string }[] = [],
  ) {
    const preview = await this.previewComponentUpdate(
      user,
      projectId,
      instanceId,
      expectedRevision,
      targetRevision,
    );
    if (!preview.result.allowed)
      throw new ApplicationError(
        422,
        'COMPONENT_UPDATE_BLOCKED',
        'The component update would invalidate the design.',
      );
    const warnings = preview.result.findings.filter(
      ({ severity, acknowledged }) => severity === 'WARNING' && !acknowledged,
    );
    const confirmed = new Map(
      confirmedWarnings.map((confirmation) => [confirmation.fingerprint, confirmation]),
    );
    if (warnings.some(({ fingerprint }) => !confirmed.has(fingerprint)))
      throw new ApplicationError(
        409,
        'COMPONENT_UPDATE_WARNING_CONFIRMATION_REQUIRED',
        'Update warnings require confirmation.',
      );
    const current = await this.requireExpectedProject(user, projectId, expectedRevision);
    const target = await this.requireComponents().getRevision(
      preview.componentId,
      preview.targetRevision,
    );
    if (!target)
      throw new ApplicationError(
        404,
        'COMPONENT_REVISION_NOT_FOUND',
        'The target component revision was not found.',
      );
    const now = this.clock.now().toISOString();
    return this.save(user, projectId, expectedRevision, {
      ...current.document,
      component_instances: current.document.component_instances.map((instance) =>
        instance.instance_id === instanceId
          ? { ...instance, component_snapshot: target.definition }
          : instance,
      ),
      warning_overrides: [
        ...current.document.warning_overrides,
        ...warnings.map((finding) => ({
          override_id: randomId('OVERRIDE'),
          ruleset_version: 'hwsd.connection-rules/1' as const,
          rule_id: finding.rule_id,
          code: finding.code,
          message: finding.message,
          fingerprint: finding.fingerprint,
          subject: { project_id: projectId, component_instance_id: instanceId },
          confirmed_by: user.userId,
          confirmed_at: now,
          ...(confirmed.get(finding.fingerprint)?.note?.trim()
            ? { engineering_note: confirmed.get(finding.fingerprint)!.note!.trim() }
            : {}),
        })),
      ],
    });
  }

  public async rename(
    user: AuthenticatedUser,
    projectId: string,
    expectedRevision: number,
    name: string,
  ) {
    const current = await this.requireProject(user, projectId);
    return this.save(user, projectId, expectedRevision, {
      ...current.document,
      metadata: { ...current.document.metadata, name: name.trim() },
    });
  }

  public async softDelete(user: AuthenticatedUser, projectId: string) {
    const current = await this.requireProject(user, projectId);
    const deleted = await this.repository.softDelete(projectId, current.ownerUserId, user.userId);
    if (!deleted)
      throw new ApplicationError(404, 'PROJECT_NOT_FOUND', 'The project was not found.');
    return { deleted: true as const };
  }

  public async export(user: AuthenticatedUser, projectId: string) {
    const current = await this.requireProject(user, projectId);
    validateProject(current.document);
    const base =
      current.document.metadata.name
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9_-]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .slice(0, 80) || 'project';
    return { filename: `${base}.txt`, content: `${JSON.stringify(current.document, null, 2)}\n` };
  }

  public async importCopy(user: AuthenticatedUser, contentBase64: string) {
    let bytes: Buffer;
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(contentBase64)) {
      throw new ApplicationError(
        400,
        'PROJECT_IMPORT_ENCODING_INVALID',
        'The project file encoding is invalid.',
      );
    }
    try {
      bytes = Buffer.from(contentBase64, 'base64');
    } catch {
      throw new ApplicationError(
        400,
        'PROJECT_IMPORT_ENCODING_INVALID',
        'The project file encoding is invalid.',
      );
    }
    if (bytes.byteLength > MAX_IMPORT_BYTES)
      throw new ApplicationError(
        413,
        'PROJECT_IMPORT_TOO_LARGE',
        'The project file exceeds the 5 MiB limit.',
      );
    let source: string;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new ApplicationError(
        422,
        'PROJECT_IMPORT_UTF8_INVALID',
        'The project file must use valid UTF-8.',
      );
    }
    const parsed = parseStrictJson(source);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('schema_version' in parsed) ||
      parsed.schema_version !== 'hwsd.project/1'
    ) {
      throw new ApplicationError(
        422,
        'PROJECT_SCHEMA_VERSION_UNSUPPORTED',
        'The project file does not use the supported hwsd.project/1 schema version.',
      );
    }
    const imported = validateProject(parsed);
    const designCheck = evaluate({ project: imported, mode: 'DESIGN_CHECK' });
    const blockingFindings = designCheck.findings.filter(
      (finding) => finding.severity === 'ERROR' && finding.rule_id !== 'COMP-001',
    );
    if (blockingFindings.length) {
      throw new ApplicationError(
        422,
        'PROJECT_ENGINEERING_INVALID',
        'The project contains connections or allocations blocked by the V1 rule engine.',
        blockingFindings.map((finding) => ({
          code: finding.code,
          path: finding.locations[0]?.path ?? '/',
          message: finding.message,
        })),
      );
    }
    const now = this.clock.now().toISOString();
    const projectId = this.ids.projectId();
    const copiedDesignCheck = imported.last_design_check
      ? {
          ...imported.last_design_check,
          evaluated_engineering_revision: 1,
          result: {
            ...imported.last_design_check.result,
            subject: { ...imported.last_design_check.result.subject, project_id: projectId },
          },
        }
      : undefined;
    const copy = validateProject({
      ...imported,
      project_id: projectId,
      document_revision: 1,
      engineering_revision: 1,
      metadata: {
        ...imported.metadata,
        owner_user_id: user.userId,
        created_at: now,
        updated_at: now,
      },
      settings: {
        ...imported.settings,
        autosave: { ...imported.settings.autosave, last_saved_at: now },
      },
      ...(copiedDesignCheck ? { last_design_check: copiedDesignCheck } : {}),
    });
    const stored = await this.repository.create(copy, user.userId, 'PROJECT_IMPORTED');
    return { document: stored.document, saved: true };
  }

  private async requireProject(user: AuthenticatedUser, projectId: string): Promise<StoredProject> {
    const project = await this.repository.get(projectId, user.userId, user.role === 'ADMIN');
    if (!project)
      throw new ApplicationError(404, 'PROJECT_NOT_FOUND', 'The project was not found.');
    return project;
  }

  private async requireExpectedProject(
    user: AuthenticatedUser,
    projectId: string,
    expectedRevision: number,
  ) {
    const project = await this.requireProject(user, projectId);
    if (project.document.document_revision !== expectedRevision) throw this.conflict();
    return project;
  }

  private requireComponents(): ComponentRevisionProvider {
    if (!this.components)
      throw new ApplicationError(
        503,
        'COMPONENT_LIBRARY_UNAVAILABLE',
        'The component library is temporarily unavailable.',
      );
    return this.components;
  }

  private conflict() {
    return new ApplicationError(
      409,
      'PROJECT_SAVE_CONFLICT',
      'The project changed in another session. Reload or preserve your local copy before continuing.',
    );
  }
}
