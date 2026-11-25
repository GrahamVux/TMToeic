import { Inject, Injectable } from '@nestjs/common'
import {
  ENABLED_SKILLS,
  INACTIVE_AFTER_DAYS,
  SUPPORT_ACCURACY_BELOW,
  type SupportReason,
  MIN_ANSWERS_FOR_INSIGHT,
  PART_SEED,
  type AttemptSummaryDto,
  type ClassReportDto,
  type ExamReportDto,
  type ExamReportItemDto,
  type ExamReportPartDto,
  type ExamStatus,
  type PartStatDto,
  type ScorePointDto,
  type SetGoalInput,
  type SkillStatDto,
  type StudentDashboardDto,
  type StudentProgressDto,
  type UpdateProfileInput,
  type UserDto,
  remainingToGoal,
  goalFromStored,
} from '@toeic/shared'
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import { DB, type Db } from '../db/database.module'
import { attempts, assignments, classMembers, classTeachers, exams, users } from '../db/schema'
import { toUserDto } from '../users/user.mapper'
import { HonorRewardsService } from './honor-rewards.service'

/** Class is in Vietnam: "today" and "this week" follow local time, not the server's. */
export const TZ = 'Asia/Ho_Chi_Minh'
const TZ_SQL = sql.raw(`'${TZ}'`)
const HISTORY_SIZE = 12

type Rows<T> = { rows: T[] }

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
export const localDay = (d: Date) => dayFormat.format(d) // YYYY-MM-DD in TZ

