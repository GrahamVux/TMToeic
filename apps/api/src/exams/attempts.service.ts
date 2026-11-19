import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import {
  ERROR_CODES,
  FILL_EXAM_SOURCE,
  FILL_QUESTION_TYPE,
  FOCUS_MIN_AWAY_SECONDS,
  fillAnswerMatches,
  isFocusWatched,
  type AttemptAudioDto,
  type AttemptDto,
  type AttemptPlayerDto,
  type AttemptResultDto,
  type AttemptReviewDto,
  type FocusReportDto,
  type GroupDto,
  type PartResultDto,
  type PlayerQuestionDto,
  type RecordFocusInput,
  type RecordFocusResult,
  type SaveAnswerInput,
  type SheetImageDto,
  type Skill,
  type StartAttemptInput,
} from '@toeic/shared'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import type { AuthUser } from '../common/decorators'
import { DB, type Db } from '../db/database.module'
import {
  attemptAnswers,
  attemptFocusLeaves,
  attempts,
  assignments,
  assignmentImages,
  assignmentStudents,
  examParts,
  exams,
  parts,
  passages,
  questionGroups,
  questionOptions,
  questions,
  skills,
  users,
  type AttemptRow,
  type ExamRow,
} from '../db/schema'
import { ExamAudioService } from './exam-audio'
import { summarizeScores, type SkillTally } from './scoring'

type Actor = Pick<AuthUser, 'id' | 'role'> & { ip?: string }
type Reader = Pick<Db, 'select'>

/** Answers sent within this window after the deadline still count (network latency on the last click). */
const DEADLINE_GRACE_MS = 5_000

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

type ScopeQuestion = {
  id: string
  number: number
  partCode: string
  skill: Skill
  groupId: string | null
  type: string | null
  prompt: string
  imageAssetId: string | null
}

