import { Inject, Injectable } from '@nestjs/common'
import { type AssignClassInput, type ClassSummaryDto, type ClassTeacherDto, type CreateClassInput, type RenameClassInput, type SetClassTeachersInput } from '@toeic/shared'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { AppException } from '../common/app-exception'
import { DB, type Db } from '../db/database.module'
import { classMembers, classTeachers, classes, users } from '../db/schema'

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

@Injectable()
export class ClassesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(actor: { id: string; role: string }): Promise<ClassSummaryDto[]> {
    const rows = await this.summaries()
    if (actor.role !== 'TEACHER') return rows
    return rows.filter((room) => room.teachers.some((teacher) => teacher.id === actor.id))
  }

  async create(input: CreateClassInput): Promise<ClassSummaryDto> {
    try {
      const [row] = await this.db.insert(classes).values({ name: input.name }).returning()
      return { id: row.id, name: row.name, memberCount: 0, teachers: [] }
    } catch (err) {
      if (isUniqueViolation(err)) throw AppException.conflict('Đã có lớp trùng tên')
      throw err
    }
  }

  async rename(id: string, input: RenameClassInput): Promise<ClassSummaryDto> {
    try {
      const [row] = await this.db.update(classes).set({ name: input.name, updatedAt: new Date() }).where(eq(classes.id, id)).returning()
      if (!row) throw AppException.notFound('Không tìm thấy lớp')
      const [count] = await this.db.select({ n: sql<number>`count(*)::int` }).from(classMembers).where(eq(classMembers.classId, id))
      const teachers = await this.teachersOf(id)
      return { id: row.id, name: row.name, memberCount: count?.n ?? 0, teachers }
    } catch (err) {
      if (isUniqueViolation(err)) throw AppException.conflict('Đã có lớp trùng tên')
      throw err
    }
  }

  async assign(input: AssignClassInput): Promise<void> {
    const [student] = await this.db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1)
    if (!student || student.role !== 'STUDENT') throw AppException.notFound('Không tìm thấy học viên')
    const [room] = await this.db.select({ id: classes.id }).from(classes).where(eq(classes.id, input.classId)).limit(1)
    if (!room) throw AppException.notFound('Không tìm thấy lớp')
    await this.db
      .insert(classMembers)
      .values({ classId: input.classId, userId: input.userId })
      .onConflictDoUpdate({ target: classMembers.userId, set: { classId: input.classId } })
  }

  /** Replaces the teachers who may add and manage students of this class. */
  async setTeachers(id: string, input: SetClassTeachersInput): Promise<ClassSummaryDto> {
    const [room] = await this.db.select({ id: classes.id, name: classes.name }).from(classes).where(eq(classes.id, id)).limit(1)
    if (!room) throw AppException.notFound('Không tìm thấy lớp')
    const teacherIds = [...new Set(input.teacherIds)]
    if (teacherIds.length > 0) {
      const found = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.id, teacherIds), eq(users.role, 'TEACHER')))
      if (found.length !== teacherIds.length) throw AppException.badRequest('Chỉ gán được tài khoản giáo viên')
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(classTeachers).where(eq(classTeachers.classId, id))
      if (teacherIds.length > 0) {
        await tx.insert(classTeachers).values(teacherIds.map((userId) => ({ classId: id, userId })))
      }
    })
    const [count] = await this.db.select({ n: sql<number>`count(*)::int` }).from(classMembers).where(eq(classMembers.classId, id))
    return { id: room.id, name: room.name, memberCount: count?.n ?? 0, teachers: await this.teachersOf(id) }
  }

  private async summaries(): Promise<ClassSummaryDto[]> {
    const rows = await this.db
      .select({
        id: classes.id,
        name: classes.name,
        memberCount: sql<number>`count(${classMembers.userId})::int`,
      })
      .from(classes)
      .leftJoin(classMembers, eq(classMembers.classId, classes.id))
      .groupBy(classes.id, classes.name, classes.createdAt)
      .orderBy(asc(classes.createdAt))
    const teacherRows = await this.db
      .select({ classId: classTeachers.classId, id: users.id, fullName: users.fullName })
      .from(classTeachers)
      .innerJoin(users, eq(users.id, classTeachers.userId))
      .orderBy(asc(users.fullName))
    const byClass = new Map<string, ClassTeacherDto[]>()
    for (const teacher of teacherRows) {
      const list = byClass.get(teacher.classId) ?? []
      list.push({ id: teacher.id, fullName: teacher.fullName })
      byClass.set(teacher.classId, list)
    }
    return rows.map((row) => ({ ...row, teachers: byClass.get(row.id) ?? [] }))
  }

  private async teachersOf(classId: string): Promise<ClassTeacherDto[]> {
    return this.db
      .select({ id: users.id, fullName: users.fullName })
      .from(classTeachers)
      .innerJoin(users, eq(users.id, classTeachers.userId))
      .where(eq(classTeachers.classId, classId))
      .orderBy(asc(users.fullName))
  }
}
