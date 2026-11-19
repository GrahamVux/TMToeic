import { createHmac, timingSafeEqual } from 'node:crypto'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { APP_CONFIG, type AppConfig } from '../config/app-config'

/** Signed, short-lived read URLs for private objects in Cloudflare R2. URLs are computed locally (no network call). */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('Storage')
  private readonly client: S3Client | null
  private readonly defaultBucket: string | null
  private readonly localRoot: string
  private readonly signingKey: string
  private readonly develop: boolean
  private warnedLocal = false

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.defaultBucket = config.r2?.bucket ?? null
    this.develop = config.nodeEnv === 'development'
    this.signingKey = config.jwtAccessSecret
    this.localRoot = resolve(process.env.LOCAL_OBJECT_DIR || join(process.cwd(), '.data', 'objects'))
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
    if (this.develop && (await this.localExists(objectKey))) return this.localUrl(objectKey, ttlSeconds)
    const target = bucket ?? this.defaultBucket
    if (!this.client || !target) throw new Error('Object storage is not configured')
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: target, Key: objectKey }), { expiresIn: ttlSeconds })
  }

  async putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.client || !this.defaultBucket) throw new Error('Object storage is not configured')
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.defaultBucket, Key: objectKey, Body: body, ContentType: contentType }))
    } catch (err) {
      if (!this.develop) throw err
      if (!this.warnedLocal) {
        this.warnedLocal = true
        const reason = err instanceof Error ? err.message : String(err)
        this.logger.warn(`Cloudflare từ chối ghi file (${reason}). Bản local lưu file trên máy để vẫn nộp đề được.`)
      }
      await this.writeLocal(objectKey, body, contentType)
    }
  }

  /** Removes one object. A missing object is already the outcome we want. */
  async deleteObject(objectKey: string, bucket?: string | null): Promise<void> {
    if (this.develop) await rm(this.localPath(objectKey), { force: true }).catch(() => undefined)
    const target = bucket ?? this.defaultBucket
    if (!this.client || !target) return
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: target, Key: objectKey }))
    } catch (err) {
      if (!this.develop) throw err
    }
  }

  /** Reads a development-only copy. Returns null when the signature or the file is not valid. */
  async openLocal(key: string, exp: string, sig: string): Promise<{ data: Buffer; mimeType: string } | null> {
    if (!this.develop || !this.signatureMatches(key, exp, sig)) return null
    try {
      const path = this.localPath(key)
      const [data, mimeType] = await Promise.all([readFile(path), readFile(`${path}.mime`, 'utf8').catch(() => 'application/octet-stream')])
      return { data, mimeType }
    } catch {
      return null
    }
  }

  private async writeLocal(objectKey: string, body: Buffer, contentType: string) {
    const path = this.localPath(objectKey)
    await mkdir(resolve(path, '..'), { recursive: true })
    await writeFile(path, body)
    await writeFile(`${path}.mime`, contentType)
  }

  private async localExists(objectKey: string): Promise<boolean> {
    try {
      await access(this.localPath(objectKey))
      return true
    } catch {
      return false
    }
  }

  private localUrl(objectKey: string, ttlSeconds: number): string {
    const exp = String(Date.now() + ttlSeconds * 1000)
    const sig = this.sign(objectKey, exp)
    return `/api/v1/local-objects?key=${encodeURIComponent(objectKey)}&exp=${exp}&sig=${sig}`
  }

  private sign(key: string, exp: string): string {
    return createHmac('sha256', this.signingKey).update(`${exp}\n${key}`).digest('base64url')
  }

  private signatureMatches(key: string, exp: string, sig: string): boolean {
    const expires = Number(exp)
    if (!key || !sig || !Number.isFinite(expires) || expires < Date.now()) return false
    const expected = this.sign(key, exp)
    const left = Buffer.from(expected)
    const right = Buffer.from(sig)
    return left.length === right.length && timingSafeEqual(left, right)
  }

  private localPath(objectKey: string): string {
    const clean = objectKey.replace(/\\/g, '/').replace(/^\/+/, '')
    if (!clean || clean.split('/').some((part) => part === '..' || part === '')) throw new Error('Đường dẫn file không hợp lệ')
    const full = resolve(this.localRoot, clean)
    const rel = relative(this.localRoot, full)
    if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) throw new Error('Đường dẫn file không hợp lệ')
    return full
  }
}
