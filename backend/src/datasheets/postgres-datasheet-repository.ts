import type { Pool } from 'pg';
import type {
  AuthenticatedUser,
  DatasheetCandidateStatus,
  DatasheetImportResponse,
  DatasheetImportStatus,
} from '@hwsd/shared';

import type { DatasheetMetadata, DatasheetRepository } from './types.js';

interface ImportRow {
  import_id: string;
  datasheet_id: string;
  original_filename: string;
  byte_size: string;
  page_count: number;
  sha256: string;
  status: DatasheetImportStatus;
  model_name: string | null;
  attempt_count: number;
  max_attempts: number;
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error_code: string | null;
  error_message: string | null;
}

interface CandidateRow {
  candidate_id: string;
  import_id: string;
  candidate_ordinal: number;
  detected_label: string | null;
  candidate_document: unknown;
  overall_confidence: string | null;
  status: DatasheetCandidateStatus;
  published_component_id: string | null;
  published_revision: number | null;
  model_name?: string | null;
  datasheet_id?: string;
  original_filename?: string;
  media_type?: 'application/pdf';
  byte_size?: string;
  object_key?: string;
  sha256?: string;
  page_count?: number;
  uploaded_at?: Date;
}

export class PostgresDatasheetRepository implements DatasheetRepository {
  public constructor(private readonly pool: Pool) {}

