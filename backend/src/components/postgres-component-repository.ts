import { randomBytes } from 'node:crypto';

import type { Pool } from 'pg';
import type {
  ComponentListItem,
  ComponentListQuery,
  ComponentListResponse,
  ComponentReviewQueueResponse,
  ComponentSchemaV1,
} from '@hwsd/shared';

import { ApplicationError } from '../errors.js';
import type { ComponentRepository, Publication, StoredComponentRevision } from './types.js';

interface ListRow {
  component_id: string;
  canonical_name: string;
  manufacturer: string | null;
  part_number: string | null;
  category: ComponentListItem['category'];
  abstraction: ComponentListItem['abstraction'];
  current_status: ComponentListItem['lifecycleStatus'];
  latest_revision: number;
  has_datasheet: boolean;
  updated_at: Date;
  total_count: string;
}

interface RevisionRow {
  definition: ComponentSchemaV1;
  created_by: string;
  created_at: Date;
}

function stored(row: RevisionRow): StoredComponentRevision {
  return { definition: row.definition, createdBy: row.created_by, createdAt: row.created_at };
}

function item(row: ListRow): ComponentListItem {
  return {
    componentId: row.component_id,
    name: row.canonical_name,
    manufacturer: row.manufacturer,
    partNumber: row.part_number,
    category: row.category,
    abstraction: row.abstraction,
    lifecycleStatus: row.current_status,
    latestRevision: row.latest_revision,
    hasDatasheet: row.has_datasheet,
    updatedAt: row.updated_at.toISOString(),
  };
}

export class PostgresComponentRepository implements ComponentRepository {
  public constructor(private readonly pool: Pool) {}

