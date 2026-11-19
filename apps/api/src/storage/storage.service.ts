import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Inject, Injectable } from '@nestjs/common'
import { APP_CONFIG, type AppConfig } from '../config/app-config'

/** Signed, short-lived read URLs for private objects in Cloudflare R2. URLs are computed locally (no network call). */
@Injectable()
export class StorageService {
  private readonly client: S3Client | null
  private readonly defaultBucket: string | null

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.defaultBucket = config.r2?.bucket ?? null
    this.client = config.r2
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey },
        })
      : null
  }

  get enabled(): boolean {
    return this.client !== null
  }

  get bucket(): string | null {
    return this.defaultBucket
  }

  async signedGetUrl(objectKey: string, ttlSeconds: number, bucket?: string | null): Promise<string> {
    const target = bucket ?? this.defaultBucket
    if (!this.client || !target) throw new Error('Object storage is not configured')
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: target, Key: objectKey }), { expiresIn: ttlSeconds })
  }

  async putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.client || !this.defaultBucket) throw new Error('Object storage is not configured')
    await this.client.send(new PutObjectCommand({ Bucket: this.defaultBucket, Key: objectKey, Body: body, ContentType: contentType }))
  }
}
