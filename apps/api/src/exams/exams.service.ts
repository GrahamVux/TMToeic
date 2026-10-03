import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import {
  ERROR_CODES,
  type CreateExamInput,
  type ExamPartDto,
  type ExamStatus,
  type ExamSummaryDto,
  type ImportAuthoredExamInput,
  type ImportListeningDraftInput,
  type ReplaceExamContentInput,
  type Skill,
} from '@toeic/shared'
import { and, asc, count, desc, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { APP_CONFIG, type AppConfig } from '../config/app-config'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { DB, type Db } from '../db/database.module'
import { assets, attempts, examParts, exams, parts, passages, questionGroups, questionOptions, questions, skills, users, type ExamRow } from '../db/schema'

type Actor = Pick<AuthUser, 'id' | 'role'> & { ip?: string }

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (m) => `\\${m}`)

@Injectable()
export class ExamsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- create / read
  async create(actor: Actor, input: CreateExamInput): Promise<ExamSummaryDto> {
    const codes = input.parts.map((p) => p.partCode)
    if (new Set(codes).size !== codes.length) throw AppException.badRequest('Mỗi part chỉ được khai báo một lần')

    const partRows = await this.db.select().from(parts).where(inArray(parts.code, codes))
    const byCode = new Map(partRows.map((p) => [p.code, p]))
    const unknown = codes.filter((c) => !byCode.has(c))
    if (unknown.length) throw AppException.badRequest(`Part không tồn tại: ${unknown.join(', ')}`)

    const sorted = [...input.parts].sort((a, b) => a.questionStart - b.questionStart)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].questionStart <= sorted[i - 1].questionEnd) throw AppException.badRequest('Khoảng số câu của các part bị chồng lấn')
    }
    const total = input.parts.reduce((s, p) => s + (p.questionEnd - p.questionStart + 1), 0)

    try {
      const id = await this.db.transaction(async (tx) => {
        const [exam] = await tx
          .insert(exams)
          .values({
            code: input.code,
            title: input.title,
            description: input.description,
            source: input.source,
            difficulty: input.difficulty,
            durationSeconds: input.durationSeconds,
            totalQuestions: total,
            createdBy: actor.id,
          })
          .returning({ id: exams.id })
        await tx.insert(examParts).values(
          input.parts.map((p) => ({
            examId: exam.id,
            partId: byCode.get(p.partCode)!.id,
            displayOrder: byCode.get(p.partCode)!.displayOrder,
            questionStart: p.questionStart,
            questionEnd: p.questionEnd,
          })),
        )
        return exam.id
      })
      await this.audit.log({ action: 'EXAM_CREATED', actorId: actor.id, entityType: 'exam', entityId: id, metadata: { code: input.code }, ip: actor.ip })
      return this.getSummary(id)
    } catch (err) {
      if (isUniqueViolation(err)) throw AppException.conflict('Mã đề đã tồn tại')
      throw err
    }
  }

  /** Students only ever see PUBLISHED exams; staff see everything. */
  async list(actor: Actor, filter: { status?: ExamStatus; q?: string }): Promise<ExamSummaryDto[]> {
    const conditions: SQL[] = []
    if (actor.role === 'STUDENT') conditions.push(eq(exams.status, 'PUBLISHED'))
    else if (filter.status) conditions.push(eq(exams.status, filter.status))
    if (filter.q) conditions.push(ilike(exams.title, `%${escapeLike(filter.q)}%`))
    const rows = await this.db
      .select()
      .from(exams)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(exams.createdAt))
    return this.toSummaries(rows)
  }

  async get(actor: Actor, id: string): Promise<ExamSummaryDto> {
    const summary = await this.getSummary(id)
    if (actor.role === 'STUDENT' && summary.status !== 'PUBLISHED') throw AppException.notFound('Không tìm thấy đề thi')
    return summary
  }

  /** Full content INCLUDING the answer key — staff only (controller-enforced). */
  async getContent(id: string) {
    const summary = await this.getSummary(id)
    const rows = await this.db
      .select({ q: questions, partCode: parts.code, order: examParts.displayOrder })
      .from(questions)
      .innerJoin(examParts, eq(examParts.id, questions.examPartId))
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .where(eq(examParts.examId, id))
      .orderBy(asc(examParts.displayOrder), asc(questions.questionNumber))
    const qIds = rows.map((r) => r.q.id)
    const opts = qIds.length ? await this.db.select().from(questionOptions).where(inArray(questionOptions.questionId, qIds)).orderBy(asc(questionOptions.optionKey)) : []
    const groupRows = await this.db
      .select({ g: questionGroups, partCode: parts.code })
      .from(questionGroups)
      .innerJoin(examParts, eq(examParts.id, questionGroups.examPartId))
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .where(eq(examParts.examId, id))
      .orderBy(asc(questionGroups.displayOrder))
    const gIds = groupRows.map((g) => g.g.id)
    const pass = gIds.length ? await this.db.select().from(passages).where(inArray(passages.groupId, gIds)).orderBy(asc(passages.displayOrder)) : []

    return {
      exam: summary,
      groups: groupRows.map(({ g, partCode }) => ({
        id: g.id,
        key: g.groupKey,
        partCode,
        instructions: g.instructions,
        imageAssetId: g.imageAssetId,
        passages: pass.filter((p) => p.groupId === g.id).map((p) => ({ label: p.label, title: p.title, content: p.content })),
      })),
      questions: rows.map(({ q, partCode }) => ({
        id: q.id,
        number: q.questionNumber,
        partCode,
        groupId: q.groupId,
        type: q.type,
        prompt: q.prompt,
        imageAssetId: q.imageAssetId,
        options: opts.filter((o) => o.questionId === q.id).map((o) => ({ key: o.optionKey, text: o.optionText, correct: o.isCorrect })),
      })),
    }
  }

  // ---------------------------------------------------------------- edit content (DRAFT only)
  async replaceContent(actor: Actor, id: string, input: ReplaceExamContentInput) {
    const exam = await this.requireExam(id)
    // DRAFT / PENDING_REVIEW (imported, awaiting teacher review) / REJECTED are editable; published content is immutable
    // so scores of past attempts stay valid (create a new exam version to change a published test).
    if (!['DRAFT', 'PENDING_REVIEW', 'REJECTED'].includes(exam.status)) {
      throw AppException.conflict('Đề đã xuất bản hoặc lưu trữ nên không thể sửa nội dung. Hãy tạo phiên bản đề mới.')
    }
    const [{ n }] = await this.db.select({ n: count() }).from(attempts).where(eq(attempts.examId, id))
    if (n > 0) throw AppException.conflict('Đề đã có lượt làm bài, không thể thay đổi nội dung')

    const eps = await this.db
      .select({ ep: examParts, code: parts.code })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .where(eq(examParts.examId, id))
    const epByCode = new Map(eps.map((r) => [r.code, r.ep]))

    // ---- validate input against the exam definition
    const errors: string[] = []
    const seenNumbers = new Set<number>()
    const groupKeys = new Map(input.groups.map((g) => [g.key, g]))
    if (groupKeys.size !== input.groups.length) errors.push('Khóa nhóm (group key) bị trùng')
    for (const g of input.groups) if (!epByCode.has(g.partCode)) errors.push(`Nhóm "${g.key}": đề không có ${g.partCode}`)
    for (const q of input.questions) {
      const ep = epByCode.get(q.partCode)
      if (!ep) {
        errors.push(`Câu ${q.number}: đề không có ${q.partCode}`)
        continue
      }
      if (q.number < ep.questionStart || q.number > ep.questionEnd) errors.push(`Câu ${q.number}: nằm ngoài khoảng ${ep.questionStart}-${ep.questionEnd} của ${q.partCode}`)
      if (seenNumbers.has(q.number)) errors.push(`Câu ${q.number} bị trùng`)
      seenNumbers.add(q.number)
      if (new Set(q.options.map((o) => o.key)).size !== q.options.length) errors.push(`Câu ${q.number}: đáp án A-D bị trùng`)
      if (q.options.filter((o) => o.correct).length > 1) errors.push(`Câu ${q.number}: có nhiều hơn một đáp án đúng`)
      if (q.groupKey) {
        const g = groupKeys.get(q.groupKey)
        if (!g) errors.push(`Câu ${q.number}: không tìm thấy nhóm "${q.groupKey}"`)
        else if (g.partCode !== q.partCode) errors.push(`Câu ${q.number}: nhóm "${q.groupKey}" thuộc part khác`)
      }
    }
    const imageIds = [...new Set([...input.groups.map((g) => g.imageAssetId), ...input.questions.map((q) => q.imageAssetId)].filter((x): x is string => !!x))]
    if (imageIds.length) {
      const found = await this.db.select({ id: assets.id, mimeType: assets.mimeType }).from(assets).where(inArray(assets.id, imageIds))
      const byId = new Map(found.map((a) => [a.id, a]))
      for (const imageId of imageIds) {
        const a = byId.get(imageId)
        if (!a) errors.push(`Không tìm thấy file ảnh ${imageId}`)
        else if (!a.mimeType?.startsWith('image/')) errors.push(`File ${imageId} không phải ảnh`)
      }
    }
    if (errors.length) throw AppException.badRequest('Nội dung đề không hợp lệ', { problems: errors })

    await this.db.transaction(async (tx) => {
      const epIds = eps.map((r) => r.ep.id)
      await tx.delete(questions).where(inArray(questions.examPartId, epIds)) // options cascade
      await tx.delete(questionGroups).where(inArray(questionGroups.examPartId, epIds)) // passages cascade

      const groupId = new Map<string, string>()
      for (const [i, g] of input.groups.entries()) {
        const [row] = await tx
          .insert(questionGroups)
          .values({ examPartId: epByCode.get(g.partCode)!.id, groupKey: g.key, instructions: g.instructions, imageAssetId: g.imageAssetId, displayOrder: i })
          .returning({ id: questionGroups.id })
        groupId.set(g.key, row.id)
        if (g.passages.length) {
          await tx.insert(passages).values(g.passages.map((p, pi) => ({ groupId: row.id, label: p.label, title: p.title, content: p.content, displayOrder: pi })))
        }
      }
      for (const q of input.questions) {
        const [row] = await tx
          .insert(questions)
          .values({
            examPartId: epByCode.get(q.partCode)!.id,
            groupId: q.groupKey ? groupId.get(q.groupKey) : null,
            questionNumber: q.number,
            type: q.type,
            prompt: q.prompt,
            difficulty: q.difficulty,
            imageAssetId: q.imageAssetId,
          })
          .returning({ id: questions.id })
        await tx.insert(questionOptions).values(q.options.map((o) => ({ questionId: row.id, optionKey: o.key, optionText: o.text, isCorrect: o.correct })))
      }
      await tx.update(exams).set({ updatedAt: new Date() }).where(eq(exams.id, id))
    })

    await this.audit.log({
      action: 'EXAM_CONTENT_REPLACED',
      actorId: actor.id,
      entityType: 'exam',
      entityId: id,
      metadata: { questions: input.questions.length, groups: input.groups.length, withAnswerKey: input.questions.filter((q) => q.options.some((o) => o.correct)).length },
      ip: actor.ip,
    })
    return this.getContent(id)
  }

  /**
   * Idempotent import used by `import:create` against the *running* API (PGlite is in-process;
   * a second script opening the same folder would write a copy the web server never sees).
   */
  async importListeningDraft(actor: Actor, input: ImportListeningDraftInput): Promise<ExamSummaryDto> {
    const bucket = this.config.r2?.bucket
    if (!bucket) throw AppException.badRequest('Object storage is not configured')

    const assetId = new Map<string, string>()
    for (const a of input.assets) {
      const [row] = await this.db
        .insert(assets)
        .values({
          provider: 'CLOUDFLARE_R2',
          bucket,
          objectKey: a.objectKey,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          checksum: a.checksum,
          originalFilename: a.originalFilename,
          metadata: a.metadata,
        })
        .onConflictDoUpdate({
          target: [assets.provider, assets.bucket, assets.objectKey],
          set: {
            mimeType: sql`excluded.mime_type`,
            sizeBytes: sql`excluded.size_bytes`,
            checksum: sql`excluded.checksum`,
            originalFilename: sql`excluded.original_filename`,
            metadata: sql`excluded.metadata`,
          },
        })
        .returning({ id: assets.id, objectKey: assets.objectKey })
      assetId.set(row.objectKey, row.id)
    }

    let [exam] = await this.db.select({ id: exams.id, status: exams.status }).from(exams).where(eq(exams.code, input.exam.code)).limit(1)
    if (!exam) {
      const created = await this.create(actor, input.exam)
      exam = { id: created.id, status: created.status }
    }

    await this.replaceContent(actor, exam.id, {
      groups: input.groups.map((g) => ({
        key: g.key,
        partCode: g.partCode,
        instructions: g.instructions,
        passages: g.passages ?? [],
        imageAssetId: g.imageObjectKey ? assetId.get(g.imageObjectKey) : undefined,
      })),
      questions: input.questions.map((q) => ({
        number: q.number,
        partCode: q.partCode,
        type: q.type,
        prompt: q.prompt,
        groupKey: q.groupKey,
        imageAssetId: q.imageObjectKey ? assetId.get(q.imageObjectKey) : undefined,
        options: q.options,
      })),
    })

    if (input.audioObjectKey) {
      const audioId = assetId.get(input.audioObjectKey)
      if (!audioId) throw AppException.badRequest(`Không thấy asset audio ${input.audioObjectKey}`)
      await this.db.update(exams).set({ audioAssetId: audioId, updatedAt: new Date() }).where(eq(exams.id, exam.id))
    }

    if (exam.status === 'DRAFT') {
      await this.db.update(exams).set({ status: 'PENDING_REVIEW', updatedAt: new Date() }).where(eq(exams.id, exam.id))
    }

    const problems = await this.validateForPublish(exam.id)
    if (problems.length) {
      // Still saved; teacher sees PENDING_REVIEW. Do not fail the import.
    }
    return this.getSummary(exam.id)
  }

  /** Dev-only: CLI import when the API is already holding PGlite. Production still requires a logged-in teacher. */
  async importListeningDraftFromLoopback(ip: string | undefined, input: ImportListeningDraftInput): Promise<ExamSummaryDto> {
    if (this.config.isProd) throw AppException.unauthenticated()
    const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip?.endsWith('127.0.0.1')
    if (!loopback) throw AppException.unauthenticated()
    const [admin] = await this.db.select({ id: users.id, role: users.role }).from(users).where(eq(users.role, 'ADMIN')).limit(1)
    if (!admin) throw AppException.unauthenticated()
    return this.importListeningDraft({ id: admin.id, role: admin.role, ip }, input)
  }

  /** Self-authored exam → bank. Parts are stored as exam_parts so the teacher can pick them for homework. */
  async importAuthored(actor: Actor, input: ImportAuthoredExamInput): Promise<ExamSummaryDto> {
    const { groups, questions, publish, ...examInput } = input
    const codes = examInput.parts.map((p) => p.partCode)
    const skillRows = await this.db
      .select({ skill: skills.code })
      .from(parts)
      .innerJoin(skills, eq(skills.id, parts.skillId))
      .where(inArray(parts.code, codes))
    const skillSet = new Set(skillRows.map((r) => r.skill))
    if (skillSet.size > 1) throw AppException.badRequest('Mỗi đề chỉ thuộc Listening hoặc Reading. Hãy tách thành hai file.')
    const [existing] = await this.db.select({ id: exams.id }).from(exams).where(eq(exams.code, examInput.code)).limit(1)
    if (existing) throw AppException.conflict('Mã đề đã tồn tại trong ngân hàng. Hãy dùng mã khác.')
    const created = await this.create(actor, examInput)
    await this.replaceContent(actor, created.id, { groups, questions })
    if (publish) return this.publish(actor, created.id)
    return this.getSummary(created.id)
  }

  // ---------------------------------------------------------------- publish / archive
  /** Everything a student needs must be there: full coverage of every part range, ≥2 options, exactly one correct answer. */
  async validateForPublish(id: string): Promise<string[]> {
    const problems: string[] = []
    const eps = await this.db
      .select({ ep: examParts, code: parts.code })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .where(eq(examParts.examId, id))
      .orderBy(asc(examParts.displayOrder))
    const qs = await this.db
      .select({ id: questions.id, number: questions.questionNumber, epId: questions.examPartId, prompt: questions.prompt })
      .from(questions)
      .innerJoin(examParts, eq(examParts.id, questions.examPartId))
      .where(eq(examParts.examId, id))
    const opts = qs.length
      ? await this.db.select().from(questionOptions).where(inArray(questionOptions.questionId, qs.map((q) => q.id)))
      : []

    for (const { ep, code } of eps) {
      const have = new Set(qs.filter((q) => q.epId === ep.id).map((q) => q.number))
      const missing: number[] = []
      for (let n = ep.questionStart; n <= ep.questionEnd; n++) if (!have.has(n)) missing.push(n)
      if (missing.length) problems.push(`${code}: thiếu ${missing.length} câu (${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''})`)
    }
    for (const q of qs) {
      const o = opts.filter((x) => x.questionId === q.id)
      const correct = o.filter((x) => x.isCorrect).length
      if (o.length < 2) problems.push(`Câu ${q.number}: cần ít nhất 2 lựa chọn`)
      if (correct !== 1) problems.push(`Câu ${q.number}: phải có đúng 1 đáp án đúng (hiện có ${correct})`)
    }
    return problems
  }

  async publish(actor: Actor, id: string): Promise<ExamSummaryDto> {
    const exam = await this.requireExam(id)
    if (exam.status !== 'DRAFT' && exam.status !== 'ARCHIVED' && exam.status !== 'PENDING_REVIEW') {
      throw AppException.conflict(`Không thể xuất bản đề ở trạng thái ${exam.status}`)
    }
    const problems = await this.validateForPublish(id)
    if (problems.length) {
      throw new AppException(ERROR_CODES.EXAM_NOT_READY, 'Đề chưa đủ điều kiện xuất bản', HttpStatus.CONFLICT, { problems })
    }
    const [{ total }] = await this.db
      .select({ total: sql<number>`coalesce(sum(${examParts.questionEnd} - ${examParts.questionStart} + 1), 0)::int` })
      .from(examParts)
      .where(eq(examParts.examId, id))
    await this.db.update(exams).set({ status: 'PUBLISHED', publishedAt: new Date(), totalQuestions: total, updatedAt: new Date() }).where(eq(exams.id, id))
    await this.audit.log({ action: 'EXAM_PUBLISHED', actorId: actor.id, entityType: 'exam', entityId: id, ip: actor.ip })
    return this.getSummary(id)
  }

  /** Unpublish: students can no longer start it; existing attempts/results stay intact. */
  async archive(actor: Actor, id: string): Promise<ExamSummaryDto> {
    const exam = await this.requireExam(id)
    if (exam.status !== 'PUBLISHED') throw AppException.conflict('Chỉ đề đang xuất bản mới có thể lưu trữ')
    await this.db.update(exams).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(eq(exams.id, id))
    await this.audit.log({ action: 'EXAM_ARCHIVED', actorId: actor.id, entityType: 'exam', entityId: id, ip: actor.ip })
    return this.getSummary(id)
  }

  // ---------------------------------------------------------------- helpers
  private async requireExam(id: string): Promise<ExamRow> {
    const [row] = await this.db.select().from(exams).where(eq(exams.id, id)).limit(1)
    if (!row) throw AppException.notFound('Không tìm thấy đề thi')
    return row
  }

  async getSummary(id: string): Promise<ExamSummaryDto> {
    const [summary] = await this.toSummaries([await this.requireExam(id)])
    return summary
  }

  private async toSummaries(rows: ExamRow[]): Promise<ExamSummaryDto[]> {
    if (!rows.length) return []
    const eps = await this.db
      .select({ ep: examParts, part: parts, skill: skills.code })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .innerJoin(skills, eq(skills.id, parts.skillId))
      .where(inArray(examParts.examId, rows.map((r) => r.id)))
      .orderBy(asc(examParts.displayOrder))
    return rows.map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      description: e.description,
      status: e.status,
      difficulty: e.difficulty,
      durationSeconds: e.durationSeconds,
      totalQuestions: e.totalQuestions,
      hasAudio: e.audioAssetId !== null || eps.some((x) => x.ep.examId === e.id && x.ep.audioAssetId !== null),
      publishedAt: e.publishedAt?.toISOString() ?? null,
      parts: eps
        .filter((x) => x.ep.examId === e.id)
        .map<ExamPartDto>((x) => ({
          code: x.part.code,
          name: x.part.name,
          skill: x.skill as Skill,
          questionStart: x.ep.questionStart,
          questionEnd: x.ep.questionEnd,
          questionCount: x.ep.questionEnd - x.ep.questionStart + 1,
        })),
    }))
  }
}
