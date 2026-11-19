import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ERROR_CODES, teacherGrants, type SessionDto } from '@toeic/shared'
import { and, eq, gt, isNull, ne, or, sql } from 'drizzle-orm'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { APP_CONFIG, type AppConfig } from '../config/app-config'
import { DB, type Db } from '../db/database.module'
import { sessions, users, type SessionRow, type UserRow } from '../db/schema'
import { toUserDto } from '../users/user.mapper'
import { PasswordService } from './password.service'

export type ClientContext = { ip?: string; userAgent?: string }
export type Tokens = { accessToken: string; refreshToken: string }
export type AuthResult = { session: SessionDto; tokens: Tokens }

type AccessPayload = { sub: string; sid: string }

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

/** Compare two secrets without leaking which one was longer. */
function codesMatch(given: string, expected: string) {
  return safeEqual(sha256(given), sha256(expected))
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- login
  async login(identifier: string, password: string, ctx: ClientContext): Promise<AuthResult> {
    const id = identifier.trim()
    const [user] = await this.db
      .select()
      .from(users)
      .where(or(eq(users.username, id.toLowerCase()), eq(users.studentCode, id.toUpperCase())))
      .limit(1)

    if (!user) {
      await this.passwords.verifyDummy(password)
      await this.audit.log({ action: 'AUTH_LOGIN_FAILED', metadata: { identifier: id.slice(0, 64), reason: 'UNKNOWN_USER' }, ip: ctx.ip })
      throw this.invalidCredentials()
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.log({ action: 'AUTH_LOGIN_BLOCKED', actorId: user.id, metadata: { reason: 'LOCKED' }, ip: ctx.ip })
      throw new AppException(
        ERROR_CODES.TOO_MANY_REQUESTS,
        `Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${this.config.loginLockoutMinutes} phút hoặc liên hệ giáo viên.`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const ok = await this.passwords.verify(user.passwordHash, password)
    if (!ok) {
      await this.registerFailure(user, ctx)
      throw this.invalidCredentials()
    }

    if (user.status !== 'ACTIVE') {
      await this.audit.log({ action: 'AUTH_LOGIN_BLOCKED', actorId: user.id, metadata: { reason: 'DISABLED' }, ip: ctx.ip })
      throw AppException.forbidden('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ giáo viên.', ERROR_CODES.ACCOUNT_DISABLED)
    }

    const now = new Date()
    const [updated] = await this.db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: now })
      .where(eq(users.id, user.id))
      .returning()

    const { session, refreshToken } = await this.createSession(user.id, ctx)
    await this.audit.log({ action: 'AUTH_LOGIN', actorId: user.id, entityType: 'session', entityId: session.id, ip: ctx.ip })
    return { session: { user: toUserDto(updated) }, tokens: { accessToken: await this.signAccess(user.id, session.id), refreshToken } }
  }

  private async registerFailure(user: UserRow, ctx: ClientContext, reason = 'BAD_PASSWORD') {
    const count = user.failedLoginCount + 1
    const lock = count >= this.config.loginLockoutThreshold
    await this.db
      .update(users)
      .set({
        failedLoginCount: lock ? 0 : count,
        lockedUntil: lock ? new Date(Date.now() + this.config.loginLockoutMinutes * 60_000) : user.lockedUntil,
      })
      .where(eq(users.id, user.id))
    await this.audit.log({
      action: lock ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_LOGIN_FAILED',
      actorId: user.id,
      metadata: { reason, attempts: count },
      ip: ctx.ip,
    })
  }

  private invalidCredentials() {
    return new AppException(ERROR_CODES.INVALID_CREDENTIALS, 'Sai mã học viên / tên đăng nhập hoặc mật khẩu', HttpStatus.UNAUTHORIZED)
  }

  // ---------------------------------------------------------------- sessions & tokens
  private signAccess(userId: string, sessionId: string): Promise<string> {
    const payload: AccessPayload = { sub: userId, sid: sessionId }
    return this.jwt.signAsync(payload, { expiresIn: this.config.accessTtlSeconds })
  }

  private newRefreshSecret() {
    return randomBytes(32).toString('base64url')
  }

  private refreshExpiry() {
    return new Date(Date.now() + this.config.refreshTtlDays * 24 * 3600 * 1000)
  }

  private async createSession(userId: string, ctx: ClientContext) {
    const id = randomUUID()
    const secret = this.newRefreshSecret()
    const [session] = await this.db
      .insert(sessions)
      .values({
        id,
        userId,
        refreshTokenHash: sha256(secret),
        userAgent: ctx.userAgent?.slice(0, 255),
        ip: ctx.ip,
        expiresAt: this.refreshExpiry(),
      })
      .returning()
    return { session, refreshToken: `${id}.${secret}` }
  }

  /** Rotate refresh token (single use). Reuse of an old token revokes the whole session. */
  async refresh(refreshToken: string | undefined, ctx: ClientContext): Promise<AuthResult> {
    const expired = () => AppException.unauthenticated('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', ERROR_CODES.SESSION_EXPIRED)
    const parsed = this.parseRefreshToken(refreshToken)
    if (!parsed) throw expired()

    const [session] = await this.db.select().from(sessions).where(eq(sessions.id, parsed.sessionId)).limit(1)
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw expired()

    const presented = sha256(parsed.secret)
    if (session.previousTokenHash && safeEqual(session.previousTokenHash, presented)) {
      await this.revokeSessionRow(session, 'REUSE_DETECTED')
      await this.audit.log({ action: 'AUTH_REFRESH_REUSE', actorId: session.userId, entityType: 'session', entityId: session.id, ip: ctx.ip })
      throw expired()
    }
    if (!safeEqual(session.refreshTokenHash, presented)) throw expired()

    const [user] = await this.db.select().from(users).where(eq(users.id, session.userId)).limit(1)
    if (!user || user.status !== 'ACTIVE') {
      await this.revokeSessionRow(session, 'USER_INACTIVE')
      throw expired()
    }

    const secret = this.newRefreshSecret()
    // Compare-and-swap: only one concurrent refresh can win.
    const rotated = await this.db
      .update(sessions)
      .set({
        refreshTokenHash: sha256(secret),
        previousTokenHash: session.refreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt: this.refreshExpiry(),
        ip: ctx.ip ?? session.ip,
      })
      .where(and(eq(sessions.id, session.id), eq(sessions.refreshTokenHash, session.refreshTokenHash), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id })
    if (rotated.length === 0) throw expired()

    return {
      session: { user: toUserDto(user) },
      tokens: { accessToken: await this.signAccess(user.id, session.id), refreshToken: `${session.id}.${secret}` },
    }
  }

  private parseRefreshToken(token: string | undefined) {
    if (!token) return null
    const dot = token.indexOf('.')
    if (dot !== 36) return null // uuid length
    const sessionId = token.slice(0, dot)
    const secret = token.slice(dot + 1)
    if (!/^[0-9a-f-]{36}$/i.test(sessionId) || secret.length < 20 || secret.length > 128) return null
    return { sessionId, secret }
  }

  private async revokeSessionRow(session: SessionRow, reason: string) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt)))
  }

  async logout(refreshToken: string | undefined, ctx: ClientContext) {
    const parsed = this.parseRefreshToken(refreshToken)
    if (!parsed) return
    const [session] = await this.db.select().from(sessions).where(eq(sessions.id, parsed.sessionId)).limit(1)
    if (!session) return
    const presented = sha256(parsed.secret)
    const matches =
      safeEqual(session.refreshTokenHash, presented) || (session.previousTokenHash ? safeEqual(session.previousTokenHash, presented) : false)
    if (!matches) return
    await this.revokeSessionRow(session, 'LOGOUT')
    await this.audit.log({ action: 'AUTH_LOGOUT', actorId: session.userId, entityType: 'session', entityId: session.id, ip: ctx.ip })
  }

  /** Revoke every active session of a user (optionally keeping one). Used by password change/reset and disable. */
  async revokeAllSessions(userId: string, reason: string, exceptSessionId?: string) {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), exceptSessionId ? ne(sessions.id, exceptSessionId) : undefined))
  }

  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(sql`${sessions.lastUsedAt} desc`)
    return rows.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      current: s.id === currentSessionId,
    }))
  }

  async revokeOwnSession(userId: string, sessionId: string, actor: ClientContext) {
    const res = await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: 'USER_REVOKED' })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id })
    if (res.length === 0) throw AppException.notFound('Không tìm thấy phiên đăng nhập')
    await this.audit.log({ action: 'AUTH_SESSION_REVOKED', actorId: userId, entityType: 'session', entityId: sessionId, ip: actor.ip })
  }

  // ---------------------------------------------------------------- password
  async changePassword(user: AuthUser, currentPassword: string, newPassword: string, ctx: ClientContext): Promise<AuthResult> {
    const [row] = await this.db.select().from(users).where(eq(users.id, user.id)).limit(1)
    if (!row) throw AppException.unauthenticated()

    if (!(await this.passwords.verify(row.passwordHash, currentPassword))) {
      await this.audit.log({ action: 'AUTH_PASSWORD_CHANGE_FAILED', actorId: row.id, ip: ctx.ip })
      throw AppException.badRequest('Mật khẩu hiện tại không đúng', { fields: { currentPassword: 'Mật khẩu hiện tại không đúng' } })
    }

    const passwordHash = await this.passwords.hash(newPassword)
    const [updated] = await this.db
      .update(users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, row.id))
      .returning()

    // Sign out every other device, keep (and rotate) the current one.
    await this.revokeAllSessions(row.id, 'PASSWORD_CHANGED', user.sessionId)
    const secret = this.newRefreshSecret()
    await this.db
      .update(sessions)
      .set({ refreshTokenHash: sha256(secret), previousTokenHash: null, lastUsedAt: new Date(), expiresAt: this.refreshExpiry() })
      .where(eq(sessions.id, user.sessionId))

    await this.audit.log({ action: 'AUTH_PASSWORD_CHANGED', actorId: row.id, entityType: 'user', entityId: row.id, ip: ctx.ip })
    return {
      session: { user: toUserDto(updated) },
      tokens: { accessToken: await this.signAccess(row.id, user.sessionId), refreshToken: `${user.sessionId}.${secret}` },
    }
  }

  /**
   * Admin forgot the password. The recovery code stands in for the current password.
   * A wrong code, an unknown account and a non-admin account all get the same answer.
   */
  async recoverAdmin(identifier: string, recoveryCode: string, newPassword: string, ctx: ClientContext): Promise<AuthResult> {
    const expected = this.config.adminRecoveryCode
    if (!expected) throw AppException.badRequest('Chưa cấu hình mã khôi phục quản trị.')

    const id = identifier.trim()
    const [user] = await this.db
      .select()
      .from(users)
      .where(or(eq(users.username, id.toLowerCase()), eq(users.studentCode, id.toUpperCase())))
      .limit(1)
    const codeOk = codesMatch(recoveryCode.trim(), expected)
    const admin = user?.role === 'ADMIN' ? user : undefined

    if (!admin) {
      await this.audit.log({
        action: 'AUTH_ADMIN_RECOVERY_FAILED',
        actorId: user?.id,
        metadata: { reason: user ? 'NOT_ADMIN' : 'UNKNOWN_USER' },
        ip: ctx.ip,
      })
      throw this.badRecoveryCode()
    }

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      await this.audit.log({ action: 'AUTH_LOGIN_BLOCKED', actorId: admin.id, metadata: { reason: 'LOCKED' }, ip: ctx.ip })
      throw new AppException(
        ERROR_CODES.TOO_MANY_REQUESTS,
        `Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${this.config.loginLockoutMinutes} phút hoặc liên hệ giáo viên.`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    if (!codeOk) {
      await this.registerFailure(admin, ctx, 'BAD_RECOVERY_CODE')
      throw this.badRecoveryCode()
    }

    if (admin.status !== 'ACTIVE') {
      await this.audit.log({ action: 'AUTH_LOGIN_BLOCKED', actorId: admin.id, metadata: { reason: 'DISABLED' }, ip: ctx.ip })
      throw AppException.forbidden('Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ giáo viên.', ERROR_CODES.ACCOUNT_DISABLED)
    }

    if (await this.passwords.verify(admin.passwordHash, newPassword)) {
      throw AppException.badRequest('Mật khẩu mới phải khác mật khẩu hiện tại', { fields: { newPassword: 'Mật khẩu mới phải khác mật khẩu hiện tại' } })
    }

    const passwordHash = await this.passwords.hash(newPassword)
    const now = new Date()
    const [updated] = await this.db
      .update(users)
      .set({ passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null, lastLoginAt: now, updatedAt: now })
      .where(eq(users.id, admin.id))
      .returning()

    await this.revokeAllSessions(admin.id, 'PASSWORD_RECOVERED')
    const { session, refreshToken } = await this.createSession(admin.id, ctx)
    await this.audit.log({ action: 'AUTH_ADMIN_RECOVERED', actorId: admin.id, entityType: 'user', entityId: admin.id, ip: ctx.ip })
    return { session: { user: toUserDto(updated) }, tokens: { accessToken: await this.signAccess(admin.id, session.id), refreshToken } }
  }

  private badRecoveryCode() {
    return new AppException(ERROR_CODES.INVALID_CREDENTIALS, 'Mã khôi phục không đúng.', HttpStatus.UNAUTHORIZED)
  }

  // ---------------------------------------------------------------- request authentication
  /** Verify the access token and load the *current* user/session state from the DB (role, disabled, revoked). */
  async authenticate(accessToken: string): Promise<{ user: AuthUser; row: UserRow }> {
    let payload: AccessPayload
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(accessToken)
    } catch (err) {
      const expired = (err as Error).name === 'TokenExpiredError'
      throw AppException.unauthenticated(
        expired ? 'Phiên đăng nhập đã hết hạn' : 'Phiên đăng nhập không hợp lệ',
        expired ? ERROR_CODES.SESSION_EXPIRED : ERROR_CODES.UNAUTHENTICATED,
      )
    }

    const [found] = await this.db
      .select({ user: users, session: sessions })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, payload.sid), eq(users.id, payload.sub)))
      .limit(1)

    if (!found || found.session.revokedAt || found.session.expiresAt <= new Date()) {
      throw AppException.unauthenticated('Phiên đăng nhập đã hết hạn', ERROR_CODES.SESSION_EXPIRED)
    }
    if (found.user.status !== 'ACTIVE') {
      throw AppException.forbidden('Tài khoản đã bị vô hiệu hóa', ERROR_CODES.ACCOUNT_DISABLED)
    }
    return {
      row: found.user,
      user: {
        id: found.user.id,
        role: found.user.role,
        sessionId: found.session.id,
        mustChangePassword: found.user.mustChangePassword,
        permissions: teacherGrants(found.user.role, {
          createStudents: found.user.permCreateStudents,
          manageAssignments: found.user.permManageAssignments,
          viewProgress: found.user.permViewProgress,
        }),
      },
    }
  }

  /** The account an admin previews. Teachers and students only; the preview never reaches another admin. */
  async viewAsTarget(admin: AuthUser, targetId: string): Promise<{ user: AuthUser; row: UserRow }> {
    if (admin.role !== 'ADMIN') throw AppException.forbidden()
    const [row] = await this.db.select().from(users).where(eq(users.id, targetId)).limit(1)
    if (!row) throw AppException.notFound('Không tìm thấy tài khoản cần xem thử')
    if (row.role === 'ADMIN') throw AppException.forbidden('Không thể xem thử tài khoản quản trị viên')
    return {
      row,
      user: {
        id: row.id,
        role: row.role,
        sessionId: admin.sessionId,
        // The previewed account's temporary password must not lock the admin out of its screens.
        mustChangePassword: false,
        permissions: teacherGrants(row.role, {
          createStudents: row.permCreateStudents,
          manageAssignments: row.permManageAssignments,
          viewProgress: row.permViewProgress,
        }),
        viewingAsBy: admin.id,
      },
    }
  }

  /** The session the web shows while previewing: the previewed account plus the admin who is looking. */
  async previewSession(admin: UserRow, target: UserRow): Promise<SessionDto> {
    return { user: { ...toUserDto(target), mustChangePassword: false }, viewingAs: { admin: toUserDto(admin) } }
  }

  async startViewAs(admin: AuthUser, targetId: string, ctx: ClientContext): Promise<SessionDto> {
    const { row } = await this.viewAsTarget(admin, targetId)
    await this.audit.log({
      action: 'ADMIN_VIEW_AS',
      actorId: admin.id,
      entityType: 'user',
      entityId: row.id,
      metadata: { role: row.role },
      ip: ctx.ip,
    })
    return this.previewSession(await this.getUserRow(admin.id), row)
  }

  async getUserRow(id: string): Promise<UserRow> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!row) throw AppException.unauthenticated()
    return row
  }
}
