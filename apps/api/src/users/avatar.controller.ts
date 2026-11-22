import { Body, Controller, Delete, Get, Header, HttpCode, Inject, Param, ParseUUIDPipe, Post, StreamableFile } from '@nestjs/common'
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, type AccountAvatarDto } from '@toeic/shared'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { AppException } from '../common/app-exception'
import { CurrentUser, type AuthUser } from '../common/decorators'
import { DB, type Db } from '../db/database.module'
import { accountAvatars, users } from '../db/schema'
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
