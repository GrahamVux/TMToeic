import { Inject, Injectable } from '@nestjs/common'
import { isFullSkillExam, type CreateExamBundleInput, type ExamBundleDto, type ExamStatus } from '@toeic/shared'
import { asc, eq, inArray } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { DB, type Db } from '../db/database.module'
import {
  examBundles,
  examParts,
  exams,
  parts,
  passages,
  questionGroups,
  questionOptions,
  questions,
  skills,
  type ExamRow,
} from '../db/schema'

type Actor = Pick<AuthUser, 'id' | 'role'> & { ip?: string }

type Graph = {
  exam: ExamRow
  parts: Array<{ id: string; partId: string; code: string; skill: string; displayOrder: number; questionStart: number; questionEnd: number; audioAssetId: string | null }>
  groups: Array<typeof questionGroups.$inferSelect>
  passageRows: Array<typeof passages.$inferSelect>
  questionRows: Array<typeof questions.$inferSelect>
  optionRows: Array<typeof questionOptions.$inferSelect>
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

@Injectable()
export class ExamBundlesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<ExamBundleDto[]> {
    const rows = await this.db.select().from(examBundles).orderBy(asc(examBundles.createdAt))
    if (!rows.length) return []
    const ids = [...new Set(rows.flatMap((row) => [row.examId, row.listeningExamId, row.readingExamId]))]
    const papers = await this.db.select().from(exams).where(inArray(exams.id, ids))
    const byId = new Map(papers.map((paper) => [paper.id, paper]))
    return rows.flatMap((row) => {
      const exam = byId.get(row.examId)
      const listening = byId.get(row.listeningExamId)
      const reading = byId.get(row.readingExamId)
      if (!exam || !listening || !reading) return []
      return [toDto(row.id, row.createdAt, exam, listening, reading)]
    })
  }

  async create(actor: Actor, input: CreateExamBundleInput): Promise<ExamBundleDto> {
    if (input.random) return this.createRandom(actor, input.code, input.title)
    return this.combine(actor, input.listeningExamId!, input.readingExamId!, input.code, input.title)
  }

  private async createRandom(actor: Actor, code: string, title: string): Promise<ExamBundleDto> {
    const [listening, reading, used] = await Promise.all([this.fullIds('LISTENING'), this.fullIds('READING'), this.usedPairs()])
    const free: Array<[string, string]> = []
    for (const left of listening) {
      for (const right of reading) if (!used.has(`${left}|${right}`)) free.push([left, right])
    }
    if (!free.length) throw AppException.conflict('Mọi cặp đề full Listening và Reading đã có bộ đề tổng hợp.')
    const [listeningExamId, readingExamId] = free[Math.floor(Math.random() * free.length)]!
    return this.combine(actor, listeningExamId, readingExamId, code, title)
  }

  private async combine(actor: Actor, listeningExamId: string, readingExamId: string, code: string, title: string): Promise<ExamBundleDto> {
    if (listeningExamId === readingExamId) throw AppException.badRequest('Hãy chọn hai đề khác nhau.')
    const listening = await this.loadGraph(listeningExamId)
    const reading = await this.loadGraph(readingExamId)
    this.assertFull(listening, 'LISTENING')
    this.assertFull(reading, 'READING')
    if (await this.pairExists(listeningExamId, readingExamId)) throw AppException.conflict('Cặp đề này đã có bộ đề tổng hợp.')
    const numbers = new Set(listening.questionRows.map((row) => row.questionNumber))
    const overlap = reading.questionRows.filter((row) => numbers.has(row.questionNumber)).map((row) => row.questionNumber)
    if (overlap.length) throw AppException.badRequest(`Hai đề đang dùng chung số câu ${overlap.slice(0, 8).join(', ')}.`)
    const [takenCode] = await this.db.select({ id: exams.id }).from(exams).where(eq(exams.code, code)).limit(1)
    if (takenCode) throw AppException.conflict(`Mã bộ đề ${code} đã được dùng.`)

    try {
      const created = await this.db.transaction(async (tx) => {
        const [exam] = await tx
          .insert(exams)
          .values({
            code,
            title,
            description: `${listening.exam.title} · ${reading.exam.title}`.slice(0, 2000),
            source: 'bundle',
            status: 'PUBLISHED',
            difficulty: 'MEDIUM',
            durationSeconds: listening.exam.durationSeconds + reading.exam.durationSeconds,
            totalQuestions: listening.questionRows.length + reading.questionRows.length,
            audioAssetId: listening.exam.audioAssetId,
            createdBy: actor.id,
            publishedAt: new Date(),
          })
          .returning()
        for (const graph of [listening, reading]) await this.copyGraph(tx, exam.id, graph)
        const [bundle] = await tx
          .insert(examBundles)
          .values({ examId: exam.id, listeningExamId, readingExamId, createdBy: actor.id })
          .returning()
        return { exam, bundle }
      })
      await this.audit.log({
        action: 'EXAM_BUNDLE_CREATED',
        actorId: actor.id,
        entityType: 'exam',
        entityId: created.exam.id,
        metadata: { listeningExamId, readingExamId, code: created.exam.code },
        ip: actor.ip,
      })
      return toDto(created.bundle.id, created.bundle.createdAt, created.exam, listening.exam, reading.exam)
    } catch (err) {
      if (isUniqueViolation(err)) throw AppException.conflict('Cặp đề này đã có bộ đề tổng hợp.')
      throw err
    }
  }

  private async pairExists(listeningExamId: string, readingExamId: string): Promise<boolean> {
    const rows = await this.db.select({ readingExamId: examBundles.readingExamId }).from(examBundles).where(eq(examBundles.listeningExamId, listeningExamId))
    return rows.some((row) => row.readingExamId === readingExamId)
  }

  private assertFull(graph: Graph, skill: 'LISTENING' | 'READING') {
    const label = skill === 'LISTENING' ? 'Listening đủ Part 1–4' : 'Reading đủ Part 5–7'
    if (graph.exam.status === 'ARCHIVED') throw AppException.badRequest(`Đề ${graph.exam.code} đã lưu trữ.`)
    if (!isFullSkillExam(graph.parts, skill)) throw AppException.badRequest(`Đề ${graph.exam.code} không phải đề ${label}.`)
  }

  private async fullIds(skill: 'LISTENING' | 'READING'): Promise<string[]> {
    const rows = await this.db
      .select({ examId: exams.id, status: exams.status, source: exams.source, code: parts.code, skill: skills.code })
      .from(exams)
      .innerJoin(examParts, eq(examParts.examId, exams.id))
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .innerJoin(skills, eq(skills.id, parts.skillId))
    const grouped = new Map<string, { status: string; source: string | null; parts: Array<{ code: string; skill: string }> }>()
    for (const row of rows) {
      const current = grouped.get(row.examId) ?? { status: row.status, source: row.source, parts: [] }
      current.parts.push({ code: row.code, skill: row.skill })
      grouped.set(row.examId, current)
    }
    return [...grouped.entries()]
      .filter(([, exam]) => exam.status !== 'ARCHIVED' && exam.source !== 'bundle' && isFullSkillExam(exam.parts, skill))
      .map(([id]) => id)
  }

  private async usedPairs(): Promise<Set<string>> {
    const rows = await this.db.select({ listeningExamId: examBundles.listeningExamId, readingExamId: examBundles.readingExamId }).from(examBundles)
    return new Set(rows.map((row) => `${row.listeningExamId}|${row.readingExamId}`))
  }

  private async loadGraph(examId: string): Promise<Graph> {
    const [exam] = await this.db.select().from(exams).where(eq(exams.id, examId)).limit(1)
    if (!exam) throw AppException.notFound('Không tìm thấy đề thi')
    const partRows = await this.db
      .select({ part: examParts, code: parts.code, skill: skills.code })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .innerJoin(skills, eq(skills.id, parts.skillId))
      .where(eq(examParts.examId, examId))
    const partIds = partRows.map((row) => row.part.id)
    const groups = partIds.length ? await this.db.select().from(questionGroups).where(inArray(questionGroups.examPartId, partIds)) : []
    const groupIds = groups.map((row) => row.id)
    const passageRows = groupIds.length ? await this.db.select().from(passages).where(inArray(passages.groupId, groupIds)) : []
    const questionRows = partIds.length ? await this.db.select().from(questions).where(inArray(questions.examPartId, partIds)) : []
    const questionIds = questionRows.map((row) => row.id)
    const optionRows = questionIds.length ? await this.db.select().from(questionOptions).where(inArray(questionOptions.questionId, questionIds)) : []
    return {
      exam,
      parts: partRows.map((row) => ({
        id: row.part.id,
        partId: row.part.partId,
        code: row.code,
        skill: row.skill,
        displayOrder: row.part.displayOrder,
        questionStart: row.part.questionStart,
        questionEnd: row.part.questionEnd,
        audioAssetId: row.part.audioAssetId,
      })),
      groups,
      passageRows,
      questionRows,
      optionRows,
    }
  }

  private async copyGraph(tx: Db, examId: string, graph: Graph) {
    if (!graph.parts.length) return
    const insertedParts = await tx
      .insert(examParts)
      .values(
        graph.parts.map((part) => ({
          examId,
          partId: part.partId,
          displayOrder: part.displayOrder,
          questionStart: part.questionStart,
          questionEnd: part.questionEnd,
          audioAssetId: part.audioAssetId,
        })),
      )
      .returning()
    const partMap = new Map(graph.parts.map((part) => [part.id, insertedParts.find((row) => row.partId === part.partId)!.id]))
    const groupMap = new Map<string, string>()
    if (graph.groups.length) {
      const insertedGroups = await tx
        .insert(questionGroups)
        .values(
          graph.groups.map((group) => ({
            examPartId: partMap.get(group.examPartId)!,
            groupKey: group.groupKey,
            instructions: group.instructions,
            audioAssetId: group.audioAssetId,
            imageAssetId: group.imageAssetId,
            displayOrder: group.displayOrder,
          })),
        )
        .returning()
      for (const group of graph.groups) {
        const created = insertedGroups.find((row) => row.examPartId === partMap.get(group.examPartId) && row.groupKey === group.groupKey)
        if (created) groupMap.set(group.id, created.id)
      }
    }
    if (graph.passageRows.length) {
      await tx.insert(passages).values(
        graph.passageRows.map((passage) => ({
          groupId: groupMap.get(passage.groupId)!,
          label: passage.label,
          title: passage.title,
          content: passage.content,
          imageAssetId: passage.imageAssetId,
          displayOrder: passage.displayOrder,
        })),
      )
    }
    const questionMap = new Map<string, string>()
    if (graph.questionRows.length) {
      const insertedQuestions = await tx
        .insert(questions)
        .values(
          graph.questionRows.map((question) => ({
            examPartId: partMap.get(question.examPartId)!,
            groupId: question.groupId ? groupMap.get(question.groupId) ?? null : null,
            questionNumber: question.questionNumber,
            type: question.type,
            prompt: question.prompt,
            imageAssetId: question.imageAssetId,
            audioAssetId: question.audioAssetId,
            videoAssetId: question.videoAssetId,
            explanationStatus: question.explanationStatus,
            explanation: question.explanation,
            difficulty: question.difficulty,
            acceptedAnswers: question.acceptedAnswers,
          })),
        )
        .returning()
      for (const question of graph.questionRows) {
        const created = insertedQuestions.find((row) => row.examPartId === partMap.get(question.examPartId) && row.questionNumber === question.questionNumber)
        if (created) questionMap.set(question.id, created.id)
      }
    }
    if (graph.optionRows.length) {
      await tx.insert(questionOptions).values(
        graph.optionRows.map((option) => ({
          questionId: questionMap.get(option.questionId)!,
          optionKey: option.optionKey,
          optionText: option.optionText,
          imageAssetId: option.imageAssetId,
          isCorrect: option.isCorrect,
        })),
      )
    }
  }
}

function toDto(id: string, createdAt: Date, exam: ExamRow, listening: ExamRow, reading: ExamRow): ExamBundleDto {
  return {
    id,
    examId: exam.id,
    code: exam.code,
    title: exam.title,
    status: exam.status as ExamStatus,
    listeningExamId: listening.id,
    readingExamId: reading.id,
    listeningCode: listening.code,
    listeningTitle: listening.title,
    readingCode: reading.code,
    readingTitle: reading.title,
    createdAt: createdAt.toISOString(),
  }
}
