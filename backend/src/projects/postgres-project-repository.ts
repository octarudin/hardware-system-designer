import type { Pool, PoolClient } from 'pg';
import type { ConnectionRuleResultV1, ProjectFileV1, ProjectSummary } from '@hwsd/shared';

import type { ProjectRepository, StoredProject } from './types.js';

interface ProjectRow {
  document: ProjectFileV1;
  owner_user_id: string;
}
interface SummaryRow {
  project_id: string;
  name: string;
  description: string | null;
  document_revision: string;
  engineering_revision: string;
  updated_at: Date;
  document: ProjectFileV1;
}

function stored(row: ProjectRow): StoredProject {
  return { document: row.document, ownerUserId: row.owner_user_id };
}

async function audit(
  client: PoolClient,
  actor: string,
  entityId: string,
  action: string,
  metadata: unknown = {},
  entityType: 'PROJECT' | 'DESIGN_CHECK' = 'PROJECT',
) {
  await client.query(
    `INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actor, entityType, entityId, action, JSON.stringify(metadata)],
  );
}

export class PostgresProjectRepository implements ProjectRepository {
  public constructor(private readonly pool: Pool) {}

  public async list(ownerUserId: string, search?: string): Promise<readonly ProjectSummary[]> {
    const result = await this.pool.query<SummaryRow>(
      `SELECT project_id, name, description, document_revision, engineering_revision, updated_at, document
         FROM projects
        WHERE owner_user_id = $1 AND deleted_at IS NULL
          AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
        ORDER BY updated_at DESC, project_id`,
      [ownerUserId, search ?? null],
    );
    return result.rows.map((row) => {
      const check = row.document.last_design_check;
      return {
        projectId: row.project_id,
        name: row.name,
        description: row.description,
        documentRevision: Number(row.document_revision),
        engineeringRevision: Number(row.engineering_revision),
        updatedAt: row.updated_at.toISOString(),
        designCheck: check
          ? {
              verdict: check.result.verdict,
              current: check.evaluated_engineering_revision === Number(row.engineering_revision),
            }
          : null,
      };
    });
  }

  public async get(projectId: string, requesterUserId: string, isAdmin: boolean) {
    const result = await this.pool.query<ProjectRow>(
      `SELECT document, owner_user_id FROM projects
        WHERE project_id = $1 AND deleted_at IS NULL
          AND (owner_user_id = $2 OR $3::boolean)`,
      [projectId, requesterUserId, isAdmin],
    );
    return result.rows[0] ? stored(result.rows[0]) : null;
  }

  public async create(
    document: ProjectFileV1,
    actorUserId: string,
    action: 'PROJECT_CREATED' | 'PROJECT_IMPORTED',
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<ProjectRow>(
        `INSERT INTO projects (
           project_id, owner_user_id, name, description, document_revision, engineering_revision,
           schema_version, ruleset_version, document, autosave_enabled, autosave_interval_ms,
           last_saved_at, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14)
         RETURNING document, owner_user_id`,
        [
          document.project_id,
          document.metadata.owner_user_id,
          document.metadata.name,
          document.metadata.description ?? null,
          document.document_revision,
          document.engineering_revision,
          document.schema_version,
          document.ruleset_version,
          JSON.stringify(document),
          document.settings.autosave.enabled,
          document.settings.autosave.interval_ms,
          document.settings.autosave.last_saved_at ?? null,
          document.metadata.created_at,
          document.metadata.updated_at,
        ],
      );
      await audit(client, actorUserId, document.project_id, action, {
        documentRevision: document.document_revision,
      });
      await client.query('COMMIT');
      return stored(result.rows[0]!);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async save(
    document: ProjectFileV1,
    ownerUserId: string,
    actorUserId: string,
    expectedRevision: number,
    designCheck?: {
      readonly id: string;
      readonly result: ConnectionRuleResultV1;
      readonly createdAt: string;
    },
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<ProjectRow>(
        `SELECT document, owner_user_id FROM save_project_v1($1, $2, $3, $4::jsonb)`,
        [document.project_id, ownerUserId, expectedRevision, JSON.stringify(document)],
      );
      await audit(client, actorUserId, document.project_id, 'PROJECT_SAVED', {
        documentRevision: document.document_revision,
        engineeringRevision: document.engineering_revision,
      });
      if (designCheck) {
        await client.query(
          `INSERT INTO design_check_runs (
             design_check_id, project_id, document_revision, engineering_revision,
             ruleset_version, result, initiated_by, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
          [
            designCheck.id,
            document.project_id,
            document.document_revision,
            document.engineering_revision,
            designCheck.result.ruleset_version,
            JSON.stringify(designCheck.result),
            actorUserId,
            designCheck.createdAt,
          ],
        );
        await audit(
          client,
          actorUserId,
          designCheck.id,
          'DESIGN_CHECK_COMPLETED',
          {
            projectId: document.project_id,
            verdict: designCheck.result.verdict,
            engineeringRevision: document.engineering_revision,
          },
          'DESIGN_CHECK',
        );
      }
      await client.query('COMMIT');
      return stored(result.rows[0]!);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async softDelete(
    projectId: string,
    ownerUserId: string,
    actorUserId: string,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE projects SET deleted_at = CURRENT_TIMESTAMP
          WHERE project_id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
        [projectId, ownerUserId],
      );
      if (result.rowCount) await audit(client, actorUserId, projectId, 'PROJECT_DELETED');
      await client.query('COMMIT');
      return result.rowCount === 1;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