  public async createImport(metadata: DatasheetMetadata, importId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO datasheets (
           datasheet_id, uploaded_by, original_filename, media_type, byte_size,
           page_count, sha256, object_key
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (sha256) DO UPDATE SET deleted_at = NULL`,
        [
          metadata.datasheetId,
          metadata.uploadedBy,
          metadata.filename,
          metadata.mediaType,
          metadata.byteSize,
          metadata.pageCount,
          metadata.sha256,
          metadata.objectKey,
        ],
      );
      const stored = await client.query<{ datasheet_id: string }>(
        'SELECT datasheet_id FROM datasheets WHERE sha256 = $1 AND deleted_at IS NULL',
        [metadata.sha256],
      );
      await client.query(
        `INSERT INTO datasheet_import_jobs (import_id, datasheet_id, requested_by)
         VALUES ($1,$2,$3)`,
        [importId, stored.rows[0]!.datasheet_id, metadata.uploadedBy],
      );
      await client.query(
        `INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action, metadata)
         VALUES ($1, 'IMPORT_JOB', $2, 'DATASHEET_IMPORT_QUEUED', $3::jsonb)`,
        [
          metadata.uploadedBy,
          importId,
          JSON.stringify({ sha256: metadata.sha256, pageCount: metadata.pageCount }),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async list(requester: AuthenticatedUser) {
    const rows = await this.pool.query<ImportRow>(
      `${this.importSelect()}
        WHERE (j.requested_by = $1 OR $2::boolean)
        ORDER BY j.requested_at DESC`,
      [requester.userId, requester.role === 'ADMIN'],
    );
    return Promise.all(rows.rows.map((row) => this.hydrate(row)));
  }

  public async get(importId: string, requester: AuthenticatedUser) {
    const result = await this.pool.query<ImportRow>(
      `${this.importSelect()}
        WHERE j.import_id = $1 AND (j.requested_by = $2 OR $3::boolean)`,
      [importId, requester.userId, requester.role === 'ADMIN'],
    );
    return result.rows[0] ? this.hydrate(result.rows[0]) : null;
  }

  public async getCandidate(candidateId: string, requester: AuthenticatedUser) {
    const result = await this.pool.query<CandidateRow>(
      `SELECT c.candidate_id, c.import_id, c.candidate_document, c.status, j.model_name,
              d.datasheet_id, d.original_filename, d.media_type, d.byte_size, d.object_key,
              d.sha256, d.page_count, d.uploaded_at
         FROM component_candidates c
         JOIN datasheet_import_jobs j ON j.import_id = c.import_id
         JOIN datasheets d ON d.datasheet_id = j.datasheet_id
        WHERE c.candidate_id = $1 AND (j.requested_by = $2 OR $3::boolean)`,
      [candidateId, requester.userId, requester.role === 'ADMIN'],
    );
    const row = result.rows[0];
    return row
      ? {
          candidateId: row.candidate_id,
          importId: row.import_id,
          document: row.candidate_document,
          status: row.status,
          modelName: row.model_name ?? null,
          datasheet: {
            datasheet_id: row.datasheet_id!,
            filename: row.original_filename!,
            media_type: row.media_type!,
            byte_size: Number(row.byte_size),
            storage_ref: row.object_key!,
            sha256: row.sha256!,
            page_count: row.page_count!,
            uploaded_at: row.uploaded_at!.toISOString(),
          },
        }
      : null;
  }

  public async updateCandidate(
    candidateId: string,
    requester: AuthenticatedUser,
    status: 'SELECTED' | 'REJECTED',
    document?: unknown,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ import_id: string }>(
        `UPDATE component_candidates c
          SET status = $3,
              candidate_document = COALESCE($4::jsonb, candidate_document)
         FROM datasheet_import_jobs j
        WHERE c.import_id = j.import_id AND c.candidate_id = $1
          AND (j.requested_by = $2 OR $5::boolean)
          AND c.status IN ('DETECTED', 'SELECTED')
        RETURNING c.import_id`,
        [
          candidateId,
          requester.userId,
          status,
          document === undefined ? null : JSON.stringify(document),
          requester.role === 'ADMIN',
        ],
      );
      if (result.rowCount === 1) {
        await client.query(
          `INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action, metadata)
           VALUES ($1, 'IMPORT_JOB', $2, $3, $4::jsonb)`,
          [
            requester.userId,
            result.rows[0]!.import_id,
            status === 'REJECTED' ? 'DATASHEET_CANDIDATE_REJECTED' : 'DATASHEET_CANDIDATE_SELECTED',
            JSON.stringify({ candidateId, documentUpdated: document !== undefined }),
          ],
        );
        await this.completeImportWhenReviewed(client, candidateId);
      }
      await client.query('COMMIT');
      return result.rowCount === 1;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async retry(importId: string, requester: AuthenticatedUser) {
    const result = await this.pool.query(
      `UPDATE datasheet_import_jobs
          SET status = 'QUEUED', available_at = CURRENT_TIMESTAMP,
              completed_at = NULL, error_code = NULL, error_message = NULL
        WHERE import_id = $1 AND (requested_by = $2 OR $3::boolean)
          AND status = 'FAILED' AND attempt_count < max_attempts`,
      [importId, requester.userId, requester.role === 'ADMIN'],
    );
    return result.rowCount === 1;
  }

  private importSelect() {
    return `SELECT j.import_id, j.datasheet_id, d.original_filename, d.byte_size,
                   d.page_count, d.sha256, j.status, j.model_name, j.attempt_count,
                   j.max_attempts, j.requested_at, j.started_at, j.completed_at,
                   j.error_code, j.error_message
              FROM datasheet_import_jobs j
              JOIN datasheets d ON d.datasheet_id = j.datasheet_id`;
  }

  private async completeImportWhenReviewed(
    client: { query: (text: string, values?: readonly unknown[]) => Promise<unknown> },
    candidateId: string,
  ) {
    await client.query(
      `UPDATE datasheet_import_jobs j
          SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
         FROM component_candidates changed
        WHERE changed.candidate_id = $1 AND changed.import_id = j.import_id
          AND j.status = 'REVIEW_REQUIRED'
          AND NOT EXISTS (
            SELECT 1 FROM component_candidates pending
             WHERE pending.import_id = j.import_id
               AND pending.status IN ('DETECTED', 'SELECTED')
          )`,
      [candidateId],
    );
  }

  private async hydrate(row: ImportRow): Promise<DatasheetImportResponse> {
    const candidates = await this.pool.query<CandidateRow>(
      `SELECT candidate_id, import_id, candidate_ordinal, detected_label, candidate_document,
              overall_confidence, status, published_component_id, published_revision
         FROM component_candidates WHERE import_id = $1 ORDER BY candidate_ordinal`,
      [row.import_id],
    );
    return {
      importId: row.import_id,
      datasheetId: row.datasheet_id,
      filename: row.original_filename,
      byteSize: Number(row.byte_size),
      pageCount: row.page_count,
      sha256: row.sha256,
      status: row.status,
      modelName: row.model_name,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      requestedAt: row.requested_at.toISOString(),
      startedAt: row.started_at?.toISOString() ?? null,
      completedAt: row.completed_at?.toISOString() ?? null,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      candidates: candidates.rows.map((candidate) => ({
        candidateId: candidate.candidate_id,
        ordinal: candidate.candidate_ordinal,
        detectedLabel: candidate.detected_label,
        overallConfidence:
          candidate.overall_confidence === null ? null : Number(candidate.overall_confidence),
        status: candidate.status,
        document: candidate.candidate_document,
        publishedComponentId: candidate.published_component_id,
        publishedRevision: candidate.published_revision,
      })),
    };
  }
}
