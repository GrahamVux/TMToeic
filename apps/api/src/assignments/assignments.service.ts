import { Inject, Injectable } from '@nestjs/common'
import {
  type AssignmentDetailDto,
  type AssignmentDto,
  type AssignmentProgressDto,
  type CreateAssignmentInput,
  type ExamPartDto,
  type Skill,
  type StudentAssignmentStatus,
} from '@toeic/shared'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { DB, type Db } from '../db/database.module'
import {
  assignmentStudents,
  assignments,
  attempts,
  examParts,
  exams,
  parts,
  skills,
  users,
  type AssignmentRow,
} from '../db/schema'

type Actor = Pick<AuthUser, 'id' | 'role'> & { ip?: string }

@Injectable()
export class AssignmentsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async create(actor: Actor, input: CreateAssignmentInput): Promise<AssignmentDto> {
    const exam = await this.requirePublishedExam(input.examId)
    const examPartRows = await this.examPartsOf(exam.id)
    const allowed = new Set(examPartRows.map((p) => p.code))
    const bad = input.partCodes.filter((c) => !allowed.has(c))
    if (bad.length) throw AppException.badRequest(`Đề không có part: ${bad.join(', ')}`)
    const partCodes = examPartRows.map((p) => p.code).filter((c) => input.partCodes.includes(c))

    const studentIds = await this.resolveStudents(input.studentIds)
    if (studentIds.length === 0) throw AppException.badRequest('Chưa có học viên nào để giao bài')

    const dueAt = input.dueAt ? new Date(input.dueAt) : null
    if (dueAt && Number.isNaN(dueAt.getTime())) throw AppException.badRequest('Ngày hạn không hợp lệ')