@Injectable()
export class AttemptsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly examAudio: ExamAudioService,
  ) {}

  // ---------------------------------------------------------------- start / resume
  async start(actor: Actor, examId: string, input: StartAttemptInput): Promise<AttemptDto> {
    const [exam] = await this.db.select().from(exams).where(eq(exams.id, examId)).limit(1)
    if (!exam || exam.status !== 'PUBLISHED') throw AppException.notFound('Không tìm thấy đề thi')

    const examParts_ = await this.db
      .select({ code: parts.code, order: examParts.displayOrder })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .where(eq(examParts.examId, examId))
      .orderBy(asc(examParts.displayOrder))
    const allCodes = examParts_.map((p) => p.code)

    // FULL_TEST always covers everything; other modes may narrow to chosen parts.
    const requested = input.mode === 'FULL_TEST' ? undefined : input.partCodes
    if (requested) {
      const bad = requested.filter((c) => !allCodes.includes(c))
      if (bad.length) throw AppException.badRequest(`Đề không có part: ${bad.join(', ')}`)
    }
    const partCodes = requested ? allCodes.filter((c) => requested.includes(c)) : allCodes
    const scopeKey = partCodes.length === allCodes.length ? 'ALL' : [...partCodes].sort().join(',')

    // Resume a live attempt instead of creating a duplicate; close it if it already ran out of time.
    const [live] = await this.db
      .select()
      .from(attempts)
      .where(and(eq(attempts.userId, actor.id), eq(attempts.examId, examId), eq(attempts.mode, input.mode), eq(attempts.scopeKey, scopeKey), eq(attempts.status, 'IN_PROGRESS')))
      .limit(1)
    if (live) {
      const current = await this.expireIfNeeded(live)
      if (current.status === 'IN_PROGRESS') {
        // A mock test is one sitting. Leaving it, or starting again, ends that sitting. Practice still resumes.
        if (input.mode === 'FULL_TEST' && !current.assignmentId) await this.finalize(current, 'ABANDONED')
        else return this.toDto(current, exam.title)
      }
    }

    const scope = await this.scopeQuestions(this.db, examId, partCodes)
    if (scope.length === 0) throw AppException.badRequest('Đề chưa có câu hỏi trong phạm vi đã chọn')

    const now = new Date()
    let deadlineAt: Date | null = null
    if (input.mode === 'FULL_TEST') deadlineAt = new Date(now.getTime() + exam.durationSeconds * 1000)
    else if (input.mode === 'TIMED') {
      const seconds = Math.max(60, Math.round((exam.durationSeconds * scope.length) / Math.max(1, exam.totalQuestions)))
      deadlineAt = new Date(now.getTime() + seconds * 1000)
    }

    try {
      const [row] = await this.db
        .insert(attempts)
        .values({ userId: actor.id, examId, mode: input.mode, partCodes, scopeKey, startedAt: now, deadlineAt, totalQuestions: scope.length })
        .returning()
      await this.audit.log({ action: 'EXAM_STARTED', actorId: actor.id, entityType: 'attempt', entityId: row.id, metadata: { examId, mode: input.mode }, ip: actor.ip })
      return this.toDto(row, exam.title)
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      // Lost a race with a concurrent start → return the winner.
      const [winner] = await this.db
        .select()
        .from(attempts)
        .where(and(eq(attempts.userId, actor.id), eq(attempts.examId, examId), eq(attempts.mode, input.mode), eq(attempts.scopeKey, scopeKey), eq(attempts.status, 'IN_PROGRESS')))
        .limit(1)
      if (!winner) throw err
      return this.toDto(winner, exam.title)
    }
  }

  /** Start or resume the student's sitting of a published assignment. */
  async startFromAssignment(actor: Actor, assignmentId: string): Promise<AttemptDto> {
    const [asg] = await this.db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1)
    if (!asg) throw AppException.notFound('Không tìm thấy bài tập')
    if (asg.status === 'DRAFT') throw AppException.notFound('Không tìm thấy bài tập')

    const [assigned] = await this.db
      .select({ userId: assignmentStudents.userId })
      .from(assignmentStudents)
      .where(and(eq(assignmentStudents.assignmentId, assignmentId), eq(assignmentStudents.userId, actor.id)))
      .limit(1)
    if (!assigned) throw AppException.forbidden('Bài tập này không được giao cho bạn')

    const [latest] = await this.db
      .select()
      .from(attempts)
      .where(and(eq(attempts.assignmentId, assignmentId), eq(attempts.userId, actor.id)))
      .orderBy(desc(attempts.startedAt))
      .limit(1)
    if (latest) {
      const current = await this.expireIfNeeded(latest)
      if (current.status === 'IN_PROGRESS') {
        const exam = await this.requireExam(current.examId)
        return this.toDto(current, exam.title)
      }
      if (current.status === 'SUBMITTED' || current.status === 'EXPIRED') {
        throw AppException.conflict('Bài tập đã được nộp')
      }
    }

    if (asg.status === 'CLOSED') throw AppException.forbidden('Bài tập đã đóng')
    if (asg.dueAt && asg.dueAt.getTime() < Date.now()) throw AppException.forbidden('Đã hết hạn nộp bài')

    const [exam] = await this.db.select().from(exams).where(eq(exams.id, asg.examId)).limit(1)
    const fillHomework = exam?.source === FILL_EXAM_SOURCE && exam.status === 'DRAFT'
    if (!exam || (exam.status !== 'PUBLISHED' && !fillHomework)) throw AppException.notFound('Không tìm thấy đề thi')

    const examParts_ = await this.db
      .select({ code: parts.code, order: examParts.displayOrder })
      .from(examParts)
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .where(eq(examParts.examId, exam.id))
      .orderBy(asc(examParts.displayOrder))
    const allCodes = examParts_.map((p) => p.code)
    const requested = asg.partCodes
    const bad = requested.filter((c) => !allCodes.includes(c))
    if (bad.length) throw AppException.badRequest(`Đề không có part: ${bad.join(', ')}`)
    const partCodes = allCodes.filter((c) => requested.includes(c))
    const scopeKey = partCodes.length === allCodes.length ? 'ALL' : [...partCodes].sort().join(',')
    const scope = await this.scopeQuestions(this.db, exam.id, partCodes)
    if (scope.length === 0) throw AppException.badRequest('Đề chưa có câu hỏi trong phạm vi đã chọn')

    const now = new Date()
    const deadlineAt = new Date(now.getTime() + asg.durationSeconds * 1000)
    try {
      const [row] = await this.db
        .insert(attempts)
        .values({
          userId: actor.id,
          examId: exam.id,
          assignmentId,
          mode: 'TIMED',
          partCodes,
          scopeKey,
          startedAt: now,
          deadlineAt,
          totalQuestions: scope.length,
        })
        .returning()
      await this.audit.log({
        action: 'ASSIGNMENT_STARTED',
        actorId: actor.id,
        entityType: 'attempt',
        entityId: row.id,
        metadata: { assignmentId, examId: exam.id },
        ip: actor.ip,
      })
      return this.toDto(row, exam.title)
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      const [winner] = await this.db
        .select()
        .from(attempts)
        .where(and(eq(attempts.userId, actor.id), eq(attempts.assignmentId, assignmentId), eq(attempts.status, 'IN_PROGRESS')))
        .limit(1)
      if (!winner) throw err
      return this.toDto(winner, exam.title)
    }
  }

  // ---------------------------------------------------------------- read
  async list(actor: Actor): Promise<AttemptResultDto[]> {
    const rows = await this.db.select().from(attempts).where(eq(attempts.userId, actor.id)).orderBy(desc(attempts.startedAt)).limit(100)
    const out: AttemptResultDto[] = []
    for (const r of rows) {
      const current = await this.expireIfNeeded(r)
      out.push(this.presentResult(actor, await this.buildResult(current, current.status === 'IN_PROGRESS')))
    }
    return out
  }

  /** The player payload. Never includes `is_correct`, even after submit — review is a separate endpoint. */
  async getPlayer(actor: Actor, attemptId: string): Promise<AttemptPlayerDto> {
    const attempt = await this.expireIfNeeded(await this.requireOwn(actor, attemptId))
    const exam = await this.requireExam(attempt.examId)
    const { questions: qs, groups } = await this.loadPlayerContent(attempt)
    const answered = qs.filter((q) => (q.type === FILL_QUESTION_TYPE ? !!q.answerText?.trim() : q.selectedKey !== null)).length
    const audio = await this.audioFor(attempt)
    const sheetImages = await this.sheetImages(attempt.assignmentId)
    return { attempt: this.toDto(attempt, exam.title, answered), groups, questions: qs, audio, sheetImages }
  }

  async getAudio(actor: Actor, attemptId: string): Promise<AttemptAudioDto> {
    const attempt = await this.requireReadable(actor, attemptId)
    return { audio: await this.audioFor(attempt) }
  }

  // ---------------------------------------------------------------- answer (autosave)
  async saveAnswer(actor: Actor, attemptId: string, questionId: string, input: SaveAnswerInput): Promise<{ savedAt: string; remainingSeconds: number | null }> {
    const attempt = await this.requireOwn(actor, attemptId)
    if (attempt.status !== 'IN_PROGRESS') throw this.closed()
    if (attempt.deadlineAt && Date.now() > attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS) {
      await this.expireIfNeeded(attempt)
      throw this.closed()
    }

    const scope = await this.scopeQuestions(this.db, attempt.examId, attempt.partCodes)
    const question = scope.find((q) => q.id === questionId)
    if (!question) throw AppException.notFound('Câu hỏi không thuộc bài làm này')

    const now = new Date()
    const spent = sql`coalesce(${input.timeSpentSeconds ?? null}, ${attemptAnswers.timeSpentSeconds})`
    if (question.type === FILL_QUESTION_TYPE) {
      if (input.answerText === undefined) throw AppException.badRequest('Câu điền từ cần chữ đã gõ')
      const text = input.answerText?.trim() ?? ''
      if (!text) {
        await this.db.delete(attemptAnswers).where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.questionId, questionId)))
      } else {
        await this.db
          .insert(attemptAnswers)
          .values({ attemptId, questionId, answerText: text, answeredAt: now, timeSpentSeconds: input.timeSpentSeconds })
          .onConflictDoUpdate({
            target: [attemptAnswers.attemptId, attemptAnswers.questionId],
            set: { answerText: text, selectedOptionId: null, answeredAt: now, timeSpentSeconds: spent },
          })
      }
    } else if (input.selectedKey === undefined) {
      throw AppException.badRequest('Câu trắc nghiệm cần đáp án A B C D')
    } else if (input.selectedKey === null) {
      await this.db.delete(attemptAnswers).where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.questionId, questionId)))
    } else {
      const [option] = await this.db
        .select({ id: questionOptions.id })
        .from(questionOptions)
        .where(and(eq(questionOptions.questionId, questionId), eq(questionOptions.optionKey, input.selectedKey)))
        .limit(1)
      if (!option) throw AppException.badRequest('Lựa chọn không tồn tại cho câu hỏi này')
      await this.db
        .insert(attemptAnswers)
        .values({ attemptId, questionId, selectedOptionId: option.id, answeredAt: now, timeSpentSeconds: input.timeSpentSeconds })
        .onConflictDoUpdate({
          target: [attemptAnswers.attemptId, attemptAnswers.questionId],
          set: { selectedOptionId: option.id, answerText: null, answeredAt: now, timeSpentSeconds: spent },
        })
    }
    const remaining = attempt.deadlineAt ? Math.max(0, Math.floor((attempt.deadlineAt.getTime() - Date.now()) / 1000)) : null
    return { savedAt: new Date().toISOString(), remainingSeconds: remaining }
  }

  /**
   * `away` opens one leave; a second away while one is open is a no-op.
   * `back` closes it. Under a second is deleted so a click on the browser chrome is not a leave.
   */
  async recordFocus(actor: Actor, attemptId: string, input: RecordFocusInput): Promise<RecordFocusResult> {
    const attempt = await this.requireOwn(actor, attemptId)
    if (attempt.status !== 'IN_PROGRESS') throw this.closed()
    if (attempt.deadlineAt && Date.now() > attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS) {
      await this.expireIfNeeded(attempt)
      throw this.closed()
    }
    if (!isFocusWatched(attempt)) return { recorded: false }
    const now = new Date()
    if (input.state === 'away') {
      try {
        await this.db.insert(attemptFocusLeaves).values({ attemptId, leftAt: now })
      } catch (err) {
        if (!isUniqueViolation(err)) throw err
      }
      return { recorded: true }
    }
    const [open] = await this.db
      .select()
      .from(attemptFocusLeaves)
      .where(and(eq(attemptFocusLeaves.attemptId, attemptId), isNull(attemptFocusLeaves.returnedAt)))
      .orderBy(desc(attemptFocusLeaves.leftAt))
      .limit(1)
    if (!open) return { recorded: false }
    const awaySeconds = Math.max(0, Math.floor((now.getTime() - open.leftAt.getTime()) / 1000))
    if (awaySeconds < FOCUS_MIN_AWAY_SECONDS) {
      await this.db.delete(attemptFocusLeaves).where(eq(attemptFocusLeaves.id, open.id))
      return { recorded: false }
    }
    await this.db.update(attemptFocusLeaves).set({ returnedAt: now, awaySeconds }).where(eq(attemptFocusLeaves.id, open.id))
    return { recorded: true }
  }

  // ---------------------------------------------------------------- submit (idempotent)
  /** Ends a mock test the student left. Practice and homework sittings stay open. */
  async abandon(actor: Actor, attemptId: string): Promise<{ status: string }> {
    const attempt = await this.requireOwn(actor, attemptId)
    if (attempt.mode !== 'FULL_TEST' || attempt.assignmentId) return { status: attempt.status }
    if (attempt.status !== 'IN_PROGRESS') return { status: attempt.status }
    const done = await this.finalize(attempt, 'ABANDONED')
    return { status: done.status }
  }

  async submit(actor: Actor, attemptId: string): Promise<AttemptResultDto> {
    const attempt = await this.requireOwn(actor, attemptId)
    const closed = attempt.status === 'IN_PROGRESS' ? await this.expireIfNeeded(attempt) : attempt
    // Already finished (double click, retry after a network error, auto-submit raced the button): same result, scored once.
    const done = closed.status === 'IN_PROGRESS' ? await this.finalize(closed, 'SUBMITTED') : closed
    if (done.id === attempt.id && attempt.status === 'IN_PROGRESS' && done.status === 'SUBMITTED') {
      await this.audit.log({ action: 'EXAM_SUBMITTED', actorId: actor.id, entityType: 'attempt', entityId: done.id, metadata: { totalScore: done.totalScore }, ip: actor.ip })
    }
    return this.presentResult(actor, await this.buildResult(done, false))
  }

  async getResult(actor: Actor, attemptId: string): Promise<AttemptResultDto> {
    const attempt = await this.expireIfNeeded(await this.requireReadable(actor, attemptId))
    if (attempt.status === 'IN_PROGRESS') throw AppException.conflict('Bài làm chưa nộp nên chưa có kết quả')
    return this.presentResult(actor, await this.buildResult(attempt, false))
  }

  /** Review with the answer key — only after the attempt is finished. */
  async getReview(actor: Actor, attemptId: string): Promise<AttemptReviewDto> {
    const attempt = await this.expireIfNeeded(await this.requireReadable(actor, attemptId))
    if (attempt.status === 'IN_PROGRESS') throw AppException.conflict('Chỉ xem được đáp án sau khi nộp bài')
    const { questions: qs, groups } = await this.loadPlayerContent(attempt)
    const qIds = qs.map((q) => q.id)
    const correct = qIds.length
      ? await this.db
          .select({ questionId: questionOptions.questionId, key: questionOptions.optionKey })
          .from(questionOptions)
          .where(and(eq(questionOptions.isCorrect, true), inArray(questionOptions.questionId, qIds)))
      : []
    const keyByQ = new Map(correct.map((c) => [c.questionId, c.key]))
    const graded = qIds.length
      ? await this.db
          .select({ questionId: attemptAnswers.questionId, isCorrect: attemptAnswers.isCorrect })
          .from(attemptAnswers)
          .where(eq(attemptAnswers.attemptId, attempt.id))
      : []
    const gradedByQ = new Map(graded.map((row) => [row.questionId, row.isCorrect]))
    const fillIds = qs.filter((q) => q.type === FILL_QUESTION_TYPE).map((q) => q.id)
    const acceptedRows = fillIds.length
      ? await this.db.select({ id: questions.id, accepted: questions.acceptedAnswers }).from(questions).where(inArray(questions.id, fillIds))
      : []
    const acceptedByQ = new Map(acceptedRows.map((row) => [row.id, row.accepted ?? []]))
    const explanationRows = qIds.length
      ? await this.db.select({ id: questions.id, explanation: questions.explanation }).from(questions).where(inArray(questions.id, qIds))
      : []
    const explanationByQ = new Map(explanationRows.map((row) => [row.id, row.explanation]))
    return {
      result: this.presentResult(actor, await this.buildResult(attempt, false)),
      groups,
      questions: qs.map((q) => {
        const explanation = explanationByQ.get(q.id) || null
        if (q.type === FILL_QUESTION_TYPE) {
          const accepted = acceptedByQ.get(q.id) ?? []
          return { ...q, correctKey: '', correctText: accepted.join(' / '), isCorrect: q.answerText ? (gradedByQ.get(q.id) ?? false) : null, explanation }
        }
        const correctKey = keyByQ.get(q.id) ?? ''
        return { ...q, correctKey, correctText: null, isCorrect: q.selectedKey === null ? null : q.selectedKey === correctKey, explanation }
      }),
      audio: await this.audioFor(attempt),
      sheetImages: await this.sheetImages(attempt.assignmentId),
    }
  }

  /** Homework file wins for the parts in this sitting; otherwise the exam's own recordings. */
  private async audioFor(attempt: Pick<AttemptRow, 'examId' | 'partCodes' | 'assignmentId'>) {
    let assignmentAudioId: string | null = null
    if (attempt.assignmentId) {
      const [row] = await this.db.select({ audioAssetId: assignments.audioAssetId }).from(assignments).where(eq(assignments.id, attempt.assignmentId)).limit(1)
      assignmentAudioId = row?.audioAssetId ?? null
    }
    return this.examAudio.tracksFor(attempt.examId, attempt.partCodes, assignmentAudioId)
  }

  private async sheetImages(assignmentId: string | null): Promise<SheetImageDto[]> {
    if (!assignmentId) return []
    const rows = await this.db
      .select({ id: assignmentImages.id, assetId: assignmentImages.assetId })
      .from(assignmentImages)
      .where(eq(assignmentImages.assignmentId, assignmentId))
      .orderBy(asc(assignmentImages.displayOrder), asc(assignmentImages.createdAt))
    const urls = await this.examAudio.signedImageUrls(rows.map((r) => r.assetId))
    return rows.flatMap((r) => {
      const url = urls.get(r.assetId)
      return url ? [{ id: r.id, url }] : []
    })
  }

  /**
   * Scores an open sitting once the clock plus the short grace has passed.
   * Used when a student closes the laptop at 0:00 so the result exists without them opening the player again.
   */
  async closeIfPastDeadline(row: AttemptRow): Promise<AttemptRow> {
    return this.expireIfNeeded(row)
  }

  // ---------------------------------------------------------------- finalize + scoring
  private async expireIfNeeded(a: AttemptRow): Promise<AttemptRow> {
    if (a.status === 'IN_PROGRESS' && a.deadlineAt && Date.now() > a.deadlineAt.getTime() + DEADLINE_GRACE_MS) {
      return this.finalize(a, 'EXPIRED')
    }
    return a
  }

  /** Atomically claims the attempt (IN_PROGRESS → final status) and scores it in the same transaction — exactly once. */
  private async finalize(a: AttemptRow, status: 'SUBMITTED' | 'EXPIRED' | 'ABANDONED'): Promise<AttemptRow> {
    return this.db.transaction(async (tx) => {
      const submittedAt = status === 'EXPIRED' && a.deadlineAt ? a.deadlineAt : new Date()
      const [claimed] = await tx
        .update(attempts)
        .set({ status, submittedAt, durationSeconds: Math.max(0, Math.round((submittedAt.getTime() - a.startedAt.getTime()) / 1000)) })
        .where(and(eq(attempts.id, a.id), eq(attempts.status, 'IN_PROGRESS')))
        .returning()
      if (!claimed) {
        const [existing] = await tx.select().from(attempts).where(eq(attempts.id, a.id)).limit(1)
        return existing
      }
      await this.closeOpenFocus(tx, a.id, submittedAt)

      const scope = await this.scopeQuestions(tx, a.examId, a.partCodes)
      const qIds = scope.map((q) => q.id)
      const correctRows = qIds.length
        ? await tx.select({ id: questionOptions.id, questionId: questionOptions.questionId }).from(questionOptions).where(and(eq(questionOptions.isCorrect, true), inArray(questionOptions.questionId, qIds)))
        : []
      const correctOptionByQ = new Map(correctRows.map((r) => [r.questionId, r.id]))
      const fillRows = qIds.length
        ? await tx.select({ id: questions.id, type: questions.type, accepted: questions.acceptedAnswers }).from(questions).where(inArray(questions.id, qIds))
        : []
      const acceptedByQ = new Map(fillRows.filter((q) => q.type === FILL_QUESTION_TYPE).map((q) => [q.id, q.accepted ?? []]))
      const answers = await tx.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, a.id))

      const correctAnswerIds: string[] = []
      const wrongAnswerIds: string[] = []
      const correctQ = new Set<string>()
      for (const ans of answers) {
        const accepted = acceptedByQ.get(ans.questionId)
        const ok = accepted
          ? !!ans.answerText && fillAnswerMatches(ans.answerText, accepted)
          : ans.selectedOptionId !== null && ans.selectedOptionId === correctOptionByQ.get(ans.questionId)
        if (ok) {
          correctAnswerIds.push(ans.id)
          correctQ.add(ans.questionId)
        } else wrongAnswerIds.push(ans.id)
      }
      if (correctAnswerIds.length) await tx.update(attemptAnswers).set({ isCorrect: true }).where(inArray(attemptAnswers.id, correctAnswerIds))
      if (wrongAnswerIds.length) await tx.update(attemptAnswers).set({ isCorrect: false }).where(inArray(attemptAnswers.id, wrongAnswerIds))

      const [exam] = await tx.select().from(exams).where(eq(exams.id, a.examId)).limit(1)
      const examTotals = await this.examSkillTotals(tx, a.examId)
      const tallies: SkillTally[] = [...examTotals].map(([skill, examTotal]) => {
        const inScope = scope.filter((q) => q.skill === skill)
        return { skill, examTotal, scopeTotal: inScope.length, correct: inScope.filter((q) => correctQ.has(q.id)).length }
      })
      const scores = summarizeScores(tallies, exam.scoringConfig)

      const answeredIds = new Set(answers.map((x) => x.questionId))
      const answered = scope.filter((q) => answeredIds.has(q.id)).length
      const [updated] = await tx
        .update(attempts)
        .set({
          totalScore: scores.totalScore,
          listeningScore: scores.listeningScore,
          readingScore: scores.readingScore,
          correctCount: correctQ.size,
          incorrectCount: answered - correctQ.size,
          unansweredCount: scope.length - answered,
        })
        .where(eq(attempts.id, a.id))
        .returning()
      return updated
    })
  }

  /** The leave tally is for teachers. Students keep the warning during the exam, not the count afterwards. */
  private presentResult(actor: Actor, result: AttemptResultDto): AttemptResultDto {
    if (actor.role === 'TEACHER' || actor.role === 'ADMIN') return result
    return { ...result, focus: null }
  }

  private async buildResult(a: AttemptRow, live: boolean): Promise<AttemptResultDto> {
    const exam = await this.requireExam(a.examId)
    const dto = await this.withAnswered(a, exam)
    if (live) {
      return { attempt: dto, totalScore: null, listeningScore: null, readingScore: null, correctCount: 0, incorrectCount: 0, unansweredCount: a.totalQuestions - dto.answeredCount, durationSeconds: 0, parts: [], focus: null }
    }
    const scope = await this.scopeQuestions(this.db, a.examId, a.partCodes)
    const answers = await this.db.select({ questionId: attemptAnswers.questionId, isCorrect: attemptAnswers.isCorrect }).from(attemptAnswers).where(eq(attemptAnswers.attemptId, a.id))
    const correctQ = new Set(answers.filter((x) => x.isCorrect).map((x) => x.questionId))
    const partResults: PartResultDto[] = a.partCodes.map((code) => {
      const inPart = scope.filter((q) => q.partCode === code)
      const correct = inPart.filter((q) => correctQ.has(q.id)).length
      return { partCode: code, skill: inPart[0]?.skill ?? 'READING', total: inPart.length, correct, accuracy: inPart.length ? Math.round((correct / inPart.length) * 100) : 0 }
    })
    return {
      attempt: dto,
      totalScore: a.totalScore,
      listeningScore: a.listeningScore,
      readingScore: a.readingScore,
      correctCount: a.correctCount ?? 0,
      incorrectCount: a.incorrectCount ?? 0,
      unansweredCount: a.unansweredCount ?? 0,
      durationSeconds: a.durationSeconds ?? 0,
      parts: partResults,
      focus: await this.focusReport(a),
    }
  }

  /** Closes a leave that was still open when the sitting ended (the student submitted from another window, or the clock ran out). */
  private async closeOpenFocus(tx: Pick<Db, 'select' | 'update' | 'delete'>, attemptId: string, endedAt: Date) {
    const open = await tx
      .select()
      .from(attemptFocusLeaves)
      .where(and(eq(attemptFocusLeaves.attemptId, attemptId), isNull(attemptFocusLeaves.returnedAt)))
    for (const row of open) {
      const awaySeconds = Math.max(0, Math.floor((endedAt.getTime() - row.leftAt.getTime()) / 1000))
      if (awaySeconds < FOCUS_MIN_AWAY_SECONDS) {
        await tx.delete(attemptFocusLeaves).where(eq(attemptFocusLeaves.id, row.id))
      } else {
        await tx.update(attemptFocusLeaves).set({ returnedAt: endedAt, awaySeconds }).where(eq(attemptFocusLeaves.id, row.id))
      }
    }
  }

  private async focusReport(a: AttemptRow): Promise<FocusReportDto | null> {
    if (!isFocusWatched(a)) return null
    const rows = await this.db
      .select()
      .from(attemptFocusLeaves)
      .where(and(eq(attemptFocusLeaves.attemptId, a.id), sql`coalesce(${attemptFocusLeaves.awaySeconds}, 0) >= ${FOCUS_MIN_AWAY_SECONDS}`))
      .orderBy(asc(attemptFocusLeaves.leftAt))
    const awaySeconds = rows.reduce((sum, row) => sum + (row.awaySeconds ?? 0), 0)
    const longestAwaySeconds = rows.reduce((max, row) => Math.max(max, row.awaySeconds ?? 0), 0)
    return {
      leaveCount: rows.length,
      awaySeconds,
      longestAwaySeconds,
      leaves: rows.slice(0, 30).map((row) => ({
        leftAt: row.leftAt.toISOString(),
        returnedAt: row.returnedAt?.toISOString() ?? null,
        awaySeconds: row.awaySeconds ?? 0,
      })),
    }
  }

  // ---------------------------------------------------------------- queries / mapping
  private async requireOwn(actor: Actor, id: string): Promise<AttemptRow> {
    const [row] = await this.db.select().from(attempts).where(and(eq(attempts.id, id), eq(attempts.userId, actor.id))).limit(1)
    // Same 404 for "missing" and "someone else's" — no probing for other students' attempts.
    if (!row) throw AppException.notFound('Không tìm thấy bài làm')
    return row
  }

  /** Owner, or staff viewing a student's sitting (results / review / audio only). */
  private async requireReadable(actor: Actor, id: string): Promise<AttemptRow> {
    if (actor.role !== 'TEACHER' && actor.role !== 'ADMIN') return this.requireOwn(actor, id)
    const [row] = await this.db
      .select({ attempt: attempts })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .where(and(eq(attempts.id, id), eq(users.role, 'STUDENT')))
      .limit(1)
    if (!row) throw AppException.notFound('Không tìm thấy bài làm')
    return row.attempt
  }

  private async requireExam(id: string): Promise<ExamRow> {
    const [row] = await this.db.select().from(exams).where(eq(exams.id, id)).limit(1)
    if (!row) throw AppException.notFound('Không tìm thấy đề thi')
    return row
  }

  private closed() {
    return new AppException(ERROR_CODES.ATTEMPT_CLOSED, 'Bài làm đã kết thúc, không thể thay đổi câu trả lời', HttpStatus.CONFLICT)
  }

  private async scopeQuestions(db: Reader, examId: string, partCodes: string[]): Promise<ScopeQuestion[]> {
    if (partCodes.length === 0) return []
    const rows = await db
      .select({ q: questions, partCode: parts.code, skill: skills.code })
      .from(questions)
      .innerJoin(examParts, eq(examParts.id, questions.examPartId))
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .innerJoin(skills, eq(skills.id, parts.skillId))
      .where(and(eq(examParts.examId, examId), inArray(parts.code, partCodes)))
      .orderBy(asc(examParts.displayOrder), asc(questions.questionNumber))
    return rows.map((r) => ({
      id: r.q.id,
      number: r.q.questionNumber,
      partCode: r.partCode,
      skill: r.skill as Skill,
      groupId: r.q.groupId,
      type: r.q.type,
      prompt: r.q.prompt,
      imageAssetId: r.q.imageAssetId,
    }))
  }

  /** Question count per skill over the WHOLE exam (not just the attempt scope). */
  private async examSkillTotals(db: Reader, examId: string): Promise<Map<Skill, number>> {
    const rows = await db
      .select({ skill: skills.code, n: sql<number>`count(*)::int` })
      .from(questions)
      .innerJoin(examParts, eq(examParts.id, questions.examPartId))
      .innerJoin(parts, eq(parts.id, examParts.partId))
      .innerJoin(skills, eq(skills.id, parts.skillId))
      .where(eq(examParts.examId, examId))
      .groupBy(skills.code)
    return new Map(rows.map((r) => [r.skill as Skill, r.n]))
  }

  private async loadPlayerContent(a: AttemptRow): Promise<{ questions: PlayerQuestionDto[]; groups: GroupDto[] }> {
    const scope = await this.scopeQuestions(this.db, a.examId, a.partCodes)
    const qIds = scope.map((q) => q.id)
    // NOTE: is_correct is deliberately not selected here.
    const opts = qIds.length
      ? await this.db
          .select({ id: questionOptions.id, questionId: questionOptions.questionId, key: questionOptions.optionKey, text: questionOptions.optionText })
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, qIds))
          .orderBy(asc(questionOptions.optionKey))
      : []
    const answers = await this.db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, a.id))
    const keyByOptionId = new Map(opts.map((o) => [o.id, o.key]))
    const selectedByQ = new Map(answers.map((x) => [x.questionId, x.selectedOptionId ? (keyByOptionId.get(x.selectedOptionId) ?? null) : null]))
    const textByQ = new Map(answers.map((x) => [x.questionId, x.answerText]))
    const blankAt = new Map<string, number>()
    const seenInGroup = new Map<string, number>()
    for (const q of scope) {
      if (q.type !== FILL_QUESTION_TYPE || !q.groupId) continue
      const index = seenInGroup.get(q.groupId) ?? 0
      blankAt.set(q.id, index)
      seenInGroup.set(q.groupId, index + 1)
    }

    const groupIds = [...new Set(scope.map((q) => q.groupId).filter((g): g is string => !!g))]
    const groupRows = groupIds.length
      ? await this.db
          .select({ g: questionGroups, partCode: parts.code })
          .from(questionGroups)
          .innerJoin(examParts, eq(examParts.id, questionGroups.examPartId))
          .innerJoin(parts, eq(parts.id, examParts.partId))
          .where(inArray(questionGroups.id, groupIds))
          .orderBy(asc(questionGroups.displayOrder))
      : []
    const passageRows = groupIds.length ? await this.db.select().from(passages).where(inArray(passages.groupId, groupIds)).orderBy(asc(passages.displayOrder)) : []
    const imageUrls = await this.examAudio.signedImageUrls([
      ...scope.map((q) => q.imageAssetId).filter((x): x is string => !!x),
      ...groupRows.map(({ g }) => g.imageAssetId).filter((x): x is string => !!x),
    ])

    return {
      questions: scope.map((q) => ({
        id: q.id,
        number: q.number,
        partCode: q.partCode,
        groupId: q.groupId,
        type: q.type,
        prompt: q.prompt,
        imageUrl: q.imageAssetId ? (imageUrls.get(q.imageAssetId) ?? null) : null,
        options: q.type === FILL_QUESTION_TYPE ? [] : opts.filter((o) => o.questionId === q.id).map((o) => ({ key: o.key, text: o.text })),
        selectedKey: q.type === FILL_QUESTION_TYPE ? null : (selectedByQ.get(q.id) ?? null),
        answerText: q.type === FILL_QUESTION_TYPE ? (textByQ.get(q.id) ?? null) : null,
        blankIndex: blankAt.get(q.id) ?? null,
      })),
      groups: groupRows.map(({ g, partCode }) => ({
        id: g.id,
        partCode,
        instructions: g.instructions,
        passages: passageRows.filter((p) => p.groupId === g.id).map((p) => ({ label: p.label, title: p.title, content: p.content })),
        imageUrl: g.imageAssetId ? (imageUrls.get(g.imageAssetId) ?? null) : null,
      })),
    }
  }

  private async withAnswered(a: AttemptRow, exam: ExamRow): Promise<AttemptDto> {
    const [{ n }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(attemptAnswers).where(eq(attemptAnswers.attemptId, a.id))
    return this.toDto(a, exam.title, n)
  }

  private toDto(a: AttemptRow, examTitle: string, answeredCount = 0): AttemptDto {
    return {
      id: a.id,
      examId: a.examId,
      examTitle,
      mode: a.mode,
      status: a.status,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
      deadlineAt: a.deadlineAt?.toISOString() ?? null,
      assignmentId: a.assignmentId ?? null,
      remainingSeconds: a.status === 'IN_PROGRESS' && a.deadlineAt ? Math.max(0, Math.floor((a.deadlineAt.getTime() - Date.now()) / 1000)) : null,
      partCodes: a.partCodes,
      totalQuestions: a.totalQuestions,
      answeredCount,
      focusWatch: isFocusWatched(a),
    }
  }
}
