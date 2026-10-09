import { createWorkerRuntime } from './runtime.js';
import { randomUUID } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { Pool } from 'pg';

import { DatasheetJobRepository } from './job-repository.js';
import { DatasheetProcessor } from './processor.js';
import { OpenAIExtractionProvider } from './provider.js';

const worker = createWorkerRuntime({
  onStart: (status) => {
    console.info(JSON.stringify({ level: 'info', event: 'worker.started', ...status }));
  },
  onStop: () => {
    console.info(JSON.stringify({ level: 'info', event: 'worker.stopped' }));
  },
});

const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.OPENAI_API_KEY;
let pool: Pool | undefined;
let processor: DatasheetProcessor | undefined;
let s3Client: S3Client | undefined;

if (databaseUrl && apiKey) {
  pool = new Pool({ connectionString: databaseUrl });
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  s3Client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  });
  processor = new DatasheetProcessor(
    new DatasheetJobRepository(pool),
    s3Client,
    process.env.S3_BUCKET ?? 'hwsd-datasheets',
    new OpenAIExtractionProvider(apiKey, process.env.OPENAI_MODEL ?? 'gpt-5.4-mini'),
    `WORKER-${randomUUID().replaceAll('-', '').toUpperCase()}`,
  );
} else {
  console.warn(
    JSON.stringify({
      level: 'warn',
      event: 'worker.processing_disabled',
      message: 'DATABASE_URL and OPENAI_API_KEY are required for datasheet processing.',
    }),
  );
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    console.info(JSON.stringify({ level: 'info', event: 'worker.shutdown', signal }));
    worker.stop();
    processor?.stop();
    s3Client?.destroy();
    void pool?.end();
  });
}

worker.start();
processor?.start();
