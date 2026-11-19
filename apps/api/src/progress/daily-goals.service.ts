import { Inject, Injectable } from '@nestjs/common'
import type { DailyGoalCounts, DailyGoalsDto } from '@toeic/shared'
import { eq, sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { DB, type Db } from '../db/database.module'
import { dailyGoals } from '../db/schema'
import { localDay, TZ } from './progress.service'

const TZ_SQL = sql.raw(`'${TZ}'`)

type Rows<T> = { rows: T[] }

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
      this.db.execute(sql`
        select s.code as skill, count(distinct a.id)::int as n
        from attempts a
        join attempt_answers aa on aa.attempt_id = a.id
        join questions q on q.id = aa.question_id
        join exam_parts ep on ep.id = q.exam_part_id
        join parts p on p.id = ep.part_id
        join skills s on s.id = p.skill_id
        where a.user_id = ${userId}
          and a.status in ('SUBMITTED', 'EXPIRED')
          and a.submitted_at >= ${dayStart}
          and a.submitted_at < ${dayStart} + interval '1 day'
        group by s.code`) as unknown as Promise<Rows<{ skill: string; n: number }>>,
      // One row per card, so a card reviewed several times today counts once.
      this.db.execute(sql`
        select count(*)::int as n
        from card_reviews
        where user_id = ${userId}
          and updated_at >= ${dayStart}
          and updated_at < ${dayStart} + interval '1 day'`) as unknown as Promise<Rows<{ n: number }>>,
    ])

    const row = saved[0]
    const bySkill = new Map(sittings.rows.map((r) => [r.skill, Number(r.n)]))
    return {
      day: localDay(now),
      configured: Boolean(row),
      targets: {
        reading: row?.readingTarget ?? 0,
        listening: row?.listeningTarget ?? 0,
        vocab: row?.vocabTarget ?? 0,
      },
      done: {
        reading: bySkill.get('READING') ?? 0,
        listening: bySkill.get('LISTENING') ?? 0,
        vocab: Number(cards.rows[0]?.n ?? 0),
      },
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
