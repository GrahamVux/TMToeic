import { Inject, Injectable } from '@nestjs/common'
import {
  type AssignmentDetailDto,
  type AssignmentDto,
  type AssignmentProgressDto,
  type CreateAssignmentInput,
  type CreateFillAssignmentInput,
  type ExamPartDto,
  FILL_EXAM_SOURCE,
  FILL_PART_CODE,
  FILL_QUESTION_TYPE,
  FOCUS_MIN_AWAY_SECONDS,
  type Skill,
  splitFillAlternatives,
  type StudentAssignmentStatus,
} from '@toeic/shared'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { DB, type Db } from '../db/database.module'
import {
  assets,
  assignmentImages,
  assignmentStudents,
  assignments,
  classMembers,
  classTeachers,
  attemptAnswers,
  attemptFocusLeaves,
  attempts,
  examParts,
  exams,
  parts,
  questionGroups,
  questionOptions,
  questions,
  skills,
  users,
  type AssignmentRow,
} from '../db/schema'
import { AttemptsService } from '../exams/attempts.service'
import { StorageService } from '../storage/storage.service'
import { buildAssignmentReport, type ReportQuestion, type ReportStudent } from './result-sheet'

type Actor = Pick<AuthUser, 'id' | 'role'> & { ip?: string }

