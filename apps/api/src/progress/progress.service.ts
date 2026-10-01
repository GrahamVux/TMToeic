import { Inject, Injectable } from '@nestjs/common'
import {
  ENABLED_SKILLS,
  INACTIVE_AFTER_DAYS,
  MIN_ANSWERS_FOR_INSIGHT,
  PART_SEED,
  type AttemptSummaryDto,
  type ClassReportDto,
  type LeaderboardEntryDto,
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
import { attempts, assignments, exams, users } from '../db/schema'
import { toUserDto } from '../users/user.mapper'

/** Class is in Vietnam: "today" and "this week" follow local time, not the server's. */
const TZ = 'Asia/Ho_Chi_Minh'
const TZ_SQL = sql.raw(`'${TZ}'`)
const LEADERBOARD_SIZE = 5
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
  }
}

@Injectable()
export class ProgressService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async studentDashboard(userId: string, now = new Date()): Promise<StudentDashboardDto> {
    const [me] = await this.db
      .select({ targetScore: users.targetScore, goalTrack: users.goalTrack, targetScoreMin: users.targetScoreMin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!me) throw AppException.notFound('Không tìm thấy tài khoản')

    const [scored, finishedRows, dayRows, skillRows, weekRows, weekStartRows] = await Promise.all([
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
      this.db.execute(sql`
        select u.id as id, u.full_name as name,
               count(*)::int as answered,
               count(*) filter (where aa.is_correct is true)::int as correct,
               count(*) filter (where aa.is_correct is not null)::int as graded
        from attempt_answers aa
        join attempts a on a.id = aa.attempt_id
        join users u on u.id = a.user_id
        where u.role = 'STUDENT' and u.status = 'ACTIVE'
          and aa.answered_at >= (date_trunc('week', ${now.toISOString()}::timestamptz at time zone ${TZ_SQL}) at time zone ${TZ_SQL})
          and aa.answered_at <= ${now.toISOString()}::timestamptz
        group by u.id, u.full_name
        order by answered desc, correct desc, u.full_name asc`) as unknown as Promise<Rows<{ id: string; name: string; answered: number; correct: number; graded: number }>>,
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

    const ranked: LeaderboardEntryDto[] = weekRows.rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      answered: r.answered,
      accuracy: pct(r.correct, r.graded),
      you: r.id === userId,
    }))

    const goal = goalFromStored(me.goalTrack, me.targetScore)
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
      weekStart: weekStartRows.rows[0]?.day ?? localDay(now),
      leaderboard: {
        entries: ranked.slice(0, LEADERBOARD_SIZE),
        you: ranked.find((e) => e.you) ?? null,
        participants: ranked.length,
      },
      skills,
    }
  }

  // ---------------------------------------------------------------- progress analytics
  /** Only students have progress; anything else is a 404 so ids of staff accounts are not probeable. */
  async assertStudent(userId: string) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.role, 'STUDENT'))).limit(1)
    if (!u) throw AppException.notFound('Không tìm thấy học viên')
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
      })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .leftJoin(assignments, eq(assignments.id, attempts.assignmentId))
      .where(and(eq(attempts.userId, userId), inArray(attempts.status, ['SUBMITTED', 'EXPIRED'])))
      .orderBy(desc(attempts.submittedAt))
      .limit(100)
    return rows.filter((r) => r.at !== null).map(toAttemptSummary)
  }

  async classReport(now = new Date()): Promise<ClassReportDto> {
    const nowIso = now.toISOString()
    const weekStartSql = sql`(date_trunc('week', ${nowIso}::timestamptz at time zone ${TZ_SQL}) at time zone ${TZ_SQL})`
    const [counts, week, acc, inactiveRows, weekLabel] = await Promise.all([
      this.db.execute(sql`
        select count(*)::int as total,
               count(*) filter (where status = 'ACTIVE')::int as active,
               count(*) filter (where status = 'ACTIVE' and must_change_password)::int as pending
        from users where role = 'STUDENT'`) as unknown as Promise<Rows<{ total: number; active: number; pending: number }>>,
      this.db.execute(sql`
        select count(distinct a.user_id)::int as students, count(*)::int as answered, count(distinct a.id)::int as attempts
        from attempt_answers aa join attempts a on a.id = aa.attempt_id join users u on u.id = a.user_id
        where u.role = 'STUDENT' and u.status = 'ACTIVE' and aa.answered_at >= ${weekStartSql} and aa.answered_at <= ${nowIso}::timestamptz`) as unknown as Promise<Rows<{ students: number; answered: number; attempts: number }>>,
      this.db.execute(sql`
        select count(*) filter (where aa.is_correct is true)::int as correct, count(*) filter (where aa.is_correct is not null)::int as graded
        from attempt_answers aa join attempts a on a.id = aa.attempt_id join users u on u.id = a.user_id
        where u.role = 'STUDENT' and u.status = 'ACTIVE' and aa.answered_at >= ${nowIso}::timestamptz - interval '30 days'`) as unknown as Promise<Rows<{ correct: number; graded: number }>>,
      this.db.execute(sql`
        select u.id as id, u.full_name as full_name, u.student_code as student_code, max(aa.answered_at) as last_at
        from users u
        left join attempts a on a.user_id = u.id
        left join attempt_answers aa on aa.attempt_id = a.id
        where u.role = 'STUDENT' and u.status = 'ACTIVE' and u.must_change_password = false
        group by u.id, u.full_name, u.student_code
        having max(aa.answered_at) is null or max(aa.answered_at) < ${nowIso}::timestamptz - make_interval(days => ${INACTIVE_AFTER_DAYS})
        order by max(aa.answered_at) asc nulls first, u.full_name asc`) as unknown as Promise<Rows<{ id: string; full_name: string; student_code: string | null; last_at: Date | string | null }>>,
      this.db.execute(sql`select to_char(date_trunc('week', ${nowIso}::timestamptz at time zone ${TZ_SQL}), 'YYYY-MM-DD') as day`) as unknown as Promise<Rows<{ day: string }>>,
    ])

    const c = counts.rows[0]
    return {
      students: { total: c?.total ?? 0, active: c?.active ?? 0, pendingFirstLogin: c?.pending ?? 0 },
      week: { start: weekLabel.rows[0]?.day ?? localDay(now), activeStudents: week.rows[0]?.students ?? 0, attempts: week.rows[0]?.attempts ?? 0, answered: week.rows[0]?.answered ?? 0 },
      accuracy30d: pct(acc.rows[0]?.correct ?? 0, acc.rows[0]?.graded ?? 0),
      inactiveCount: inactiveRows.rows.length,
      inactive: inactiveRows.rows.slice(0, 20).map((r) => {
        const last = r.last_at ? new Date(r.last_at) : null
        return {
          id: r.id,
          fullName: r.full_name,
          studentCode: r.student_code,
          lastActivityAt: last ? last.toISOString() : null,
          daysInactive: last ? Math.floor((now.getTime() - last.getTime()) / 86_400_000) : null,
        }
      }),
    }
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
