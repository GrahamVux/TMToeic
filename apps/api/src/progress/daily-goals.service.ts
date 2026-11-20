import { Inject, Injectable } from '@nestjs/common'
import type { DailyGoalCounts, DailyGoalsDto } from '@toeic/shared'
import { eq, sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { DB, type Db } from '../db/database.module'
import { dailyGoals } from '../db/schema'
import { localDay, TZ } from './progress.service'

const TZ_SQL = sql.raw(`'${TZ}'`)

type Rows<T> = { rows: T[] }

/** `day` is YYYY-MM-DD in Asia/Ho_Chi_Minh, which stays UTC+7. */
function startOfLocalDay(day: string): Date {
  return new Date(`${day}T00:00:00+07:00`)
}

function previousLocalDay(day: string): string {
  const t = startOfLocalDay(day)
  t.setUTCDate(t.getUTCDate() - 1)
  return localDay(t)
}

function flagged(value: unknown): boolean {
  return value === true || value === 't' || value === 'true' || value === 1
}

function countsFor(
  sittings: Array<{ earlier: boolean; skill: string; n: number }>,
  cards: Array<{ earlier: boolean; n: number }>,
  earlier: boolean,
) {
  const bySkill = new Map(sittings.filter((row) => flagged(row.earlier) === earlier).map((row) => [row.skill, Number(row.n)]))
  const vocab = cards.find((row) => flagged(row.earlier) === earlier)
  return {
    reading: bySkill.get('READING') ?? 0,
    listening: bySkill.get('LISTENING') ?? 0,
    vocab: Number(vocab?.n ?? 0),
  }
}

@Injectable()
export class DailyGoalsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async get(userId: string, now = new Date()): Promise<DailyGoalsDto> {
    const iso = now.toISOString()
    const dayStart = sql`(date_trunc('day', ${iso}::timestamptz at time zone ${TZ_SQL}) at time zone ${TZ_SQL})`
    const [saved, sittings, cards] = await Promise.all([
      this.db.select().from(dailyGoals).where(eq(dailyGoals.userId, userId)).limit(1),
      // attempt_answers holds a row only for a question the student answered.
      // `earlier` is yesterday; the other bucket is today.
      this.db.execute(sql`
        select (a.submitted_at < ${dayStart}) as earlier, s.code as skill, count(distinct a.id)::int as n
        from attempts a
        join attempt_answers aa on aa.attempt_id = a.id
        join questions q on q.id = aa.question_id
        join exam_parts ep on ep.id = q.exam_part_id
        join parts p on p.id = ep.part_id
        join skills s on s.id = p.skill_id
        where a.user_id = ${userId}
          and a.status in ('SUBMITTED', 'EXPIRED')
          and a.submitted_at >= ${dayStart} - interval '1 day'
          and a.submitted_at < ${dayStart} + interval '1 day'
        group by 1, s.code`) as unknown as Promise<Rows<{ earlier: boolean; skill: string; n: number }>>,
      this.db.execute(sql`
        select (updated_at < ${dayStart}) as earlier, count(*)::int as n
        from card_reviews
        where user_id = ${userId}
          and updated_at >= ${dayStart} - interval '1 day'
          and updated_at < ${dayStart} + interval '1 day'
        group by 1`) as unknown as Promise<Rows<{ earlier: boolean; n: number }>>,
    ])

    const row = saved[0]
    const today = localDay(now)
    const targets = {
      reading: row?.readingTarget ?? 0,
      listening: row?.listeningTarget ?? 0,
      vocab: row?.vocabTarget ?? 0,
    }
    const done = countsFor(sittings.rows, cards.rows, false)
    const hadTargetsYesterday = Boolean(row && row.createdAt < startOfLocalDay(today))
    const active = targets.reading + targets.listening + targets.vocab > 0
    const yesterdayDone = countsFor(sittings.rows, cards.rows, true)
    const delta = {
      reading: targets.reading > 0 ? yesterdayDone.reading - targets.reading : 0,
      listening: targets.listening > 0 ? yesterdayDone.listening - targets.listening : 0,
      vocab: targets.vocab > 0 ? yesterdayDone.vocab - targets.vocab : 0,
    }
    return {
      day: today,
      configured: Boolean(row),
      targets,
      done,
      yesterday:
        hadTargetsYesterday && active
          ? {
              day: previousLocalDay(today),
              done: yesterdayDone,
              delta,
              met: (['reading', 'listening', 'vocab'] as const).every((kind) => targets[kind] === 0 || delta[kind] >= 0),
            }
          : null,
    }
  }

  async set(userId: string, targets: DailyGoalCounts, ip?: string): Promise<DailyGoalsDto> {
    const values = { readingTarget: targets.reading, listeningTarget: targets.listening, vocabTarget: targets.vocab }
    await this.db
      .insert(dailyGoals)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: dailyGoals.userId, set: { ...values, updatedAt: new Date() } })
    await this.audit.log({ action: 'DAILY_GOALS_UPDATED', actorId: userId, entityType: 'user', entityId: userId, metadata: { targets }, ip })
    return this.get(userId)
  }
}
