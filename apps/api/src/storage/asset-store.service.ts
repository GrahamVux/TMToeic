import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq, inArray } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { DB, type Db } from '../db/database.module'
import { assets, exams } from '../db/schema'
import { StorageService } from './storage.service'

export type StoreAssetInput = {
  objectKey: string
  body: Buffer
  mimeType: string
  originalFilename?: string
  uploadedBy?: string | null
}

/** The file is on record as FAILED; its bytes did not reach object storage. */
export class AssetPushError extends Error {
  constructor(readonly assetId: string) {
    super('Could not push the file to object storage')
  }
}

/**
 * The one path every uploaded file takes: record it in the database, then push the bytes to object storage.
 * The row is PENDING until the push is confirmed, so the database always knows about a file before the bucket holds it.
 */
@Injectable()
export class AssetStoreService {
  private readonly logger = new Logger('AssetStore')

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  get enabled(): boolean {
    return this.storage.enabled
  }

  /** Returns the id of the STORED asset. Throws AssetPushError when the push fails. */
  async store(input: StoreAssetInput): Promise<string> {
    if (!this.storage.enabled) throw new Error('Object storage is not configured')
    const [row] = await this.db
      .insert(assets)
      .values({
        provider: 'CLOUDFLARE_R2',
        bucket: this.storage.bucket,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        sizeBytes: input.body.length,
        checksum: createHash('sha256').update(input.body).digest('hex'),
        originalFilename: cleanFilename(input.originalFilename),
        status: 'PENDING',
        uploadedBy: input.uploadedBy ?? null,
      })
      .returning({ id: assets.id })

    try {
      await this.storage.putObject(input.objectKey, input.body, input.mimeType)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      this.logger.error(`Push failed for ${input.objectKey}: ${reason}`)
      await this.db.update(assets).set({ status: 'FAILED', error: reason.slice(0, 500) }).where(eq(assets.id, row.id))
      throw new AssetPushError(row.id)
    }

    await this.db.update(assets).set({ status: 'STORED', storedAt: new Date() }).where(eq(assets.id, row.id))
    return row.id
  }

  /**
   * Drop file records that belonged to a removed exam, and their objects in the bucket.
   * A file still used somewhere else is left in place.
   */
  async discard(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)]
    if (!unique.length) return
    const rows = await this.db.select().from(assets).where(inArray(assets.id, unique))
    for (const row of rows) {
      if (row.provider === 'CLOUDFLARE_R2') {
        try {
          await this.storage.deleteObject(row.objectKey, row.bucket)
        } catch (err) {
          this.logger.error(`Could not remove ${row.objectKey}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      try {
        await this.db.delete(assets).where(eq(assets.id, row.id))
      } catch (err) {
        this.logger.warn(`Kept asset ${row.id} because it is still in use: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  /**
   * Put the exam file in object storage and return the asset id. The database row stores the path, not the bytes.
   * Throws when the bucket is missing or the push does not finish.
   */
  async saveExamSource(examId: string, source: unknown, uploadedBy: string): Promise<string> {
    if (!this.storage.enabled) throw new Error('Object storage is not configured')
    const objectKey = `exams/${examId}/source/${Date.now()}.json`
    try {
      const assetId = await this.store({
        objectKey,
        body: Buffer.from(JSON.stringify(source), 'utf8'),
        mimeType: 'application/json',
        originalFilename: `${examId}.json`,
        uploadedBy,
      })
      await this.db.update(exams).set({ sourceAssetId: assetId }).where(eq(exams.id, examId))
      return assetId
    } catch (err) {
      if (err instanceof AssetPushError) await this.discard([err.assetId]).catch(() => undefined)
      throw err
    }
  }

  /**
   * Same copy as saveExamSource, but a missing bucket or a failed push only skips the file.
   * Used for homework typed in the form, which is already saved as questions.
   */
  async archiveExamSource(examId: string, source: unknown, uploadedBy: string): Promise<string | null> {
    try {
      return await this.saveExamSource(examId, source, uploadedBy)
    } catch (err) {
      if (!(err instanceof AssetPushError) && !(err instanceof Error && err.message === 'Object storage is not configured')) {
        this.logger.error(`Could not record the source of exam ${examId}: ${err instanceof Error ? err.message : String(err)}`)
      }
      return null
    }
  }
}

function cleanFilename(raw: string | undefined): string {
  return (raw ?? '').replace(/[/\\]/g, '').slice(0, 120) || 'file'
}
