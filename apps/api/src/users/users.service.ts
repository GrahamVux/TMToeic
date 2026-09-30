import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import type {
  CreateStaffInput,
  CreateStudentInput,
  CredentialsIssuedDto,
  ListUsersQuery,
  Paginated,
  StudentStatsDto,
  UserDto,
  UserStatus,
} from '@toeic/shared'
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AuthService } from '../auth/auth.service'
import { PasswordService } from '../auth/password.service'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { APP_CONFIG, type AppConfig } from '../config/app-config'
import { DB, type Db } from '../db/database.module'
import { users, type UserRow } from '../db/schema'
import { toUserDto } from './user.mapper'

type Actor = Pick<AuthUser, 'id' | 'role'> & { ip?: string }

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`)

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger('Users')

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly passwords: PasswordService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  /** Create the first ADMIN if none exists (no self-registration anywhere in the system). */
  async onModuleInit() {
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.role, 'ADMIN')).limit(1)
    if (existing) return
    if (!this.config.bootstrapAdminPassword) {
      this.logger.warn('No ADMIN exists and BOOTSTRAP_ADMIN_PASSWORD is not set — set it to create the first admin account.')
      return
    }
    const [admin] = await this.db
      .insert(users)
      .values({
        username: this.config.bootstrapAdminUsername,
        passwordHash: await this.passwords.hash(this.config.bootstrapAdminPassword),
        fullName: 'Quản trị viên',
        role: 'ADMIN',
        mustChangePassword: true,
      })
      .returning()
    await this.audit.log({ action: 'USER_BOOTSTRAP_ADMIN', entityType: 'user', entityId: admin.id })
    this.logger.warn(`Created bootstrap admin "${admin.username}" — password must be changed at first login.`)
  }

  // ---------------------------------------------------------------- create
  async createStudent(actor: Actor, input: CreateStudentInput): Promise<CredentialsIssuedDto> {
    const temporaryPassword = this.passwords.generateTemporaryPassword()
    const passwordHash = await this.passwords.hash(temporaryPassword)
    try {
      const row = await this.db.transaction(async (tx) => {
        // node-postgres and PGlite both return `{ rows }`
        const seq = (await tx.execute(sql`select nextval('student_code_seq') as n`)) as unknown as { rows: Array<{ n: string | number }> }
        const n = seq.rows[0].n
        const studentCode = `${this.config.studentCodePrefix}-${n}`
        const [created] = await tx
          .insert(users)
          .values({
            username: studentCode.toLowerCase(),
            studentCode,
            passwordHash,
            fullName: input.fullName,
            email: input.email ?? null,
            phone: input.phone ?? null,
            targetScore: input.targetScore ?? null,
            role: 'STUDENT',
            mustChangePassword: true,
            createdBy: actor.id,
          })
          .returning()
        return created
      })
      await this.audit.log({ action: 'USER_CREATED', actorId: actor.id, entityType: 'user', entityId: row.id, metadata: { role: 'STUDENT', studentCode: row.studentCode }, ip: actor.ip })
      return { user: toUserDto(row), temporaryPassword }
    } catch (err) {
      if (isUniqueViolation(err)) throw AppException.conflict('Email đã được sử dụng bởi tài khoản khác')
      throw err
    }
  }

  async createStaff(actor: Actor, input: CreateStaffInput): Promise<CredentialsIssuedDto> {
    const temporaryPassword = this.passwords.generateTemporaryPassword()
    const passwordHash = await this.passwords.hash(temporaryPassword)
    try {
      const [row] = await this.db
        .insert(users)
        .values({
          username: input.username,
          passwordHash,
          fullName: input.fullName,
          email: input.email ?? null,
          role: input.role,
          mustChangePassword: true,
          createdBy: actor.id,
        })
        .returning()
      await this.audit.log({ action: 'USER_CREATED', actorId: actor.id, entityType: 'user', entityId: row.id, metadata: { role: row.role }, ip: actor.ip })
      return { user: toUserDto(row), temporaryPassword }
    } catch (err) {
      if (isUniqueViolation(err)) throw AppException.conflict('Tên đăng nhập hoặc email đã tồn tại')
      throw err
    }
  }

  // ---------------------------------------------------------------- read
  async list(actor: Actor, query: ListUsersQuery): Promise<Paginated<UserDto>> {
    const conditions: SQL[] = []
    // Teachers only see students; admins see everyone.
    const role = actor.role === 'TEACHER' ? 'STUDENT' : query.role
    if (role) conditions.push(eq(users.role, role))
    if (query.status) conditions.push(eq(users.status, query.status))
    if (query.q) {
      const like = `%${escapeLike(query.q)}%`
      conditions.push(or(ilike(users.fullName, like), ilike(users.username, like), ilike(users.studentCode, like))!)
    }
    const where = conditions.length ? and(...conditions) : undefined

    const [{ total }] = await this.db.select({ total: sql<number>`count(*)::int` }).from(users).where(where)
    const rows = await this.db
      .select()
      .from(users)
      .where(where)
      .orderBy(asc(users.role), desc(users.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)

    return { items: rows.map(toUserDto), total, page: query.page, pageSize: query.pageSize }
  }

  async studentStats(): Promise<StudentStatsDto> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${users.status} = 'ACTIVE')::int`,
        disabled: sql<number>`count(*) filter (where ${users.status} = 'DISABLED')::int`,
        pendingFirstLogin: sql<number>`count(*) filter (where ${users.mustChangePassword})::int`,
      })
      .from(users)
      .where(eq(users.role, 'STUDENT'))
    return row
  }

  async get(actor: Actor, id: string): Promise<UserDto> {
    return toUserDto(await this.getManageable(actor, id))
  }

  // ---------------------------------------------------------------- mutate
  async resetPassword(actor: Actor, id: string): Promise<CredentialsIssuedDto> {
    const target = await this.getManageable(actor, id)
    const temporaryPassword = this.passwords.generateTemporaryPassword()
    const [row] = await this.db
      .update(users)
      .set({
        passwordHash: await this.passwords.hash(temporaryPassword),
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.id))
      .returning()
    await this.auth.revokeAllSessions(target.id, 'PASSWORD_RESET')
    await this.audit.log({ action: 'USER_PASSWORD_RESET', actorId: actor.id, entityType: 'user', entityId: target.id, ip: actor.ip })
    return { user: toUserDto(row), temporaryPassword }
  }

  async setStatus(actor: Actor, id: string, status: UserStatus): Promise<UserDto> {
    if (actor.id === id) throw AppException.badRequest('Bạn không thể tự thay đổi trạng thái tài khoản của mình')
    const target = await this.getManageable(actor, id)
    const [row] = await this.db
      .update(users)
      .set({ status, updatedAt: new Date(), ...(status === 'ACTIVE' ? { failedLoginCount: 0, lockedUntil: null } : {}) })
      .where(eq(users.id, target.id))
      .returning()
    if (status === 'DISABLED') await this.auth.revokeAllSessions(target.id, 'ACCOUNT_DISABLED')
    await this.audit.log({
      action: status === 'DISABLED' ? 'USER_DISABLED' : 'USER_ENABLED',
      actorId: actor.id,
      entityType: 'user',
      entityId: target.id,
      ip: actor.ip,
    })
    return toUserDto(row)
  }

  /** Load a user the actor is allowed to manage: admins → anyone, teachers → students only. */
  private async getManageable(actor: Actor, id: string): Promise<UserRow> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    // Same 404 for "missing" and "not yours" so teachers can't probe for staff accounts.
    if (!row || (actor.role === 'TEACHER' && row.role !== 'STUDENT')) throw AppException.notFound('Không tìm thấy người dùng')
    return row
  }
}
