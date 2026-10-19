import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import {
  DEFAULT_NEW_ACCOUNT_PASSWORD,
  teacherGrants,
  type CreateStaffInput,
  type CreateStudentInput,
  type CredentialsIssuedDto,
  type ListUsersQuery,
  type Paginated,
  type StudentStatsDto,
  type TeacherPermissions,
  type UpdateTeacherPermissionsInput,
  type UserDto,
  type UserStatus,
} from '@toeic/shared'
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AuthService } from '../auth/auth.service'
import { PasswordService } from '../auth/password.service'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { APP_CONFIG, type AppConfig } from '../config/app-config'
import { DB, type Db } from '../db/database.module'
import { classMembers, classTeachers, classes, users, type UserRow } from '../db/schema'
import { readStudentSheet, StudentSheetError, studentResultSheet, studentTemplate } from './student-sheet'
import { toUserDto } from './user.mapper'

type Actor = Pick<AuthUser, 'id' | 'role' | 'permissions'> & { ip?: string }

const MAX_STUDENT_XLSX_BYTES = 8 * 1024 * 1024

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
    this.assertGrant(actor, 'createStudents')
    const passwordHash = await this.passwords.hash(DEFAULT_NEW_ACCOUNT_PASSWORD)
    const classId = await this.resolveClassId(actor, input.classId)
    try {
      const row = await this.insertStudent(actor, input, passwordHash, classId)
      await this.audit.log({ action: 'USER_CREATED', actorId: actor.id, entityType: 'user', entityId: row.id, metadata: { role: 'STUDENT', studentCode: row.studentCode }, ip: actor.ip })
      return { user: await this.withClass(row), temporaryPassword: DEFAULT_NEW_ACCOUNT_PASSWORD }
    } catch (err) {
      if (isUniqueViolation(err)) throw AppException.conflict('Email đã được sử dụng bởi tài khoản khác')
      throw err
    }
  }

  template(actor: Actor): Promise<Buffer> {
    this.assertGrant(actor, 'createStudents')
    return studentTemplate()
  }

  async importStudents(actor: Actor, raw: unknown, classId: string | undefined): Promise<{ file: Buffer; created: number; skipped: number }> {
    this.assertGrant(actor, 'createStudents')
    const roomId = await this.resolveClassId(actor, classId)
    if (!Buffer.isBuffer(raw) || raw.length === 0) throw AppException.badRequest('Hãy chọn một file .xlsx.')
    if (raw.length > MAX_STUDENT_XLSX_BYTES) throw AppException.badRequest('File Excel quá lớn (tối đa 8MB).')
    let parsed: Awaited<ReturnType<typeof readStudentSheet>>
    try {
      parsed = await readStudentSheet(raw)
    } catch (error) {
      if (error instanceof StudentSheetError) throw AppException.badRequest(error.message)
      throw AppException.badRequest('Không đọc được file Excel. Hãy dùng định dạng .xlsx.')
    }

    const passwordHash = await this.passwords.hash(DEFAULT_NEW_ACCOUNT_PASSWORD)
    const seen = new Set<string>()
    const results: Array<{ fullName: string; phone: string; studentCode: string; username: string; password: string; note: string }> = []
    let created = 0
    for (const row of parsed) {
      if (seen.has(row.phone)) {
        results.push({ ...row, studentCode: '', username: '', password: '', note: 'Trùng số điện thoại trong file' })
        continue
      }
      seen.add(row.phone)
      try {
        const user = await this.insertStudent(actor, { fullName: row.fullName, phone: row.phone }, passwordHash, roomId)
        created++
        results.push({
          fullName: row.fullName,
          phone: row.phone,
          studentCode: user.studentCode ?? '',
          username: user.username,
          password: DEFAULT_NEW_ACCOUNT_PASSWORD,
          note: 'Đã tạo',
        })
        await this.audit.log({
          action: 'USER_CREATED',
          actorId: actor.id,
          entityType: 'user',
          entityId: user.id,
          metadata: { role: 'STUDENT', studentCode: user.studentCode, via: 'excel' },
          ip: actor.ip,
        })
      } catch (err) {
        const note = isUniqueViolation(err) ? 'Không tạo được vì dữ liệu bị trùng' : 'Không tạo được'
        results.push({ ...row, studentCode: '', username: '', password: '', note })
      }
    }
    return { file: await studentResultSheet(results), created, skipped: results.length - created }
  }

  async createStaff(actor: Actor, input: CreateStaffInput): Promise<CredentialsIssuedDto> {
    const grants = input.role === 'TEACHER' ? teacherGrants('TEACHER', input.permissions ?? { createStudents: true, manageAssignments: true, viewProgress: true }) : teacherGrants('ADMIN')
    const passwordHash = await this.passwords.hash(DEFAULT_NEW_ACCOUNT_PASSWORD)
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
          permCreateStudents: grants.createStudents,
          permManageAssignments: grants.manageAssignments,
          permViewProgress: grants.viewProgress,
          createdBy: actor.id,
        })
        .returning()
      await this.audit.log({
        action: 'USER_CREATED',
        actorId: actor.id,
        entityType: 'user',
        entityId: row.id,
        metadata: { role: row.role, permissions: grants },
        ip: actor.ip,
      })
      return { user: toUserDto(row), temporaryPassword: DEFAULT_NEW_ACCOUNT_PASSWORD }
    } catch (err) {
      if (isUniqueViolation(err)) throw AppException.conflict('Tên đăng nhập hoặc email đã tồn tại')
      throw err
    }
  }

  async updateTeacherPermissions(actor: Actor, id: string, input: UpdateTeacherPermissionsInput): Promise<UserDto> {
    const [target] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!target || target.role !== 'TEACHER') throw AppException.notFound('Không tìm thấy giáo viên')
    const [row] = await this.db
      .update(users)
      .set({
        permCreateStudents: input.permissions.createStudents,
        permManageAssignments: input.permissions.manageAssignments,
        permViewProgress: input.permissions.viewProgress,
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.id))
      .returning()
    await this.audit.log({
      action: 'USER_PERMISSIONS_UPDATED',
      actorId: actor.id,
      entityType: 'user',
      entityId: target.id,
      metadata: { permissions: input.permissions },
      ip: actor.ip,
    })
    return toUserDto(row)
  }

  // ---------------------------------------------------------------- read
  async list(actor: Actor, query: ListUsersQuery): Promise<Paginated<UserDto>> {
    this.assertAnyGrant(actor)
    const conditions: SQL[] = []
    const mine = actor.role === 'TEACHER' ? await this.managedClassIds(actor.id) : null
    if (mine && mine.length === 0) return { items: [], total: 0, page: query.page, pageSize: query.pageSize }
    if (mine && query.classId && !mine.includes(query.classId)) throw AppException.forbidden('Bạn không quản lý lớp này.')
    // Teachers only see students; admins see everyone.
    const role = actor.role === 'TEACHER' ? 'STUDENT' : query.role
    if (role) conditions.push(eq(users.role, role))
    if (query.status) conditions.push(eq(users.status, query.status))
    if (query.classId) conditions.push(inArray(users.id, this.memberIds([query.classId])))
    else if (mine) conditions.push(inArray(users.id, this.memberIds(mine)))
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

    return { items: await this.withClasses(rows), total, page: query.page, pageSize: query.pageSize }
  }

  async studentStats(actor: Actor): Promise<StudentStatsDto> {
    this.assertAnyGrant(actor)
    const mine = actor.role === 'TEACHER' ? await this.managedClassIds(actor.id) : null
    if (mine && mine.length === 0) return { total: 0, active: 0, disabled: 0, pendingFirstLogin: 0 }
    const scope = mine ? and(eq(users.role, 'STUDENT'), inArray(users.id, this.memberIds(mine))) : eq(users.role, 'STUDENT')
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${users.status} = 'ACTIVE')::int`,
        disabled: sql<number>`count(*) filter (where ${users.status} = 'DISABLED')::int`,
        pendingFirstLogin: sql<number>`count(*) filter (where ${users.mustChangePassword})::int`,
      })
      .from(users)
      .where(scope)
    return row
  }

  async get(actor: Actor, id: string): Promise<UserDto> {
    this.assertAnyGrant(actor)
    return this.withClass(await this.getManageable(actor, id))
  }

  // ---------------------------------------------------------------- mutate
  async resetPassword(actor: Actor, id: string): Promise<CredentialsIssuedDto> {
    this.assertGrant(actor, 'createStudents')
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
    this.assertGrant(actor, 'createStudents')
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

  private async withClass(row: UserRow): Promise<UserDto> {
    const [hit] = await this.withClasses([row])
    return hit
  }

  private async withClasses(rows: UserRow[]): Promise<UserDto[]> {
    if (rows.length === 0) return []
    const links = await this.db
      .select({ userId: classMembers.userId, id: classes.id, name: classes.name })
      .from(classMembers)
      .innerJoin(classes, eq(classes.id, classMembers.classId))
      .where(inArray(classMembers.userId, rows.map((row) => row.id)))
    const byUser = new Map(links.map((link) => [link.userId, { id: link.id, name: link.name }]))
    return rows.map((row) => toUserDto(row, byUser.get(row.id) ?? null))
  }

  private assertGrant(actor: Actor, grant: keyof TeacherPermissions) {
    if (actor.role === 'TEACHER' && !actor.permissions[grant]) throw AppException.forbidden('Tài khoản giáo viên chưa được cấp quyền này.')
  }

  private assertAnyGrant(actor: Actor) {
    if (actor.role !== 'TEACHER') return
    if (!actor.permissions.createStudents && !actor.permissions.manageAssignments && !actor.permissions.viewProgress) {
      throw AppException.forbidden('Tài khoản giáo viên chưa được cấp quyền này.')
    }
  }

  private memberIds(classIds: string[]) {
    return this.db.select({ userId: classMembers.userId }).from(classMembers).where(inArray(classMembers.classId, classIds))
  }

  private async managedClassIds(teacherId: string): Promise<string[]> {
    const rows = await this.db.select({ classId: classTeachers.classId }).from(classTeachers).where(eq(classTeachers.userId, teacherId))
    return rows.map((row) => row.classId)
  }

  /** Admin may omit the class (oldest room, so existing imports keep working). A teacher must manage the chosen class. */
  private async resolveClassId(actor: Actor, requested?: string): Promise<string | null> {
    if (actor.role === 'TEACHER') {
      const mine = await this.managedClassIds(actor.id)
      const chosen = requested ?? (mine.length === 1 ? mine[0] : undefined)
      if (!chosen) throw AppException.badRequest('Hãy chọn lớp để thêm học viên.')
      if (!mine.includes(chosen)) throw AppException.forbidden('Bạn không quản lý lớp này.')
      return chosen
    }
    if (requested) {
      const [room] = await this.db.select({ id: classes.id }).from(classes).where(eq(classes.id, requested)).limit(1)
      if (!room) throw AppException.notFound('Không tìm thấy lớp')
      return requested
    }
    const [fallback] = await this.db.select({ id: classes.id }).from(classes).orderBy(asc(classes.createdAt)).limit(1)
    return fallback?.id ?? null
  }

  private async insertStudent(actor: Actor, input: CreateStudentInput, passwordHash: string, classId: string | null): Promise<UserRow> {
    return this.db.transaction(async (tx) => {
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
          goalTrack: input.targetScore != null ? 'TWO_SKILL' : null,
          targetScoreMin: input.targetScore ?? null,
          role: 'STUDENT',
          mustChangePassword: true,
          createdBy: actor.id,
        })
        .returning()
      if (classId) {
        await tx.insert(classMembers).values({ classId, userId: created.id }).onConflictDoUpdate({ target: classMembers.userId, set: { classId } })
      }
      return created
    })
  }

  /** Load a user the actor is allowed to manage: admins → anyone, teachers → students only. */
  private async getManageable(actor: Actor, id: string): Promise<UserRow> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    // Same 404 for "missing" and "not yours" so teachers can't probe for staff accounts.
    if (!row || (actor.role === 'TEACHER' && row.role !== 'STUDENT')) throw AppException.notFound('Không tìm thấy người dùng')
    if (actor.role === 'TEACHER' && row.role === 'STUDENT') {
      const mine = await this.managedClassIds(actor.id)
      const [link] = mine.length
        ? await this.db
            .select({ userId: classMembers.userId })
            .from(classMembers)
            .where(and(eq(classMembers.userId, row.id), inArray(classMembers.classId, mine)))
            .limit(1)
        : []
      if (!link) throw AppException.notFound('Không tìm thấy người dùng')
    }
    return row
  }
}