  public async list(
    query: Required<Pick<ComponentListQuery, 'page' | 'pageSize' | 'sort'>> & ComponentListQuery,
  ): Promise<ComponentListResponse> {
    const values: unknown[] = [];
    const filters: string[] = [];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (query.q) {
      const parameter = add(`%${query.q}%`);
      filters.push(
        `(c.canonical_name ILIKE ${parameter} OR c.manufacturer ILIKE ${parameter} OR c.part_number ILIKE ${parameter})`,
      );
    }
    if (query.category) filters.push(`c.category = ${add(query.category)}`);
    if (query.abstraction) filters.push(`c.abstraction = ${add(query.abstraction)}`);
    if (query.status) filters.push(`c.current_status = ${add(query.status)}`);
    if (query.manufacturer) filters.push(`c.manufacturer ILIKE ${add(`%${query.manufacturer}%`)}`);
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const order =
      query.sort === 'updated'
        ? 'c.updated_at DESC, c.component_id'
        : 'c.canonical_name, c.component_id';
    const limit = add(query.pageSize);
    const offset = add((query.page - 1) * query.pageSize);
    const result = await this.pool.query<ListRow>(
      `SELECT c.*, COUNT(*) OVER () AS total_count,
              EXISTS (
                SELECT 1 FROM component_revision_datasheets d
                 WHERE d.component_id = c.component_id AND d.revision = c.latest_revision
              ) AS has_datasheet
         FROM components c
         ${where}
         ORDER BY ${order}
         LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return {
      items: result.rows.map(item),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  public async listReviewQueue(): Promise<ComponentReviewQueueResponse> {
    const result = await this.pool.query<ListRow & { created_by: string; submitted_at: Date }>(
      `SELECT c.*, r.created_by, r.created_at AS submitted_at,
              COUNT(*) OVER () AS total_count,
              EXISTS (
                SELECT 1 FROM component_revision_datasheets d
                 WHERE d.component_id = c.component_id AND d.revision = c.latest_revision
              ) AS has_datasheet
         FROM components c
         JOIN component_revisions r
           ON r.component_id = c.component_id AND r.revision = c.latest_revision
        WHERE c.current_status = 'PENDING_ADMIN_VERIFICATION'
        ORDER BY r.created_at, c.component_id`,
    );
    return {
      items: result.rows.map((row) => ({
        ...item(row),
        submittedBy: row.created_by,
        submittedAt: row.submitted_at.toISOString(),
      })),
    };
  }

  public async getRevision(componentId: string, revision: number) {
    const result = await this.pool.query<RevisionRow>(
      `SELECT definition, created_by, created_at
         FROM component_revisions
        WHERE component_id = $1 AND revision = $2`,
      [componentId, revision],
    );
    return result.rows[0] ? stored(result.rows[0]) : null;
  }

  public async getLatest(componentId: string) {
    const result = await this.pool.query<RevisionRow>(
      `SELECT r.definition, r.created_by, r.created_at
         FROM components c
         JOIN component_revisions r
           ON r.component_id = c.component_id AND r.revision = c.latest_revision
        WHERE c.component_id = $1`,
      [componentId],
    );
    return result.rows[0] ? stored(result.rows[0]) : null;
  }

  public async publish(publication: Publication): Promise<StoredComponentRevision> {
    const client = await this.pool.connect();
    const { definition } = publication;
    try {
      await client.query('BEGIN');
      if (publication.createComponent) {
        await client.query(
          `INSERT INTO components (component_id, created_by, latest_revision)
           VALUES ($1, $2, 0)`,
          [definition.component_id, publication.actorUserId],
        );
      } else {
        const locked = await client.query<{ latest_revision: number }>(
          'SELECT latest_revision FROM components WHERE component_id = $1 FOR UPDATE',
          [definition.component_id],
        );
        if (!locked.rows[0])
          throw new ApplicationError(404, 'COMPONENT_NOT_FOUND', 'The component was not found.');
        if (locked.rows[0].latest_revision !== publication.expectedLatestRevision) {
          throw new ApplicationError(
            409,
            'COMPONENT_REVISION_CONFLICT',
            'The component changed while this revision was being published.',
          );
        }
      }

      const datasheetIds = definition.provenance.datasheets.map(({ datasheet_id }) => datasheet_id);
      if (datasheetIds.length) {
        const known = await client.query<{ datasheet_id: string }>(
          'SELECT datasheet_id FROM datasheets WHERE datasheet_id = ANY($1::text[]) AND deleted_at IS NULL',
          [datasheetIds],
        );
        const knownIds = new Set(known.rows.map((row) => row.datasheet_id));
        const missing = datasheetIds.filter((id) => !knownIds.has(id));
        if (missing.length) {
          throw new ApplicationError(
            422,
            'DATASHEET_REFERENCE_INVALID',
            'The component references an unavailable datasheet.',
            missing.map((id) => ({
              code: 'DATASHEET_NOT_FOUND',
              path: '/provenance/datasheets',
              message: `Datasheet ${id} was not found.`,
            })),
          );
        }
      }

      const inserted = await client.query<RevisionRow>(
        `INSERT INTO component_revisions (
           component_id, revision, schema_version, canonical_name, manufacturer, part_number,
           category, abstraction, lifecycle_status, definition, revision_notes, created_by,
           verified_by, verified_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14
         )
         RETURNING definition, created_by, created_at`,
        [
          definition.component_id,
          definition.revision,
          definition.schema_version,
          definition.identity.name,
          definition.identity.manufacturer ?? null,
          definition.identity.part_number ?? null,
          definition.classification.category,
          definition.classification.abstraction,
          definition.lifecycle.status,
          JSON.stringify(definition),
          definition.revision_notes,
          publication.actorUserId,
          definition.lifecycle.verified_by ?? null,
          definition.lifecycle.verified_at ?? null,
        ],
      );
      for (const datasheetId of datasheetIds) {
        await client.query(
          `INSERT INTO component_revision_datasheets (component_id, revision, datasheet_id)
           VALUES ($1, $2, $3)`,
          [definition.component_id, definition.revision, datasheetId],
        );
      }
      await client.query(
        `INSERT INTO component_review_actions (
           review_action_id, component_id, revision, actor_user_id, action, note
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `REVIEW-${randomBytes(12).toString('hex').toUpperCase()}`,
          definition.component_id,
          definition.revision,
          publication.actorUserId,
          publication.reviewAction,
          publication.reviewNote ?? null,
        ],
      );
      await client.query(
        `INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action, metadata)
         VALUES ($1, 'COMPONENT_REVISION', $2, $3, $4::jsonb)`,
        [
          publication.actorUserId,
          `${definition.component_id}:${definition.revision}`,
          `COMPONENT_${publication.reviewAction}`,
          JSON.stringify({
            componentId: definition.component_id,
            revision: definition.revision,
            lifecycleStatus: definition.lifecycle.status,
          }),
        ],
      );
      await client.query('COMMIT');
      return stored(inserted.rows[0]!);
    } catch (error) {
      await client.query('ROLLBACK');
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' || pgError.code === '23514') {
        throw new ApplicationError(
          409,
          'COMPONENT_REVISION_CONFLICT',
          'The component revision could not be published because the stored version changed.',
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