    const publish = input.publish !== false
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(assignments)
        .values({
          title: input.title,
          description: input.description,
          createdBy: actor.id,
          examId: exam.id,
          partCodes,
          durationSeconds: input.durationSeconds,
          dueAt,
          status: publish ? 'PUBLISHED' : 'DRAFT',
          publishedAt: publish ? new Date() : null,
        })
        .returning({ id: assignments.id })
      await tx.insert(assignmentStudents).values(studentIds.map((userId) => ({ assignmentId: row.id, userId })))
      return row.id
    })
    await this.audit.log({
      action: publish ? 'ASSIGNMENT_PUBLISHED' : 'ASSIGNMENT_CREATED',
      actorId: actor.id,
      entityType: 'assignment',
      entityId: id,
      metadata: { examId: exam.id, partCodes, studentCount: studentIds.length },
      ip: actor.ip,
    })
    const [dto] = await this.toDtos([await this.requireRow(id)])
    return dto
  }

  async list(actor: Actor): Promise<AssignmentDto[]> {
    if (actor.role === 'STUDENT') {
      const rows = await this.db
        .select({ a: assignments })
        .from(assignmentStudents)
        .innerJoin(assignments, eq(assignments.id, assignmentStudents.assignmentId))
        .where(and(eq(assignmentStudents.userId, actor.id), inArray(assignments.status, ['PUBLISHED', 'CLOSED'])))
        .orderBy(desc(assignments.dueAt), desc(assignments.createdAt))
      return this.toDtos(
        rows.map((r) => r.a),
        actor.id,
      )
    }
    const rows = await this.db.select().from(assignments).orderBy(desc(assignments.createdAt))
    return this.toDtos(rows)
  }

  async get(actor: Actor, id: string): Promise<AssignmentDetailDto> {
    const row = await this.requireRow(id)
    if (actor.role === 'STUDENT') {
      const [mine] = await this.db
        .select({ userId: assignmentStudents.userId })
        .from(assignmentStudents)
        .where(and(eq(assignmentStudents.assignmentId, id), eq(assignmentStudents.userId, actor.id)))
        .limit(1)
      if (!mine || row.status === 'DRAFT') throw AppException.notFound('Không tìm thấy bài tập')
      const [dto] = await this.toDtos([row], actor.id)
      return { ...dto, students: [] }
    }
    const [dto] = await this.toDtos([row])
    return { ...dto, students: await this.progressFor(id, dto.parts) }
  }

  async publish(actor: Actor, id: string): Promise<AssignmentDto> {
    const row = await this.requireRow(id)
    if (row.status === 'PUBLISHED') return (await this.toDtos([row]))[0]
    if (row.status === 'CLOSED') throw AppException.conflict('Bài tập đã đóng')
    await this.requirePublishedExam(row.examId)
    await this.db.update(assignments).set({ status: 'PUBLISHED', publishedAt: new Date(), updatedAt: new Date() }).where(eq(assignments.id, id))
    await this.audit.log({ action: 'ASSIGNMENT_PUBLISHED', actorId: actor.id, entityType: 'assignment', entityId: id, ip: actor.ip })
    return (await this.toDtos([await this.requireRow(id)]))[0]
  }

  async close(actor: Actor, id: string): Promise<AssignmentDto> {
    const row = await this.requireRow(id)
    if (row.status === 'DRAFT') throw AppException.conflict('Chỉ đóng bài tập đã giao')
    await this.db.update(assignments).set({ status: 'CLOSED', updatedAt: new Date() }).where(eq(assignments.id, id))
    await this.audit.log({ action: 'ASSIGNMENT_CLOSED', actorId: actor.id, entityType: 'assignment', entityId: id, ip: actor.ip })
    return (await this.toDtos([await this.requireRow(id)]))[0]
  }

  private async requireRow(id: string): Promise<AssignmentRow> {
    const [row] = await this.db.select().from(assignments).where(eq(assignments.id, id)).limit(1)
    if (!row) throw AppException.notFound('Không tìm thấy bài tập')
    return row
  }

  private async requirePublishedExam(examId: string) {
    const [exam] = await this.db.select().from(exams).where(eq(exams.id, examId)).limit(1)
    if (!exam) throw AppException.notFound('Không tìm thấy đề thi')
    if (exam.status !== 'PUBLISHED') throw AppException.badRequest('Chỉ giao được đề đã xuất bản trong ngân hàng')
    return exam
  }

  private async resolveStudents(ids: string[] | undefined): Promise<string[]> {
    if (ids && ids.length > 0) {
      const rows = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.id, ids), eq(users.role, 'STUDENT'), eq(users.status, 'ACTIVE')))
      if (rows.length !== ids.length) throw AppException.badRequest('Danh sách học viên không hợp lệ')
      return rows.map((r) => r.id)
    }
    const rows = await this.db.select({ id: users.id }).from(users).where(and(eq(users.role, 'STUDENT'), eq(users.status, 'ACTIVE')))
    return rows.map((r) => r.id)
  }

  private async examPartsOf(examId: string): Promise<ExamPartDto[]> {
    const rows = await this.db
      .select({ ep: examParts, part: parts, skill: skills.code })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .innerJoin(skills, eq(skills.id, parts.skillId))
      .where(eq(examParts.examId, examId))
      .orderBy(asc(examParts.displayOrder))
    return rows.map((x) => ({
      code: x.part.code,
      name: x.part.name,
      skill: x.skill as Skill,
      questionStart: x.ep.questionStart,
      questionEnd: x.ep.questionEnd,
      questionCount: x.ep.questionEnd - x.ep.questionStart + 1,
    }))
  }

  private async toDtos(rows: AssignmentRow[], studentId?: string): Promise<AssignmentDto[]> {
    if (!rows.length) return []
    const ids = rows.map((r) => r.id)
    const examIds = [...new Set(rows.map((r) => r.examId))]
    const examRows = await this.db.select().from(exams).where(inArray(exams.id, examIds))
    const examById = new Map(examRows.map((e) => [e.id, e]))
    const partsByExam = new Map<string, ExamPartDto[]>()
    for (const examId of examIds) partsByExam.set(examId, await this.examPartsOf(examId))

    const countRows = await this.db
      .select({ assignmentId: assignmentStudents.assignmentId, n: sql<number>`count(*)::int` })
      .from(assignmentStudents)
      .where(inArray(assignmentStudents.assignmentId, ids))
      .groupBy(assignmentStudents.assignmentId)
    const studentCount = new Map(countRows.map((r) => [r.assignmentId, r.n]))

    const submittedRows = await this.db
      .select({ assignmentId: attempts.assignmentId, n: sql<number>`count(*)::int` })
      .from(attempts)
      .where(and(inArray(attempts.assignmentId, ids), inArray(attempts.status, ['SUBMITTED', 'EXPIRED'])))
      .groupBy(attempts.assignmentId)
    const submittedCount = new Map(submittedRows.map((r) => [r.assignmentId, r.n]))

    const myAttempts = studentId
      ? await this.db
          .select()
          .from(attempts)
          .where(and(eq(attempts.userId, studentId), inArray(attempts.assignmentId, ids)))
          .orderBy(desc(attempts.startedAt))
      : []

    return rows.map((a) => {
      const exam = examById.get(a.examId)
      const allParts = partsByExam.get(a.examId) ?? []
      const selected = allParts.filter((p) => a.partCodes.includes(p.code))
      const totalQuestions = selected.reduce((s, p) => s + p.questionCount, 0)
      const mine = myAttempts.find((t) => t.assignmentId === a.id)
      const myStatus = this.deriveStatus(mine?.status ?? null, a.dueAt)
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        examId: a.examId,
        examTitle: exam?.title ?? '',
        examCode: exam?.code ?? '',
        partCodes: a.partCodes,
        parts: selected,
        durationSeconds: a.durationSeconds,
        dueAt: a.dueAt?.toISOString() ?? null,
        status: a.status,
        publishedAt: a.publishedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
        studentCount: studentCount.get(a.id) ?? 0,
        submittedCount: submittedCount.get(a.id) ?? 0,
        myProgress: studentId
          ? {
              status: myStatus,
              attemptId: mine?.id ?? null,
              answeredCount: (mine?.correctCount ?? 0) + (mine?.incorrectCount ?? 0) + (mine?.unansweredCount ?? 0) || 0,
              totalQuestions: mine?.totalQuestions ?? totalQuestions,
            }
          : undefined,
      }
    })
  }

  private async progressFor(assignmentId: string, selectedParts: ExamPartDto[]): Promise<AssignmentProgressDto[]> {
    const totalQuestions = selectedParts.reduce((s, p) => s + p.questionCount, 0)
    const [asg] = await this.db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1)
    const roster = await this.db
      .select({ id: users.id, fullName: users.fullName, studentCode: users.studentCode })
      .from(assignmentStudents)
      .innerJoin(users, eq(users.id, assignmentStudents.userId))
      .where(eq(assignmentStudents.assignmentId, assignmentId))
      .orderBy(asc(users.fullName))
    const attemptRows = await this.db.select().from(attempts).where(eq(attempts.assignmentId, assignmentId)).orderBy(desc(attempts.startedAt))
    const latest = new Map<string, (typeof attemptRows)[number]>()
    for (const t of attemptRows) if (!latest.has(t.userId)) latest.set(t.userId, t)

    return roster.map((s) => {
      const t = latest.get(s.id)
      const done = t?.status === 'SUBMITTED' || t?.status === 'EXPIRED'
      const answered = done ? (t!.correctCount ?? 0) + (t!.incorrectCount ?? 0) + (t!.unansweredCount ?? 0) : 0
      return {
        studentId: s.id,
        fullName: s.fullName,
        studentCode: s.studentCode,
        status: this.deriveStatus(t?.status ?? null, asg?.dueAt ?? null),
        attemptId: t?.id ?? null,
        answeredCount: done ? answered : 0,
        totalQuestions: t?.totalQuestions ?? totalQuestions,
        correctCount: done ? (t!.correctCount ?? 0) : null,
        submittedAt: t?.submittedAt?.toISOString() ?? null,
        totalScore: done ? (t!.totalScore ?? null) : null,
      }
    })
  }

  private deriveStatus(attemptStatus: string | null, dueAt: Date | null): StudentAssignmentStatus {
    if (attemptStatus === 'SUBMITTED' || attemptStatus === 'EXPIRED') return 'COMPLETED'
    if (attemptStatus === 'IN_PROGRESS') return 'IN_PROGRESS'
    if (dueAt && dueAt.getTime() < Date.now()) return 'OVERDUE'
    return 'ASSIGNED'
  }
}