function previousDay(day: string): string {
  const t = new Date(`${day}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}

/**
 * Consecutive days with activity. The streak stays alive through today until the day ends,
 * so a student who has not practised *yet today* still sees yesterday's streak.
 */
export function computeStreak(activeDays: string[], today: string): { days: number; activeToday: boolean } {
  const set = new Set(activeDays)
  const activeToday = set.has(today)
  let cursor = activeToday ? today : previousDay(today)
  let days = 0
  while (set.has(cursor)) {
    days++
    cursor = previousDay(cursor)
  }
  return { days, activeToday }
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null)

function toSupportStudent(
  r: {
    id: string
    full_name: string
    student_code: string | null
    must_change: boolean
    last_at: Date | string | null
    correct: number
    graded: number
    overdue: number
  },
  now: Date,
) {
  const last = r.last_at ? new Date(r.last_at) : null
  const daysInactive = last ? Math.floor((now.getTime() - last.getTime()) / 86_400_000) : null
  const accuracy = pct(Number(r.correct), Number(r.graded))
  const idleCutoff = now.getTime() - INACTIVE_AFTER_DAYS * 86_400_000
  const reasons: SupportReason[] = []
  const loggedIn = r.must_change === false || r.must_change === ('f' as unknown) || String(r.must_change) === 'false'
  if (accuracy !== null && accuracy < SUPPORT_ACCURACY_BELOW) reasons.push('LOW_ACCURACY')
  if (loggedIn && (last === null || last.getTime() < idleCutoff)) reasons.push('INACTIVE')
  const overdueCount = Number(r.overdue) || 0
  if (overdueCount > 0) reasons.push('OVERDUE')
  return {
    id: r.id,
    fullName: r.full_name,
    studentCode: r.student_code,
    lastActivityAt: last ? last.toISOString() : null,
    daysInactive,
    accuracy,
    overdueCount,
    reasons,
  }
}

const focusLeaveCountSql = sql<number>`(select count(*)::int from attempt_focus_leaves where attempt_id = ${attempts.id} and coalesce(away_seconds, 0) >= 1)`

function toAttemptSummary(r: {
  attemptId: string
  examTitle: string
  mode: string
  status: string
  at: Date | null
  correct: number | null
  total: number
  totalScore: number | null
  partCodes: string[]
  assignmentTitle: string | null
  focusLeaveCount: number
}): AttemptSummaryDto {
  return {
    attemptId: r.attemptId,
    examTitle: r.examTitle,
    mode: r.mode,
    status: r.status,
    at: r.at!.toISOString(),
    correct: r.correct ?? 0,
    total: r.total,
    accuracy: pct(r.correct ?? 0, r.total) ?? 0,
    totalScore: r.totalScore,
    partCodes: r.partCodes,
    assignmentTitle: r.assignmentTitle,
    focusLeaveCount: Number(r.focusLeaveCount ?? 0),
  }
}

@Injectable()
export class ProgressService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly honorRewards: HonorRewardsService,
  ) {}

  async studentDashboard(userId: string, now = new Date()): Promise<StudentDashboardDto> {
    const [me] = await this.db
      .select({ targetScore: users.targetScore, goalTrack: users.goalTrack, targetScoreMin: users.targetScoreMin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!me) throw AppException.notFound('Không tìm thấy tài khoản')

    const [scored, finishedRows, dayRows, skillRows, weekStartRows] = await Promise.all([
      this.db
        .select({
          attemptId: attempts.id,
          at: attempts.submittedAt,
          totalScore: attempts.totalScore,
          listeningScore: attempts.listeningScore,
          readingScore: attempts.readingScore,
        })
        .from(attempts)
        .where(and(eq(attempts.userId, userId), inArray(attempts.status, ['SUBMITTED', 'EXPIRED']), isNotNull(attempts.totalScore)))
        .orderBy(desc(attempts.submittedAt))
        .limit(HISTORY_SIZE),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(attempts)
        .where(and(eq(attempts.userId, userId), inArray(attempts.status, ['SUBMITTED', 'EXPIRED']))),
      this.db.execute(sql`
        select distinct to_char(aa.answered_at at time zone ${TZ_SQL}, 'YYYY-MM-DD') as day
        from attempt_answers aa join attempts a on a.id = aa.attempt_id
        where a.user_id = ${userId} and aa.answered_at > now() - interval '400 days'
        order by day desc`) as unknown as Promise<Rows<{ day: string }>>,
      this.db.execute(sql`
        select s.code as skill,
               count(distinct a.id)::int as attempts,
               count(*) filter (where aa.selected_option_id is not null)::int as answered,
               count(*) filter (where aa.is_correct is true)::int as correct
        from attempt_answers aa
        join attempts a on a.id = aa.attempt_id
        join questions q on q.id = aa.question_id
        join exam_parts ep on ep.id = q.exam_part_id
        join parts p on p.id = ep.part_id
        join skills s on s.id = p.skill_id
        where a.user_id = ${userId} and a.status <> 'IN_PROGRESS'
        group by s.code`) as unknown as Promise<Rows<{ skill: SkillStatDto['skill']; attempts: number; answered: number; correct: number }>>,
      this.db.execute(sql`select to_char(date_trunc('week', ${now.toISOString()}::timestamptz at time zone ${TZ_SQL}), 'YYYY-MM-DD') as day`) as unknown as Promise<Rows<{ day: string }>>,
    ])

    const history: ScorePointDto[] = scored
      .filter((r) => r.totalScore !== null && r.at !== null)
      .map((r) => ({
        attemptId: r.attemptId,
        at: r.at!.toISOString(),
        totalScore: r.totalScore!,
        listeningScore: r.listeningScore,
        readingScore: r.readingScore,
      }))
      .reverse() // oldest → newest for the chart
    const latest = history.at(-1) ?? null

    const skillByCode = new Map(skillRows.rows.map((r) => [r.skill, r]))
    const skills: SkillStatDto[] = ENABLED_SKILLS.map((skill) => {
      const r = skillByCode.get(skill)
      return { skill, attempts: r?.attempts ?? 0, answered: r?.answered ?? 0, correct: r?.correct ?? 0, accuracy: r ? pct(r.correct, r.answered) : null }
    })

    const goal = goalFromStored(me.goalTrack, me.targetScore)
    const weekStart = weekStartRows.rows[0]?.day ?? localDay(now)
    return {
      targetScore: me.targetScore,
      goal,
      attemptsFinished: finishedRows[0]?.n ?? 0,
      latestScore: latest,
      remainingToTarget: remainingToGoal(goal, latest?.totalScore ?? null),
      improvement: history.length >= 2 ? history[history.length - 1].totalScore - history[0].totalScore : null,
      scoreHistory: history,
      streak: computeStreak(
        dayRows.rows.map((r) => r.day),
        localDay(now),
      ),
      weekStart,
      honor: await this.honorRewards.honorBoard(userId, now),
      skills,
    }
  }

  // ---------------------------------------------------------------- progress analytics
  /** Only students have progress; anything else is a 404 so ids of staff accounts are not probeable. */
  async assertStudent(userId: string, teacherId?: string) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.role, 'STUDENT'))).limit(1)
    if (!u) throw AppException.notFound('Không tìm thấy học viên')
    if (!teacherId) return
    const [link] = await this.db
      .select({ userId: classMembers.userId })
      .from(classMembers)
      .innerJoin(classTeachers, eq(classTeachers.classId, classMembers.classId))
      .where(and(eq(classMembers.userId, userId), eq(classTeachers.userId, teacherId)))
      .limit(1)
    if (!link) throw AppException.notFound('Không tìm thấy học viên')
  }

  async studentProgress(userId: string, now = new Date()): Promise<StudentProgressDto> {
    const [me] = await this.db
      .select({ targetScore: users.targetScore, goalTrack: users.goalTrack, targetScoreMin: users.targetScoreMin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!me) throw AppException.notFound('Không tìm thấy học viên')

    const [scored, partRows, recent, dayRows, lastRows] = await Promise.all([
      this.db
        .select({ attemptId: attempts.id, at: attempts.submittedAt, totalScore: attempts.totalScore, listeningScore: attempts.listeningScore, readingScore: attempts.readingScore })
        .from(attempts)
        .where(and(eq(attempts.userId, userId), inArray(attempts.status, ['SUBMITTED', 'EXPIRED']), isNotNull(attempts.totalScore)))
        .orderBy(desc(attempts.submittedAt))
        .limit(20),
      this.db.execute(sql`
        select p.code as part_code, s.code as skill,
               count(distinct a.id)::int as attempts,
               count(*) filter (where aa.selected_option_id is not null)::int as answered,
               count(*) filter (where aa.is_correct is true)::int as correct,
               round(avg(aa.time_spent_seconds) filter (where aa.time_spent_seconds is not null))::int as avg_seconds
        from attempt_answers aa
        join attempts a on a.id = aa.attempt_id
        join questions q on q.id = aa.question_id
        join exam_parts ep on ep.id = q.exam_part_id
        join parts p on p.id = ep.part_id
        join skills s on s.id = p.skill_id
        where a.user_id = ${userId} and a.status <> 'IN_PROGRESS'
        group by p.code, s.code`) as unknown as Promise<Rows<{ part_code: string; skill: SkillStatDto['skill']; attempts: number; answered: number; correct: number; avg_seconds: number | null }>>,
      this.db
        .select({
          attemptId: attempts.id,
          examTitle: exams.title,
          mode: attempts.mode,
          status: attempts.status,
          at: attempts.submittedAt,
          correct: attempts.correctCount,
          total: attempts.totalQuestions,
          totalScore: attempts.totalScore,
          partCodes: attempts.partCodes,
          assignmentTitle: assignments.title,
          focusLeaveCount: focusLeaveCountSql,
        })
        .from(attempts)
        .innerJoin(exams, eq(exams.id, attempts.examId))
        .leftJoin(assignments, eq(assignments.id, attempts.assignmentId))
        .where(and(eq(attempts.userId, userId), inArray(attempts.status, ['SUBMITTED', 'EXPIRED'])))
        .orderBy(desc(attempts.submittedAt))
        .limit(10),
      this.activeDays(userId),
      this.db.execute(sql`
        select max(aa.answered_at) as last_at
        from attempt_answers aa join attempts a on a.id = aa.attempt_id
        where a.user_id = ${userId}`) as unknown as Promise<Rows<{ last_at: Date | string | null }>>,
    ])

    const history: ScorePointDto[] = scored
      .filter((r) => r.totalScore !== null && r.at !== null)
      .map((r) => ({ attemptId: r.attemptId, at: r.at!.toISOString(), totalScore: r.totalScore!, listeningScore: r.listeningScore, readingScore: r.readingScore }))
      .reverse()
    const latest = history.at(-1) ?? null

    const byPart = new Map(partRows.rows.map((r) => [r.part_code, r]))
    const parts: PartStatDto[] = PART_SEED.filter((p) => ENABLED_SKILLS.includes(p.skill)).map((p) => {
      const r = byPart.get(p.code)
      return {
        partCode: p.code,
        skill: p.skill,
        attempts: r?.attempts ?? 0,
        answered: r?.answered ?? 0,
        correct: r?.correct ?? 0,
        accuracy: r ? pct(r.correct, r.answered) : null,
        avgSeconds: r?.avg_seconds ?? null,
      }
    })

    const answered = parts.reduce((s, p) => s + p.answered, 0)
    const correct = parts.reduce((s, p) => s + p.correct, 0)
    const timed = parts.filter((p) => p.avgSeconds !== null && p.answered > 0)
    const timedAnswers = timed.reduce((s, p) => s + p.answered, 0)
    const candidates = parts.filter((p) => p.answered >= MIN_ANSWERS_FOR_INSIGHT && p.accuracy !== null)
    const weakest = candidates.length ? candidates.reduce((w, p) => (p.accuracy! < w.accuracy! ? p : w)) : null

    const lastAt = lastRows.rows[0]?.last_at
    const goal = goalFromStored(me.goalTrack, me.targetScore)
    return {
      targetScore: me.targetScore,
      goal,
      latestScore: latest,
      remainingToTarget: remainingToGoal(goal, latest?.totalScore ?? null),
      improvement: history.length >= 2 ? history[history.length - 1].totalScore - history[0].totalScore : null,
      scoreHistory: history,
      parts,
      weakestPart: weakest,
      totals: {
        attemptsFinished: recent.length === 10 ? (await this.countFinished(userId)) : recent.length,
        answered,
        correct,
        accuracy: pct(correct, answered),
        avgSeconds: timedAnswers ? Math.round(timed.reduce((s, p) => s + p.avgSeconds! * p.answered, 0) / timedAnswers) : null,
      },
      streak: computeStreak(dayRows, localDay(now)),
      lastActivityAt: lastAt ? new Date(lastAt).toISOString() : null,
      recentAttempts: recent.filter((r) => r.at !== null).map(toAttemptSummary),
    }
  }

  /** Full finished-attempt history for the teacher’s student profile. */
  async listStudentAttempts(userId: string): Promise<AttemptSummaryDto[]> {
    const rows = await this.db
      .select({
        attemptId: attempts.id,
        examTitle: exams.title,
        mode: attempts.mode,
        status: attempts.status,
        at: attempts.submittedAt,
        correct: attempts.correctCount,
        total: attempts.totalQuestions,
        totalScore: attempts.totalScore,
        partCodes: attempts.partCodes,
        assignmentTitle: assignments.title,
        focusLeaveCount: focusLeaveCountSql,
      })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .leftJoin(assignments, eq(assignments.id, attempts.assignmentId))
      .where(and(eq(attempts.userId, userId), inArray(attempts.status, ['SUBMITTED', 'EXPIRED'])))
      .orderBy(desc(attempts.submittedAt))
      .limit(100)
    return rows.filter((r) => r.at !== null).map(toAttemptSummary)
  }

  async classReport(now = new Date(), teacherId?: string): Promise<ClassReportDto> {
    const nowIso = now.toISOString()
    const scope = teacherId
      ? sql`and u.id in (select cm.user_id from class_members cm join class_teachers ct on ct.class_id = cm.class_id where ct.user_id = ${teacherId}::uuid)`
      : sql``
    const weekStartSql = sql`(date_trunc('week', ${nowIso}::timestamptz at time zone ${TZ_SQL}) at time zone ${TZ_SQL})`
    const [counts, week, acc, supportRows, weekLabel] = await Promise.all([
      this.db.execute(sql`
        select count(*)::int as total,
               count(*) filter (where u.status = 'ACTIVE')::int as active,
               count(*) filter (where u.status = 'ACTIVE' and u.must_change_password)::int as pending
        from users u where u.role = 'STUDENT' ${scope}`) as unknown as Promise<Rows<{ total: number; active: number; pending: number }>>,
      this.db.execute(sql`
        select count(distinct a.user_id)::int as students, count(*)::int as answered, count(distinct a.id)::int as attempts
        from attempt_answers aa join attempts a on a.id = aa.attempt_id join users u on u.id = a.user_id
        where u.role = 'STUDENT' and u.status = 'ACTIVE' and aa.answered_at >= ${weekStartSql} and aa.answered_at <= ${nowIso}::timestamptz ${scope}`) as unknown as Promise<Rows<{ students: number; answered: number; attempts: number }>>,
      this.db.execute(sql`
        select count(*) filter (where aa.is_correct is true)::int as correct, count(*) filter (where aa.is_correct is not null)::int as graded
        from attempt_answers aa join attempts a on a.id = aa.attempt_id join users u on u.id = a.user_id
        where u.role = 'STUDENT' and u.status = 'ACTIVE' and aa.answered_at >= ${nowIso}::timestamptz - interval '30 days' ${scope}`) as unknown as Promise<Rows<{ correct: number; graded: number }>>,
      this.db.execute(sql`
        with activity as (
          select u.id as id, u.full_name as full_name, u.student_code as student_code, u.must_change_password as must_change,
                 max(aa.answered_at) as last_at,
                 count(*) filter (where aa.is_correct is true)::int as correct,
                 count(*) filter (where aa.is_correct is not null)::int as graded
          from users u
          left join attempts a on a.user_id = u.id and a.status in ('SUBMITTED', 'EXPIRED')
          left join attempt_answers aa on aa.attempt_id = a.id
          where u.role = 'STUDENT' and u.status = 'ACTIVE' ${scope}
          group by u.id, u.full_name, u.student_code, u.must_change_password
        ),
        overdue as (
          select s.user_id as user_id, count(*)::int as n
          from assignment_students s
          join assignments g on g.id = s.assignment_id
          where g.due_at is not null
            and g.due_at < ${nowIso}::timestamptz
            and g.status in ('PUBLISHED', 'CLOSED')
            and not exists (
              select 1 from attempts t
              where t.assignment_id = g.id and t.user_id = s.user_id and t.status in ('SUBMITTED', 'EXPIRED')
            )
          group by s.user_id
        )
        select act.id, act.full_name, act.student_code, act.must_change, act.last_at, act.correct, act.graded,
               coalesce(o.n, 0)::int as overdue
        from activity act
        left join overdue o on o.user_id = act.id
        where (act.graded > 0 and act.correct * 2 < act.graded)
           or (act.must_change = false and (act.last_at is null or act.last_at < ${nowIso}::timestamptz - make_interval(days => ${INACTIVE_AFTER_DAYS})))
           or coalesce(o.n, 0) > 0
        order by act.full_name asc`) as unknown as Promise<
        Rows<{
          id: string
          full_name: string
          student_code: string | null
          must_change: boolean
          last_at: Date | string | null
          correct: number
          graded: number
          overdue: number
        }>
      >,
      this.db.execute(sql`select to_char(date_trunc('week', ${nowIso}::timestamptz at time zone ${TZ_SQL}), 'YYYY-MM-DD') as day`) as unknown as Promise<Rows<{ day: string }>>,
    ])

    const c = counts.rows[0]
    return {
      students: { total: c?.total ?? 0, active: c?.active ?? 0, pendingFirstLogin: c?.pending ?? 0 },
      week: { start: weekLabel.rows[0]?.day ?? localDay(now), activeStudents: week.rows[0]?.students ?? 0, attempts: week.rows[0]?.attempts ?? 0, answered: week.rows[0]?.answered ?? 0 },
      accuracy30d: pct(acc.rows[0]?.correct ?? 0, acc.rows[0]?.graded ?? 0),
      ...(() => {
        const support = supportRows.rows
          .map((r) => toSupportStudent(r, now))
          .filter((student) => student.reasons.length > 0)
          .sort((a, b) => b.reasons.length - a.reasons.length || b.overdueCount - a.overdueCount || (a.accuracy ?? 101) - (b.accuracy ?? 101) || a.fullName.localeCompare(b.fullName, 'vi'))
        return { inactiveCount: support.length, inactive: support.slice(0, 50) }
      })(),
    }
  }

  /** Finished sittings rolled up per exam. Teachers only count students in the classes they manage. */
  async examReport(teacherId?: string): Promise<ExamReportDto> {
    const scope = teacherId
      ? sql`and a.user_id in (select cm.user_id from class_members cm join class_teachers ct on ct.class_id = cm.class_id where ct.user_id = ${teacherId}::uuid)`
      : sql``
    const [examRows, partRows] = await Promise.all([
      this.db.execute(sql`
        select e.id, e.code, e.title, e.status, e.total_questions,
               count(distinct a.user_id)::int as students,
               count(a.id)::int as attempts,
               coalesce(sum(a.correct_count), 0)::int as correct,
               coalesce(sum(a.total_questions), 0)::int as answered,
               round(avg(a.total_score) filter (where a.total_score is not null))::int as average_score,
               max(a.submitted_at) as last_submitted_at
        from exams e
        left join attempts a on a.exam_id = e.id and a.status in ('SUBMITTED', 'EXPIRED') ${scope}
        where e.status = 'PUBLISHED'
           or e.id in (
             select a.exam_id from attempts a
             where a.status in ('SUBMITTED', 'EXPIRED') ${scope}
           )
        group by e.id
        order by count(a.id) desc, e.title asc`) as unknown as Promise<
        Rows<{
          id: string
          code: string
          title: string
          status: ExamStatus
          total_questions: number
          students: number
          attempts: number
          correct: number
          answered: number
          average_score: number | null
          last_submitted_at: Date | string | null
        }>
      >,
      this.db.execute(sql`
        select a.exam_id, p.code as part_code,
               count(*) filter (where aa.is_correct is not null)::int as graded,
               count(*) filter (where aa.is_correct is true)::int as correct
        from attempt_answers aa
        join attempts a on a.id = aa.attempt_id
        join questions q on q.id = aa.question_id
        join exam_parts ep on ep.id = q.exam_part_id
        join parts p on p.id = ep.part_id
        where a.status in ('SUBMITTED', 'EXPIRED') ${scope}
        group by a.exam_id, p.code`) as unknown as Promise<Rows<{ exam_id: string; part_code: string; graded: number; correct: number }>>,
    ])

    const partsByExam = new Map<string, ExamReportPartDto[]>()
    for (const row of partRows.rows) {
      const graded = Number(row.graded)
      if (graded <= 0) continue
      const part: ExamReportPartDto = {
        partCode: row.part_code,
        answered: graded,
        correct: Number(row.correct),
        accuracy: pct(Number(row.correct), graded),
      }
      const list = partsByExam.get(row.exam_id) ?? []
      list.push(part)
      partsByExam.set(row.exam_id, list)
    }

    const exams: ExamReportItemDto[] = examRows.rows.map((row) => {
      const parts = (partsByExam.get(row.id) ?? []).sort(
        (a, b) => PART_SEED.findIndex((p) => p.code === a.partCode) - PART_SEED.findIndex((p) => p.code === b.partCode),
      )
      const weakestPart = parts.reduce<ExamReportPartDto | null>((weak, part) => {
        if (part.accuracy === null) return weak
        if (!weak || weak.accuracy === null || part.accuracy < weak.accuracy) return part
        return weak
      }, null)
      const at = row.last_submitted_at
      const last = at instanceof Date ? at : at ? new Date(at) : null
      return {
        id: row.id,
        code: row.code,
        title: row.title,
        status: row.status,
        totalQuestions: Number(row.total_questions),
        students: Number(row.students),
        attempts: Number(row.attempts),
        answered: Number(row.answered),
        correct: Number(row.correct),
        accuracy: pct(Number(row.correct), Number(row.answered)),
        averageScore: row.average_score === null || row.average_score === undefined ? null : Number(row.average_score),
        lastSubmittedAt: last && !Number.isNaN(last.getTime()) ? last.toISOString() : null,
        weakestPart,
        parts,
      }
    })
    return { exams }
  }

  private async activeDays(userId: string): Promise<string[]> {
    const res = (await this.db.execute(sql`
      select distinct to_char(aa.answered_at at time zone ${TZ_SQL}, 'YYYY-MM-DD') as day
      from attempt_answers aa join attempts a on a.id = aa.attempt_id
      where a.user_id = ${userId} and aa.answered_at > now() - interval '400 days'
      order by day desc`)) as unknown as Rows<{ day: string }>
    return res.rows.map((r) => r.day)
  }

  private async countFinished(userId: string): Promise<number> {
    const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(attempts).where(and(eq(attempts.userId, userId), inArray(attempts.status, ['SUBMITTED', 'EXPIRED'])))
    return r?.n ?? 0
  }

  async setGoal(userId: string, input: SetGoalInput, ip?: string): Promise<UserDto> {
    const goal = input.goal
    const [row] = await this.db
      .update(users)
      .set({
        goalTrack: goal?.track ?? null,
        targetScoreMin: goal?.score ?? null,
        targetScore: goal?.score ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning()
    if (!row) throw AppException.notFound('Không tìm thấy tài khoản')
    await this.audit.log({ action: 'GOAL_UPDATED', actorId: userId, entityType: 'user', entityId: userId, metadata: { goal }, ip })
    return toUserDto(row)
  }

  async updateProfile(userId: string, input: UpdateProfileInput, ip?: string): Promise<UserDto> {
    try {
      const [row] = await this.db
        .update(users)
        .set({ fullName: input.fullName, email: input.email, phone: input.phone, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning()
      if (!row) throw AppException.notFound('Không tìm thấy tài khoản')
      await this.audit.log({ action: 'PROFILE_UPDATED', actorId: userId, entityType: 'user', entityId: userId, ip })
      return toUserDto(row)
    } catch (err) {
      const e = err as { code?: string; cause?: { code?: string } }
      if (e?.code === '23505' || e?.cause?.code === '23505') throw AppException.conflict('Email đã được sử dụng bởi tài khoản khác')
      throw err
    }
  }
}
