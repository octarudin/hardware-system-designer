import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

import type { NormalizedCandidate, SourceDatasheet } from './normalizer.js';

export interface LeasedDatasheetJob {
  readonly importId: string;
  readonly source: SourceDatasheet;
  readonly attemptCount: number;
  readonly maxAttempts: number;
}

export class DatasheetJobRepository {
  public constructor(private readonly pool: Pool) {}

  public async claim(workerId: string, leaseSeconds = 90): Promise<LeasedDatasheetJob | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE datasheet_import_jobs
            SET status = CASE WHEN attempt_count >= max_attempts THEN 'FAILED' ELSE 'QUEUED' END,
                available_at = CURRENT_TIMESTAMP,
                completed_at = CASE WHEN attempt_count >= max_attempts THEN CURRENT_TIMESTAMP ELSE NULL END,
                error_code = CASE WHEN attempt_count >= max_attempts THEN 'JOB_LEASE_EXPIRED' ELSE NULL END,
                error_message = CASE WHEN attempt_count >= max_attempts THEN 'The extraction worker lease expired.' ELSE NULL END,
                lease_owner = NULL, lease_expires_at = NULL, heartbeat_at = NULL
          WHERE status = 'PROCESSING' AND lease_expires_at < CURRENT_TIMESTAMP`,
      );
      const selected = await client.query<{
        import_id: string;
        attempt_count: number;
        max_attempts: number;
        datasheet_id: string;
        original_filename: string;
        byte_size: string;
        sha256: string;
        object_key: string;
        page_count: number;
        uploaded_at: Date;
      }>(
        `SELECT j.import_id, j.attempt_count, j.max_attempts, d.datasheet_id,
                d.original_filename, d.byte_size, d.sha256, d.object_key,
                d.page_count, d.uploaded_at
           FROM datasheet_import_jobs j
           JOIN datasheets d ON d.datasheet_id = j.datasheet_id
          WHERE j.status = 'QUEUED' AND j.available_at <= CURRENT_TIMESTAMP
            AND j.attempt_count < j.max_attempts
          ORDER BY j.requested_at
          FOR UPDATE OF j SKIP LOCKED
          LIMIT 1`,
      );
      const row = selected.rows[0];
      if (!row) {
        await client.query('COMMIT');
        return null;
      }
      await client.query(
        `UPDATE datasheet_import_jobs
            SET status = 'PROCESSING', attempt_count = attempt_count + 1,
                started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
                lease_owner = $2,
                lease_expires_at = CURRENT_TIMESTAMP + make_interval(secs => $3),
                heartbeat_at = CURRENT_TIMESTAMP
          WHERE import_id = $1`,
        [row.import_id, workerId, leaseSeconds],
      );
      await client.query('COMMIT');
      return {
        importId: row.import_id,
        attemptCount: row.attempt_count + 1,
        maxAttempts: row.max_attempts,
        source: {
          datasheetId: row.datasheet_id,
          filename: row.original_filename,
          byteSize: Number(row.byte_size),
          sha256: row.sha256,
          objectKey: row.object_key,
          pageCount: row.page_count,
          uploadedAt: row.uploaded_at.toISOString(),
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async heartbeat(importId: string, workerId: string, leaseSeconds = 90): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE datasheet_import_jobs
          SET heartbeat_at = CURRENT_TIMESTAMP,
              lease_expires_at = CURRENT_TIMESTAMP + make_interval(secs => $3)
        WHERE import_id = $1 AND lease_owner = $2 AND status = 'PROCESSING'`,
      [importId, workerId, leaseSeconds],
    );
    return result.rowCount === 1;
  }

  public async complete(
    job: LeasedDatasheetJob,
    workerId: string,
    model: string,
    promptVersion: string,
    extractedCharacterCount: number,
    candidates: readonly NormalizedCandidate[],
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owned = await client.query(
        `SELECT 1 FROM datasheet_import_jobs
          WHERE import_id = $1 AND lease_owner = $2 AND status = 'PROCESSING'
          FOR UPDATE`,
        [job.importId, workerId],
      );
      if (owned.rowCount !== 1) throw new Error('JOB_LEASE_LOST');
      for (const [index, candidate] of candidates.entries()) {
        await client.query(
          `INSERT INTO component_candidates (
             candidate_id, import_id, candidate_ordinal, detected_label,
             candidate_document, overall_confidence
           ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            `CAND-${randomUUID().replaceAll('-', '').toUpperCase()}`,
            job.importId,
            index + 1,
            candidate.label,
            JSON.stringify(candidate.document),
            candidate.confidence,
          ],
        );
      }
      await client.query(
        `UPDATE datasheet_import_jobs
            SET status = 'REVIEW_REQUIRED', model_name = $3, prompt_version = $4,
                extracted_character_count = $5, completed_at = CURRENT_TIMESTAMP,
                lease_owner = NULL, lease_expires_at = NULL, heartbeat_at = NULL
          WHERE import_id = $1 AND lease_owner = $2`,
        [job.importId, workerId, model, promptVersion, extractedCharacterCount],
      );
      await client.query(
        `INSERT INTO audit_events (entity_type, entity_id, action, metadata)
         VALUES ('IMPORT_JOB', $1, 'DATASHEET_EXTRACTION_COMPLETED', $2::jsonb)`,
        [job.importId, JSON.stringify({ model, promptVersion, candidateCount: candidates.length })],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async fail(
    job: LeasedDatasheetJob,
    workerId: string,
    code: string,
    message: string,
  ): Promise<void> {
    const finalAttempt = job.attemptCount >= job.maxAttempts;
    await this.pool.query(
      `WITH changed AS (
         UPDATE datasheet_import_jobs
          SET status = $3,
              available_at = CURRENT_TIMESTAMP + make_interval(secs => $4),
              completed_at = CASE WHEN $3 = 'FAILED' THEN CURRENT_TIMESTAMP ELSE NULL END,
              error_code = CASE WHEN $3 = 'FAILED' THEN $5 ELSE NULL END,
              error_message = CASE WHEN $3 = 'FAILED' THEN $6 ELSE NULL END,
              lease_owner = NULL, lease_expires_at = NULL, heartbeat_at = NULL
         WHERE import_id = $1 AND lease_owner = $2 AND status = 'PROCESSING'
         RETURNING import_id
       )
       INSERT INTO audit_events (entity_type, entity_id, action, metadata)
       SELECT 'IMPORT_JOB', import_id,
              CASE WHEN $3 = 'FAILED' THEN 'DATASHEET_EXTRACTION_FAILED'
                   ELSE 'DATASHEET_EXTRACTION_REQUEUED' END,
              jsonb_build_object('errorCode', $5, 'attemptCount', $7::integer)
         FROM changed`,
      [
        job.importId,
        workerId,
        finalAttempt ? 'FAILED' : 'QUEUED',
        Math.min(300, 2 ** job.attemptCount * 5),
        code,
        message.slice(0, 500),
        job.attemptCount,
      ],
    );
  }
}
