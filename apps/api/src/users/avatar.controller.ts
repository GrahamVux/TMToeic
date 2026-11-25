import { Body, Controller, Delete, Get, Header, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, StreamableFile } from '@nestjs/common'
import {
  AVATAR_FRAME_IDS,
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  effectiveAvatarFrame,
  equipFrameSchema,
  isFreeFrame,
  type AccountAvatarDto,
  type AccountFrameDto,
  type AccountRewardsDto,
  type PointLedgerSource,
} from '@toeic/shared'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import sharp from 'sharp'
import { AppException } from '../common/app-exception'
import { CurrentUser, type AuthUser } from '../common/decorators'
import { parse } from '../common/zod'
import { DB, type Db } from '../db/database.module'
import { accountAvatars, rewardPointLedger, userAvatarFrames, users } from '../db/schema'
import { API_PREFIX } from '../setup'

@Controller()
export class AvatarController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('avatars/:version')
  @Header('Cache-Control', 'private, max-age=3600')
  async image(@Param('version', ParseUUIDPipe) version: string) {
    const [row] = await this.db.select({ data: accountAvatars.thumbnail }).from(accountAvatars).where(eq(accountAvatars.version, version))
    if (!row) throw AppException.notFound('Ảnh đại diện đã được thay hoặc gỡ.')
    return new StreamableFile(row.data, { type: 'image/webp' })
  }

  @Post('me/avatar')
  @HttpCode(200)
  async upload(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    if (!Buffer.isBuffer(body) || !body.length || body.length > AVATAR_MAX_BYTES) {
      throw AppException.badRequest('Chọn ảnh JPG, PNG hoặc WebP tối đa 4 MB.')
    }
    const image = sharp(body, { limitInputPixels: 32_000_000 })
    let thumbnail: Buffer
    try {
      const { format } = await image.metadata()
      if (!AVATAR_MIME_TYPES.some((mime) => mime === `image/${format}`)) throw new Error('format')
      thumbnail = await image.rotate().resize(192, 192, { fit: 'cover' }).webp({ quality: 82 }).toBuffer()
    } catch {
      throw AppException.badRequest('Không đọc được ảnh. Hãy chọn ảnh JPG, PNG hoặc WebP tối đa 32 megapixel.')
    }
    return this.replace(user.id, thumbnail)
  }

  @Delete('me/avatar')
  remove(@CurrentUser() user: AuthUser) {
    return this.replace(user.id, null)
  }

  @Get('me/rewards')
  async rewards(@CurrentUser() user: AuthUser): Promise<AccountRewardsDto> {
    const now = new Date()
    const [row] = await this.db
      .select({
        role: users.role,
        avatarFrame: users.avatarFrame,
        avatarFrameExpiresAt: users.avatarFrameExpiresAt,
        rewardPoints: users.rewardPoints,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    if (!row) throw AppException.notFound('Không tìm thấy tài khoản')

    const ledgerRows = await this.db
      .select({
        id: rewardPointLedger.id,
        delta: rewardPointLedger.delta,
        reason: rewardPointLedger.reason,
        source: rewardPointLedger.source,
        createdAt: rewardPointLedger.createdAt,
      })
      .from(rewardPointLedger)
      .where(eq(rewardPointLedger.userId, user.id))
      .orderBy(desc(rewardPointLedger.createdAt))
      .limit(30)

    let unlockedFrames: AccountRewardsDto['unlockedFrames']
    if (row.role === 'ADMIN' || row.role === 'TEACHER') {
      const epoch = new Date(0).toISOString()
      unlockedFrames = AVATAR_FRAME_IDS.map((frameId) => ({ frameId, unlockedAt: epoch, expiresAt: null }))
    } else {
      const earned = await this.db
        .select({
          frameId: userAvatarFrames.frameId,
          unlockedAt: userAvatarFrames.unlockedAt,
          expiresAt: userAvatarFrames.expiresAt,
        })
        .from(userAvatarFrames)
        .where(
          and(
            eq(userAvatarFrames.userId, user.id),
            or(isNull(userAvatarFrames.expiresAt), gt(userAvatarFrames.expiresAt, now)),
          ),
        )
      const byId = new Map(earned.map((f) => [f.frameId, f]))
      const epoch = new Date(0).toISOString()
      unlockedFrames = AVATAR_FRAME_IDS.flatMap((frameId) => {
        const hit = byId.get(frameId)
        if (hit) {
          return [{ frameId, unlockedAt: hit.unlockedAt.toISOString(), expiresAt: hit.expiresAt?.toISOString() ?? null }]
        }
        if (isFreeFrame(frameId)) {
          return [{ frameId, unlockedAt: epoch, expiresAt: null }]
        }
        return []
      })
    }

    return {
      rewardPoints: row.rewardPoints,
      avatarFrame: effectiveAvatarFrame(row.role, row.avatarFrame, row.avatarFrameExpiresAt, now),
      unlockedFrames,
      ledger: ledgerRows.map((l) => ({
        id: l.id,
        delta: l.delta,
        reason: l.reason,
        source: l.source as PointLedgerSource,
        createdAt: l.createdAt.toISOString(),
      })),
    }
  }

  @Put('me/avatar-frame')
  async equipFrame(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<AccountFrameDto> {
    const { frameId } = parse(equipFrameSchema, body)
    const now = new Date()
    let expiresAt: Date | null = null

    if (user.role === 'STUDENT' && !isFreeFrame(frameId)) {
      const [unlock] = await this.db
        .select({ expiresAt: userAvatarFrames.expiresAt })
        .from(userAvatarFrames)
        .where(
          and(
            eq(userAvatarFrames.userId, user.id),
            eq(userAvatarFrames.frameId, frameId),
            or(isNull(userAvatarFrames.expiresAt), gt(userAvatarFrames.expiresAt, now)),
          ),
        )
        .limit(1)
      if (!unlock) throw AppException.forbidden('Bạn chưa mở khóa khung viền này hoặc khung đã hết hạn.')
      expiresAt = unlock.expiresAt
    }

    await this.db
      .update(users)
      .set({ avatarFrame: frameId, avatarFrameExpiresAt: expiresAt, updatedAt: now })
      .where(eq(users.id, user.id))

    return { id: user.id, avatarFrame: frameId }
  }

  private async replace(id: string, thumbnail: Buffer | null): Promise<AccountAvatarDto> {
    const version = randomUUID()
    const avatarUrl = thumbnail ? `/${API_PREFIX}/avatars/${version}` : null
    await this.db.transaction(async (tx) => {
      // Lock the account first so simultaneous uploads and removals agree on the current version.
      await tx.update(users).set({ avatarUrl, updatedAt: new Date() }).where(eq(users.id, id))
      if (thumbnail) {
        await tx.insert(accountAvatars).values({ userId: id, version, thumbnail })
          .onConflictDoUpdate({ target: accountAvatars.userId, set: { version, thumbnail } })
      } else {
        await tx.delete(accountAvatars).where(eq(accountAvatars.userId, id))
      }
    })
    return { id, avatarUrl }
  }
}