@Injectable()
export class AssignmentsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly attemptsService: AttemptsService,
  ) {}

  async create(actor: Actor, input: CreateAssignmentInput): Promise<AssignmentDto> {
    const exam = await this.requirePublishedExam(input.examId)
    const examPartRows = await this.examPartsOf(exam.id)
    const allowed = new Set(examPartRows.map((p) => p.code))
    const bad = input.partCodes.filter((c) => !allowed.has(c))
    if (bad.length) throw AppException.badRequest(`Đề không có part: ${bad.join(', ')}`)
    const partCodes = examPartRows.map((p) => p.code).filter((c) => input.partCodes.includes(c))

    const studentIds = await this.resolveStudents(actor, input.studentIds)
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

  /** Cloze homework. The paper stays out of the exam bank until `saveToBank`. */
  async createFill(actor: Actor, input: CreateFillAssignmentInput): Promise<AssignmentDto> {
    const blanks = input.items.flatMap((item) => item.answers.map((raw) => ({ prompt: item.prompt, accepted: splitFillAlternatives(raw) })))
    if (blanks.some((blank) => blank.accepted.length === 0)) throw AppException.badRequest('Mỗi chỗ trống cần ít nhất một đáp án')
    if (blanks.length > 80) throw AppException.badRequest('Một bài điền từ tối đa 80 chỗ trống')

    const [part] = await this.db.select().from(parts).where(eq(parts.code, FILL_PART_CODE)).limit(1)
    if (!part) throw AppException.badRequest('Chưa có dạng bài điền từ')

    const studentIds = await this.resolveStudents(actor, input.studentIds)
    if (studentIds.length === 0) throw AppException.badRequest('Chưa có học viên nào để giao bài')
    const dueAt = input.dueAt ? new Date(input.dueAt) : null
    if (dueAt && Number.isNaN(dueAt.getTime())) throw AppException.badRequest('Ngày hạn không hợp lệ')
    const publish = input.publish !== false

    const id = await this.db.transaction(async (tx) => {
      const [exam] = await tx
        .insert(exams)
        .values({
          code: `FILL-${Date.now().toString(36).toUpperCase()}`,
          title: input.title,
          description: input.description,
          source: FILL_EXAM_SOURCE,
          status: 'DRAFT',
          difficulty: 'MEDIUM',
          durationSeconds: input.durationSeconds,
          totalQuestions: blanks.length,
          createdBy: actor.id,
        })
        .returning({ id: exams.id })
      const [examPart] = await tx
        .insert(examParts)
        .values({ examId: exam.id, partId: part.id, displayOrder: 1, questionStart: 1, questionEnd: blanks.length })
        .returning({ id: examParts.id })

      let number = 1
      for (const [itemIndex, item] of input.items.entries()) {
        const [group] = await tx
          .insert(questionGroups)
          .values({ examPartId: examPart.id, groupKey: `item-${itemIndex + 1}`, displayOrder: itemIndex + 1 })
          .returning({ id: questionGroups.id })
        for (const raw of item.answers) {
          await tx.insert(questions).values({
            examPartId: examPart.id,
            groupId: group.id,
            questionNumber: number,
            type: FILL_QUESTION_TYPE,
            prompt: item.prompt,
            explanation: item.explanation?.trim() || null,
            explanationStatus: item.explanation?.trim() ? 'READY' : 'NONE',
            acceptedAnswers: splitFillAlternatives(raw),
          })
          number += 1
        }
      }

      const [row] = await tx
        .insert(assignments)
        .values({
          title: input.title,
          description: input.description,
          createdBy: actor.id,
          examId: exam.id,
          partCodes: [FILL_PART_CODE],
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
      metadata: { fillBlank: true, blanks: blanks.length, studentCount: studentIds.length },
      ip: actor.ip,
    })
    return (await this.toDtos([await this.requireRow(id)]))[0]
  }

  /** Publish the cloze paper into the exam bank so it can be practiced and assigned again. */
  async saveToBank(actor: Actor, id: string): Promise<AssignmentDto> {
    const row = await this.requireRow(id)
    const [exam] = await this.db.select().from(exams).where(eq(exams.id, row.examId)).limit(1)
    if (!exam || exam.source !== FILL_EXAM_SOURCE) throw AppException.badRequest('Chỉ lưu bài điền từ vào bộ đề')
    if (exam.status === 'ARCHIVED') throw AppException.conflict('Đề đã được lưu trữ')
    if (exam.status !== 'PUBLISHED') {
      await this.db.update(exams).set({ status: 'PUBLISHED', publishedAt: new Date(), updatedAt: new Date() }).where(eq(exams.id, exam.id))
      await this.audit.log({ action: 'EXAM_PUBLISHED', actorId: actor.id, entityType: 'exam', entityId: exam.id, metadata: { assignmentId: id, fillBlank: true }, ip: actor.ip })
    }
    return (await this.toDtos([row]))[0]
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

  /** Excel in the center's class-result format. Only a full paper, and only after every assigned student has finished. */
  async report(actor: Actor, id: string): Promise<{ body: Buffer; filename: string }> {
    if (actor.role === 'STUDENT') throw AppException.forbidden('Học viên không xuất báo cáo lớp')
    const row = await this.requireRow(id)
    const [dto] = await this.toDtos([row])
    if (!dto.wholeExam) throw AppException.conflict('Báo cáo Excel chỉ có khi bài tập giao cả bộ đề.')
    const roster = await this.progressFor(id, dto.parts)
    if (roster.length === 0) throw AppException.conflict('Chưa giao cho học viên nào.')
    const pending = roster.filter((s) => s.status !== 'COMPLETED')
    if (pending.length > 0) {
      throw AppException.conflict(`Còn ${pending.length} học viên chưa hoàn thành. Báo cáo xuất khi tất cả đã nộp hoặc hết giờ.`)
    }

    const attemptIds = roster.flatMap((s) => (s.attemptId ? [s.attemptId] : []))
    const attemptRows = attemptIds.length ? await this.db.select().from(attempts).where(inArray(attempts.id, attemptIds)) : []
    const attemptByUser = new Map(attemptRows.map((t) => [t.userId, t]))
    const scope = await this.reportQuestions(row.examId, row.partCodes)
    const questionIds = scope.map((q) => q.id)
    const keyRows = questionIds.length
      ? await this.db
          .select({ questionId: questionOptions.questionId, optionKey: questionOptions.optionKey })
          .from(questionOptions)
          .where(and(inArray(questionOptions.questionId, questionIds), eq(questionOptions.isCorrect, true)))
      : []
    const correctKeys: Record<string, string> = {}
    for (const key of keyRows) correctKeys[key.questionId] = key.optionKey
    const answerRows = attemptIds.length
      ? await this.db
          .select({
            attemptId: attemptAnswers.attemptId,
            questionId: attemptAnswers.questionId,
            selected: questionOptions.optionKey,
          })
          .from(attemptAnswers)
          .leftJoin(questionOptions, eq(questionOptions.id, attemptAnswers.selectedOptionId))
          .where(inArray(attemptAnswers.attemptId, attemptIds))
      : []
    const answersByAttempt = new Map<string, Record<string, string | null>>()
    for (const answer of answerRows) {
      const bag = answersByAttempt.get(answer.attemptId) ?? {}
      bag[answer.questionId] = answer.selected
      answersByAttempt.set(answer.attemptId, bag)
    }

    const students: ReportStudent[] = roster.map((s) => {
      const attempt = attemptByUser.get(s.studentId)
      return {
        fullName: s.fullName,
        listeningScore: attempt?.listeningScore ?? null,
        readingScore: attempt?.readingScore ?? null,
        totalScore: attempt?.totalScore ?? null,
        answers: attempt ? (answersByAttempt.get(attempt.id) ?? {}) : {},
      }
    })
    const body = await buildAssignmentReport({ examTitle: dto.examTitle || dto.title, questions: scope, correctKeys, students })
    return { body, filename: `ket-qua-${fileSlug(dto.title)}.xlsx` }
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

  /** Listening file for this homework. Students hear it for every Listening part in the assignment. */
  async uploadAudio(actor: Actor, id: string, raw: unknown, contentType: string, filename: string) {
    if (!this.storage.enabled) throw AppException.badRequest('Chưa cấu hình kho file. Không lưu được audio.')
    const row = await this.requireRow(id)
    const selected = (await this.examPartsOf(row.examId)).filter((p) => row.partCodes.includes(p.code))
    if (!selected.some((p) => p.skill === 'LISTENING')) throw AppException.badRequest('Bài tập này không có part Listening.')
    const body = Buffer.isBuffer(raw) ? raw : null
    if (!body || body.length === 0) throw AppException.badRequest('Thiếu file nghe.')
    if (body.length > MAX_AUDIO_BYTES) throw AppException.badRequest('File nghe quá lớn (tối đa 80MB).')
    const mime = audioMime(contentType, filename)
    if (!mime) throw AppException.badRequest('Chỉ nhận file mp3, m4a hoặc wav.')

    const ext = mime === 'audio/mpeg' ? 'mp3' : mime === 'audio/mp4' ? 'm4a' : mime === 'audio/wav' ? 'wav' : 'webm'
    const objectKey = `assignments/${id}/audio/${Date.now()}.${ext}`
    const assetId = await this.storeObject(objectKey, body, mime, filename)
    await this.db.update(assignments).set({ audioAssetId: assetId, updatedAt: new Date() }).where(eq(assignments.id, id))
    await this.audit.log({ action: 'ASSIGNMENT_AUDIO_SET', actorId: actor.id, entityType: 'assignment', entityId: id, metadata: { assetId }, ip: actor.ip })
    return { ok: true as const }
  }

  /** One scanned exam page. Students see these while doing the homework. */
  async uploadImage(actor: Actor, id: string, raw: unknown, contentType: string, filename: string) {
    if (!this.storage.enabled) throw AppException.badRequest('Chưa cấu hình kho file. Không lưu được ảnh.')
    await this.requireRow(id)
    const body = Buffer.isBuffer(raw) ? raw : null
    if (!body || body.length === 0) throw AppException.badRequest('Thiếu ảnh đề.')
    if (body.length > MAX_IMAGE_BYTES) throw AppException.badRequest('Mỗi ảnh tối đa 8MB.')
    const mime = imageMime(contentType, filename)
    if (!mime) throw AppException.badRequest('Chỉ nhận ảnh jpg, png hoặc webp.')
    const [{ n }] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(assignmentImages)
      .where(eq(assignmentImages.assignmentId, id))
    if (n >= MAX_IMAGES) throw AppException.badRequest(`Mỗi bài tập tối đa ${MAX_IMAGES} ảnh.`)

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
    const objectKey = `assignments/${id}/images/${Date.now()}.${ext}`
    const assetId = await this.storeObject(objectKey, body, mime, filename)
    await this.db.insert(assignmentImages).values({ assignmentId: id, assetId, displayOrder: n })
    await this.audit.log({ action: 'ASSIGNMENT_IMAGE_ADDED', actorId: actor.id, entityType: 'assignment', entityId: id, metadata: { assetId }, ip: actor.ip })
    return { ok: true as const, imageCount: n + 1 }
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

  private async resolveStudents(actor: Actor, ids: string[] | undefined): Promise<string[]> {
    const scope = actor.role === 'TEACHER' ? await this.teacherStudentIds(actor.id) : null
    if (ids && ids.length > 0) {
      if (scope && ids.some((id) => !scope.includes(id))) throw AppException.badRequest('Danh sách học viên không hợp lệ')
      const rows = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.id, ids), eq(users.role, 'STUDENT'), eq(users.status, 'ACTIVE')))
      if (rows.length !== ids.length) throw AppException.badRequest('Danh sách học viên không hợp lệ')
      return rows.map((r) => r.id)
    }
    if (scope) return scope
    const rows = await this.db.select({ id: users.id }).from(users).where(and(eq(users.role, 'STUDENT'), eq(users.status, 'ACTIVE')))
    return rows.map((r) => r.id)
  }

  /** Active students in the classes this teacher manages. */
  private async teacherStudentIds(teacherId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: users.id })
      .from(classMembers)
      .innerJoin(classTeachers, eq(classTeachers.classId, classMembers.classId))
      .innerJoin(users, eq(users.id, classMembers.userId))
      .where(and(eq(classTeachers.userId, teacherId), eq(users.role, 'STUDENT'), eq(users.status, 'ACTIVE')))
    return rows.map((row) => row.id)
  }

  private async storeObject(objectKey: string, body: Buffer, mime: string, filename: string): Promise<string> {
    try {
      await this.storage.putObject(objectKey, body, mime)
    } catch {
      throw AppException.badRequest('Không lưu được file. Kiểm tra cấu hình kho file.')
    }
    const original = filename.replace(/[/\\]/g, '').slice(0, 120) || 'file'
    const [asset] = await this.db
      .insert(assets)
      .values({
        provider: 'CLOUDFLARE_R2',
        bucket: this.storage.bucket,
        objectKey,
        mimeType: mime,
        sizeBytes: body.length,
        originalFilename: original,
      })
      .returning({ id: assets.id })
    if (!asset) throw AppException.badRequest('Không lưu được file.')
    return asset.id
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
    await this.closeTimedOut(ids, studentId)
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

    const imageRows = await this.db
      .select({ assignmentId: assignmentImages.assignmentId, n: sql<number>`count(*)::int` })
      .from(assignmentImages)
      .where(inArray(assignmentImages.assignmentId, ids))
      .groupBy(assignmentImages.assignmentId)
    const imageCount = new Map(imageRows.map((r) => [r.assignmentId, r.n]))

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
        hasAudio: a.audioAssetId !== null,
        imageCount: imageCount.get(a.id) ?? 0,
        wholeExam: allParts.length > 0 && allParts.every((p) => p.code.startsWith('PART_') && a.partCodes.includes(p.code)),
        fillBlank: exam?.source === FILL_EXAM_SOURCE || selected.some((p) => p.code === FILL_PART_CODE),
        inBank: exam?.status === 'PUBLISHED',
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
    const doneIds = [...latest.values()].filter((t) => t.status === 'SUBMITTED' || t.status === 'EXPIRED').map((t) => t.id)
    const focusRows = doneIds.length
      ? await this.db
          .select({ attemptId: attemptFocusLeaves.attemptId, n: sql<number>`count(*)::int` })
          .from(attemptFocusLeaves)
          .where(and(inArray(attemptFocusLeaves.attemptId, doneIds), sql`coalesce(${attemptFocusLeaves.awaySeconds}, 0) >= ${FOCUS_MIN_AWAY_SECONDS}`))
          .groupBy(attemptFocusLeaves.attemptId)
      : []
    const focusByAttempt = new Map(focusRows.map((r) => [r.attemptId, Number(r.n)]))

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
        focusLeaveCount: done && t ? (focusByAttempt.get(t.id) ?? 0) : null,
      }
    })
  }

  /** Turns in-progress sittings into scored results once their clock has run out. */
  private async closeTimedOut(assignmentIds: string[], userId?: string) {
    const filters = [inArray(attempts.assignmentId, assignmentIds), eq(attempts.status, 'IN_PROGRESS')]
    if (userId) filters.push(eq(attempts.userId, userId))
    const open = await this.db.select().from(attempts).where(and(...filters))
    for (const row of open) await this.attemptsService.closeIfPastDeadline(row)
  }

  private async reportQuestions(examId: string, partCodes: string[]): Promise<ReportQuestion[]> {
    if (partCodes.length === 0) return []
    const rows = await this.db
      .select({ id: questions.id, number: questions.questionNumber, partCode: parts.code, skill: skills.code })
      .from(questions)
      .innerJoin(examParts, eq(examParts.id, questions.examPartId))
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .innerJoin(skills, eq(skills.id, parts.skillId))
      .where(and(eq(examParts.examId, examId), inArray(parts.code, partCodes)))
      .orderBy(asc(examParts.displayOrder), asc(questions.questionNumber))
    const numbers = rows.map((r) => r.number)
    const unique = new Set(numbers).size === numbers.length
    return rows.map((r, index) => ({
      id: r.id,
      number: unique ? r.number : index + 1,
      partCode: r.partCode,
      skill: r.skill === 'LISTENING' ? 'LISTENING' : 'READING',
    }))
  }

  private deriveStatus(attemptStatus: string | null, dueAt: Date | null): StudentAssignmentStatus {
    if (attemptStatus === 'SUBMITTED' || attemptStatus === 'EXPIRED') return 'COMPLETED'
    if (attemptStatus === 'IN_PROGRESS') return 'IN_PROGRESS'
    if (dueAt && dueAt.getTime() < Date.now()) return 'OVERDUE'
    return 'ASSIGNED'
  }
}

const MAX_AUDIO_BYTES = 80 * 1024 * 1024
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_IMAGES = 20

function audioMime(contentType: string, filename: string): string | null {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'audio/mpeg'
  if (mime === 'audio/mp4' || mime === 'audio/m4a' || mime === 'audio/x-m4a') return 'audio/mp4'
  if (mime === 'audio/wav' || mime === 'audio/wave' || mime === 'audio/x-wav') return 'audio/wav'
  if (mime === 'audio/webm') return 'audio/webm'
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4'
  if (ext === 'wav') return 'audio/wav'
  return null
}

function fileSlug(title: string) {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return slug || 'bo-de'
}

function imageMime(contentType: string, filename: string): string | null {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg'
  if (mime === 'image/png') return 'image/png'
  if (mime === 'image/webp') return 'image/webp'
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return null
}
