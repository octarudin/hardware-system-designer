import { randomBytes } from 'node:crypto';

import {
  type AuthenticatedUser,
  type ProjectFileV1,
  validateProjectFileSchema,
  validateProjectSemantics,
} from '@hwsd/shared';
import { evaluate } from '@hwsd/rule-engine';

import { ApplicationError } from '../errors.js';
import { parseStrictJson } from './strict-json.js';
import type { Clock, IdGenerator, ProjectRepository, StoredProject } from './types.js';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const systemClock: Clock = { now: () => new Date() };
const randomIds: IdGenerator = {
  projectId: () => `PROJ-${randomBytes(12).toString('hex').toUpperCase()}`,
};

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
      );
      return { document: stored.document, saved: true };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      const pg = error as { code?: string };
      if (pg.code === '40001') throw this.conflict();
      throw error;
    }
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

  private conflict() {
    return new ApplicationError(
      409,
      'PROJECT_SAVE_CONFLICT',
      'The project changed in another session. Reload or preserve your local copy before continuing.',
    );
  }
}
