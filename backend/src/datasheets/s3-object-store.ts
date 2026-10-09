import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { ObjectStore } from './types.js';

export class S3ObjectStore implements ObjectStore {
  private ready: Promise<void> | undefined;
  public constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly serverSideEncryption?: 'AES256',
  ) {}

  public async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        ...(this.serverSideEncryption ? { ServerSideEncryption: this.serverSideEncryption } : {}),
      }),
    );
  }

  public signedDownload(key: string, filename: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: 'application/pdf',
        ResponseContentDisposition: `attachment; filename="${filename.replaceAll('"', '')}"`,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  private ensureBucket(): Promise<void> {
    this.ready ??= (async () => {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (status !== 404) throw error;
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      }
    })();
    return this.ready;
  }
}
