import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';

import type { DatasheetJobRepository, LeasedDatasheetJob } from './job-repository.js';
import { normalizeCandidates } from './normalizer.js';
import { extractPdfText } from './pdf-extractor.js';
import type { ExtractionProvider } from './provider.js';

export class DatasheetProcessor {
  private timer: NodeJS.Timeout | undefined;
  private processing = false;

  public constructor(
    private readonly jobs: DatasheetJobRepository,
    private readonly objects: S3Client,
    private readonly bucket: string,
    private readonly provider: ExtractionProvider,
    private readonly workerId: string,
    private readonly pollIntervalMs = 2_000,
  ) {}

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);
    void this.tick();
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  public async processOne(): Promise<boolean> {
    const job = await this.jobs.claim(this.workerId);
    if (!job) return false;
    const heartbeat = setInterval(
      () => void this.jobs.heartbeat(job.importId, this.workerId),
      30_000,
    );
    try {
      const response = await this.objects.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: job.source.objectKey }),
      );
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) throw new Error('DATASHEET_OBJECT_MISSING');
      const extracted = await extractPdfText(bytes);
      if (extracted.pageCount !== job.source.pageCount) throw new Error('PDF_PAGE_COUNT_CHANGED');
      const extraction = await this.provider.extract(extracted.text);
      const candidates = normalizeCandidates(extraction.result, job.source);
      await this.jobs.complete(
        job,
        this.workerId,
        extraction.model,
        this.provider.promptVersion,
        extracted.text.length,
        candidates,
      );
      return true;
    } catch (error) {
      await this.fail(job, error);
      return true;
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.processOne();
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'worker.poll_failed',
          message: error instanceof Error ? error.message : 'Unknown worker failure',
        }),
      );
    } finally {
      this.processing = false;
    }
  }

  private fail(job: LeasedDatasheetJob, error: unknown): Promise<void> {
    const raw = error instanceof Error ? error.message : 'DATASHEET_EXTRACTION_FAILED';
    const code = /^[A-Z][A-Z0-9_]+$/u.test(raw) ? raw : 'DATASHEET_EXTRACTION_FAILED';
    return this.jobs.fail(job, this.workerId, code, 'Datasheet extraction could not be completed.');
  }
}
