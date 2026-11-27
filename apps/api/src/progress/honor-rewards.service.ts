import { Inject, Injectable } from '@nestjs/common'
import {
  CENTER_MIN_XP,
  DEFAULT_SITE_SETTINGS,
  HONOR_TOP_SIZE,
  STREAK_MILESTONES,
  XP_PER_CORRECT,
  assignPodiumPlaces,
  effectiveAvatarFrame,
  getFrameDef,
  normalizeHonorRewardConfig,
  rankFromXp,
  streakBonusXp,
  type AdjustUserPointsInput,
  type EarlySettleHonorInput,
  type HonorBoardDto,
  type HonorEntryDto,
  type HonorPeriod,
  type HonorRewardConfig,
  type HonorScope,
  type HonorScopedPeriodDto,
  type HonorSettlementDto,
  type SettlementWinnerDto,
  type StaffHonorDto,
} from '@toeic/shared'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app-exception'
import { DB, type Db } from '../db/database.module'
import { classTeachers, classes, honorSettlements, rewardPointLedger, siteSettings, userAvatarFrames, users } from '../db/schema'

const TZ = 'Asia/Ho_Chi_Minh'
const TZ_SQL = sql.raw(`'${TZ}'`)
const XP_PER_CORRECT_SQL = sql.raw(String(XP_PER_CORRECT))
const WEEKLY_FRAME_DAYS = 7
const ROLLOUT_CYCLE_KEY = 'INIT_ROLLOUT'
const ROLLOUT_SCOPE_KEY = 'SYSTEM'

type Rows<T> = { rows: T[] }

type PeriodBounds = {
  weekStartDay: string
  weekStart: Date
  weekEnd: Date
  prevWeekStart: Date
  prevWeekDay: string
  monthKey: string
  monthStart: Date
  monthEnd: Date
  prevMonthStart: Date
  prevMonthKey: string
  yearKey: string
  yearStart: Date
  yearEnd: Date
  prevYearStart: Date
  prevYearKey: string
}

type RawMemberXp = {
  userId: string
  name: string
  avatarUrl: string | null
  avatarFrame: string
  rewardPoints: number
  classId: string | null
  className: string | null
  weekQ: number
  monthQ: number
  yearQ: number
  lifetimeQ: number
  streakDays: number
}

type HonorSnapshot = {
  enabled: boolean
  bounds: PeriodBounds
  rewardConfig: HonorRewardConfig
  byUser: Map<string, RawMemberXp>
  students: RawMemberXp[]
}

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const localDay = (d: Date) => dayFormat.format(d)

function previousDay(day: string): string {
  const t = new Date(`${day}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}

function computeStreakDays(activeDays: string[], today: string): number {
  const set = new Set(activeDays)
  const activeToday = set.has(today)
  let cursor = activeToday ? today : previousDay(today)
  let days = 0
  while (set.has(cursor)) {
    days++
    cursor = previousDay(cursor)
  }
  return days
}

@Injectable()
export class HonorRewardsService {
  private lastSettledWindowKey: string | null = null

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async honorBoard(userId: string, now = new Date()): Promise<HonorBoardDto> {
    const snap = await this.snapshot(now)
    const meRaw = snap.byUser.get(userId)

    if (snap.enabled && meRaw && meRaw.streakDays >= 7) {
      await this.syncStreakMilestones(userId, meRaw.streakDays, now)
    }

    const emptyScoped = (endsAt: string, minPodiumXp: number): HonorScopedPeriodDto => ({
      entries: [],
      you: null,
      rivals: [],
      participants: 0,
      minPodiumXp,
      endsAt,
    })

    if (!snap.enabled) {
      return {
        enabled: false,
        weekStart: snap.bounds.weekStartDay,
        monthKey: snap.bounds.monthKey,
        yearKey: snap.bounds.yearKey,
        className: null,
        me: {
          weeklyXp: 0,
          monthlyXp: 0,
          yearlyXp: 0,
          lifetimeXp: 0,
          streakDays: 0,
          rank: rankFromXp(0),
          rewardPoints: meRaw?.rewardPoints ?? 0,
          avatarFrame: meRaw?.avatarFrame ?? 'none',
        },
        boards: {
          class: {
            week: emptyScoped(snap.bounds.weekEnd.toISOString(), 1),
            month: emptyScoped(snap.bounds.monthEnd.toISOString(), 1),
            year: emptyScoped(snap.bounds.yearEnd.toISOString(), 1),
          },
          center: {
            week: emptyScoped(snap.bounds.weekEnd.toISOString(), CENTER_MIN_XP.week),
            month: emptyScoped(snap.bounds.monthEnd.toISOString(), CENTER_MIN_XP.month),
            year: emptyScoped(snap.bounds.yearEnd.toISOString(), CENTER_MIN_XP.year),
          },
        },
        rewardConfig: snap.rewardConfig,
      }
    }

    const weekClass = this.buildScopedBoard(snap, 'class', 'week', meRaw?.classId ?? null, userId, new Set())
    const monthClass = this.buildScopedBoard(snap, 'class', 'month', meRaw?.classId ?? null, userId, new Set())
    const yearClass = this.buildScopedBoard(snap, 'class', 'year', meRaw?.classId ?? null, userId, new Set())
    const weekCenter = this.buildScopedBoard(snap, 'center', 'week', null, userId, new Set())
    const monthCenter = this.buildScopedBoard(snap, 'center', 'month', null, userId, new Set())
    const yearCenter = this.buildScopedBoard(snap, 'center', 'year', null, userId, new Set())

    const weeklyXp = meRaw && meRaw.weekQ > 0 ? meRaw.weekQ + streakBonusXp(meRaw.streakDays, 'week') : 0
    const monthlyXp = meRaw && meRaw.monthQ > 0 ? meRaw.monthQ + streakBonusXp(meRaw.streakDays, 'month') : 0
    const yearlyXp = meRaw && meRaw.yearQ > 0 ? meRaw.yearQ + streakBonusXp(meRaw.streakDays, 'year') : 0
    const lifetimeXp = meRaw?.lifetimeQ ?? 0

    return {
      enabled: true,
      weekStart: snap.bounds.weekStartDay,
      monthKey: snap.bounds.monthKey,
      yearKey: snap.bounds.yearKey,
      className: meRaw?.className ?? null,
      me: {
        weeklyXp,
        monthlyXp,
        yearlyXp,
        lifetimeXp,
        streakDays: meRaw?.streakDays ?? 0,
        rank: rankFromXp(lifetimeXp),
        rewardPoints: meRaw?.rewardPoints ?? 0,
        avatarFrame: meRaw?.avatarFrame ?? 'none',
      },
      boards: {
        class: { week: weekClass, month: monthClass, year: yearClass },
        center: { week: weekCenter, month: monthCenter, year: yearCenter },
      },
      rewardConfig: snap.rewardConfig,
    }
  }

  async staffHonor(actor: { id: string; role: string }, now = new Date()): Promise<StaffHonorDto> {
    const snap = await this.snapshot(now)
    const managed =
      actor.role === 'ADMIN'
        ? null
        : new Set(
            (await this.db.select({ classId: classTeachers.classId }).from(classTeachers).where(eq(classTeachers.userId, actor.id))).map((r) => r.classId),
          )
    const roomRows =
      managed === null
        ? await this.db.select({ id: classes.id, name: classes.name }).from(classes).where(isNull(classes.closedAt))
        : await this.db
            .select({ id: classes.id, name: classes.name })
            .from(classes)
            .innerJoin(classTeachers, eq(classTeachers.classId, classes.id))
            .where(and(eq(classTeachers.userId, actor.id), isNull(classes.closedAt)))

    const settlements = actor.role === 'ADMIN' ? await this.listSettlements() : []
    if (!snap.enabled) {
      return {
        enabled: false,
        weekStart: snap.bounds.weekStartDay,
        monthKey: snap.bounds.monthKey,
        yearKey: snap.bounds.yearKey,
        classes: [],
        center: {
          week: { entries: [], participants: 0, minPodiumXp: CENTER_MIN_XP.week, endsAt: snap.bounds.weekEnd.toISOString() },
          month: { entries: [], participants: 0, minPodiumXp: CENTER_MIN_XP.month, endsAt: snap.bounds.monthEnd.toISOString() },
          year: { entries: [], participants: 0, minPodiumXp: CENTER_MIN_XP.year, endsAt: snap.bounds.yearEnd.toISOString() },
        },
        rewardConfig: snap.rewardConfig,
        settlements,
      }
    }

    const centerWeek = this.buildScopedBoard(snap, 'center', 'week', null, null, managed ?? new Set(), true)
    const centerMonth = this.buildScopedBoard(snap, 'center', 'month', null, null, managed ?? new Set(), true)
    const centerYear = this.buildScopedBoard(snap, 'center', 'year', null, null, managed ?? new Set(), true)

    return {
      enabled: true,
      weekStart: snap.bounds.weekStartDay,
      monthKey: snap.bounds.monthKey,
      yearKey: snap.bounds.yearKey,
      classes: roomRows
        .map((room) => {
          const w = this.buildScopedBoard(snap, 'class', 'week', room.id, null, managed ?? new Set(), true)
          const m = this.buildScopedBoard(snap, 'class', 'month', room.id, null, managed ?? new Set(), true)
          const y = this.buildScopedBoard(snap, 'class', 'year', room.id, null, managed ?? new Set(), true)
          return {
            classId: room.id,
            className: room.name,
            boards: {
              week: { entries: w.entries, participants: w.participants, endsAt: w.endsAt },
              month: { entries: m.entries, participants: m.participants, endsAt: m.endsAt },
              year: { entries: y.entries, participants: y.participants, endsAt: y.endsAt },
            },
          }
        })
        .sort((a, b) => a.className.localeCompare(b.className, 'vi')),
      center: {
        week: { entries: centerWeek.entries, participants: centerWeek.participants, minPodiumXp: centerWeek.minPodiumXp, endsAt: centerWeek.endsAt },
        month: { entries: centerMonth.entries, participants: centerMonth.participants, minPodiumXp: centerMonth.minPodiumXp, endsAt: centerMonth.endsAt },
        year: { entries: centerYear.entries, participants: centerYear.participants, minPodiumXp: centerYear.minPodiumXp, endsAt: centerYear.endsAt },
      },
      rewardConfig: snap.rewardConfig,
      settlements,
    }
  }

  async updateRewardConfig(actorId: string, rawInput: unknown, ip?: string): Promise<HonorRewardConfig> {
    const normalized = normalizeHonorRewardConfig(rawInput)
    const [existing] = await this.db.select({ id: siteSettings.id }).from(siteSettings).where(eq(siteSettings.id, 'default')).limit(1)
    if (!existing) {
      const d = DEFAULT_SITE_SETTINGS
      await this.db.insert(siteSettings).values({
        id: 'default',
        brandName: d.brandName,
        slogan: d.slogan,
        loginHeadline: d.loginHeadline,
        loginIntro: d.loginIntro,
        footerAbout: d.footerAbout,
        supportHeading: d.supportHeading,
        supportDetail: d.supportDetail,
        phone: d.phone,
        address: d.address,
        hours: d.hours,
        channelHeading: d.channelHeading,
        channelDetail: d.channelDetail,
        legalNote: d.legalNote,
        copyright: d.copyright,
        themePrimary: d.theme.primary,
        themePrimarySoft: d.theme.primarySoft,
        themePaper: d.theme.paper,
        themeButton: d.theme.button ?? '#143899',
        backgroundMode: d.backgroundMode,
        themePreset: d.themePreset,
        honorBoardEnabled: d.honorBoardEnabled,
        honorRewardConfig: normalized,
      })
    } else {
      await this.db.update(siteSettings).set({ honorRewardConfig: normalized, updatedAt: new Date() }).where(eq(siteSettings.id, 'default'))
    }
    await this.audit.log({ action: 'HONOR_CONFIG_UPDATED', actorId, entityType: 'site_settings', entityId: 'default', ip })
    return normalized
  }

  async adjustUserPoints(actorId: string, input: AdjustUserPointsInput, ip?: string): Promise<{ userId: string; rewardPoints: number }> {
    const result = await this.db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: users.id, role: users.role, rewardPoints: users.rewardPoints })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1)
      if (!target || target.role !== 'STUDENT') throw AppException.notFound('Không tìm thấy học viên')

      const nextPoints = Math.max(0, (target.rewardPoints ?? 0) + input.delta)
      const appliedDelta = nextPoints - (target.rewardPoints ?? 0)
      await tx.update(users).set({ rewardPoints: nextPoints, updatedAt: new Date() }).where(eq(users.id, target.id))
      await tx.insert(rewardPointLedger).values({
        userId: target.id,
        delta: appliedDelta,
        reason: input.reason,
        source: 'ADMIN',
        actorId,
      })
      return { userId: target.id, rewardPoints: nextPoints, appliedDelta }
    })

    await this.audit.log({
      action: 'HONOR_POINTS_ADJUSTED',
      actorId,
      entityType: 'user',
      entityId: input.userId,
      metadata: { delta: result.appliedDelta, reason: input.reason },
      ip,
    })
    return { userId: result.userId, rewardPoints: result.rewardPoints }
  }

  async earlySettle(actorId: string, input: EarlySettleHonorInput, now = new Date(), ip?: string): Promise<HonorSettlementDto> {
    const snap = await this.snapshot(now)
    const cycleKey = `EARLY:${input.period.toUpperCase()}:${now.toISOString()}`
    let className: string | null = null
    if (input.scope === 'class') {
      if (!input.classId) throw AppException.badRequest('Hãy chọn lớp cần chốt thưởng.')
      const [room] = await this.db.select({ id: classes.id, name: classes.name }).from(classes).where(eq(classes.id, input.classId)).limit(1)
      if (!room) throw AppException.notFound('Không tìm thấy lớp')
      className = room.name
    }

    const scopeKey = input.scope === 'center' ? 'CENTER' : `CLASS:${input.classId}`
    const ranked = this.rankStudents(snap, input.scope, input.period, input.classId ?? null)
    const settled = await this.commitSettlement({
      cycleKey,
      scopeKey,
      scope: input.scope,
      period: input.period,
      classId: input.classId ?? null,
      className,
      ranked,
      config: snap.rewardConfig,
      triggeredBy: actorId,
      settledAt: now,
    })
    if (!settled) throw AppException.conflict('Kỳ này đã được chốt trước đó.')
    await this.audit.log({
      action: 'HONOR_EARLY_SETTLED',
      actorId,
      entityType: 'honor_settlement',
      entityId: settled.id,
      metadata: { scopeKey, period: input.period, winners: settled.winners.length },
      ip,
    })
    return settled
  }

  async listSettlements(limit = 15): Promise<HonorSettlementDto[]> {
    const rows = await this.db
      .select()
      .from(honorSettlements)
      .where(sql`${honorSettlements.cycleKey} <> ${ROLLOUT_CYCLE_KEY} and ${honorSettlements.cycleKey} not like 'STREAK:%'`)
      .orderBy(desc(honorSettlements.settledAt))
      .limit(limit)

    return rows.map((r) => ({
      id: r.id,
      cycleKey: r.cycleKey,
      scopeKey: r.scopeKey,
      period: (r.period === 'year' ? 'year' : r.period === 'month' ? 'month' : 'week') as HonorPeriod,
      classId: r.classId,
      className: r.className,
      winners: (Array.isArray(r.winners) ? r.winners : []) as unknown as SettlementWinnerDto[],
      triggeredBy: r.triggeredBy,
      settledAt: r.settledAt.toISOString(),
    }))
  }

  // ------------------------------------------------------------------ internals

  private async snapshot(now: Date): Promise<HonorSnapshot> {
    const iso = now.toISOString()
    const [settingsRows, boundsRows] = await Promise.all([
      this.db
        .select({ enabled: siteSettings.honorBoardEnabled, rewardConfig: siteSettings.honorRewardConfig })
        .from(siteSettings)
        .limit(1),
      this.db.execute(sql`
        select
          to_char(date_trunc('week', ${iso}::timestamptz at time zone ${TZ_SQL}), 'YYYY-MM-DD') as week_start_day,
          (date_trunc('week', ${iso}::timestamptz at time zone ${TZ_SQL}) at time zone ${TZ_SQL}) as week_start,
          ((date_trunc('week', ${iso}::timestamptz at time zone ${TZ_SQL}) + interval '7 days') at time zone ${TZ_SQL}) as week_end,
          ((date_trunc('week', ${iso}::timestamptz at time zone ${TZ_SQL}) - interval '7 days') at time zone ${TZ_SQL}) as prev_week_start,
          to_char(date_trunc('week', ${iso}::timestamptz at time zone ${TZ_SQL}) - interval '7 days', 'YYYY-MM-DD') as prev_week_day,
          to_char(date_trunc('month', ${iso}::timestamptz at time zone ${TZ_SQL}), 'YYYY-MM') as month_key,
          (date_trunc('month', ${iso}::timestamptz at time zone ${TZ_SQL}) at time zone ${TZ_SQL}) as month_start,
          ((date_trunc('month', ${iso}::timestamptz at time zone ${TZ_SQL}) + interval '1 month') at time zone ${TZ_SQL}) as month_end,
          ((date_trunc('month', ${iso}::timestamptz at time zone ${TZ_SQL}) - interval '1 month') at time zone ${TZ_SQL}) as prev_month_start,
          to_char(date_trunc('month', ${iso}::timestamptz at time zone ${TZ_SQL}) - interval '1 month', 'YYYY-MM') as prev_month_key,
          to_char(date_trunc('year', ${iso}::timestamptz at time zone ${TZ_SQL}), 'YYYY') as year_key,
          (date_trunc('year', ${iso}::timestamptz at time zone ${TZ_SQL}) at time zone ${TZ_SQL}) as year_start,
          ((date_trunc('year', ${iso}::timestamptz at time zone ${TZ_SQL}) + interval '1 year') at time zone ${TZ_SQL}) as year_end,
          ((date_trunc('year', ${iso}::timestamptz at time zone ${TZ_SQL}) - interval '1 year') at time zone ${TZ_SQL}) as prev_year_start,
          to_char(date_trunc('year', ${iso}::timestamptz at time zone ${TZ_SQL}) - interval '1 year', 'YYYY') as prev_year_key
      `) as unknown as Promise<
        Rows<{
          week_start_day: string
          week_start: Date | string
          week_end: Date | string
          prev_week_start: Date | string
          prev_week_day: string
          month_key: string
          month_start: Date | string
          month_end: Date | string
          prev_month_start: Date | string
          prev_month_key: string
          year_key: string
          year_start: Date | string
          year_end: Date | string
          prev_year_start: Date | string
          prev_year_key: string
        }>
      >,
    ])

    const b = boundsRows.rows[0]!
    const bounds: PeriodBounds = {
      weekStartDay: b.week_start_day,
      weekStart: new Date(b.week_start),
      weekEnd: new Date(b.week_end),
      prevWeekStart: new Date(b.prev_week_start),
      prevWeekDay: b.prev_week_day,
      monthKey: b.month_key,
      monthStart: new Date(b.month_start),
      monthEnd: new Date(b.month_end),
      prevMonthStart: new Date(b.prev_month_start),
      prevMonthKey: b.prev_month_key,
      yearKey: b.year_key,
      yearStart: new Date(b.year_start),
      yearEnd: new Date(b.year_end),
      prevYearStart: new Date(b.prev_year_start),
      prevYearKey: b.prev_year_key,
    }
    const enabled = settingsRows[0]?.enabled ?? true
    const rewardConfig = normalizeHonorRewardConfig(settingsRows[0]?.rewardConfig)
    if (!enabled) {
      return { enabled: false, bounds, rewardConfig, byUser: new Map(), students: [] }
    }

    await this.ensurePastCyclesSettled(bounds, rewardConfig, now)

    const weekStartIso = bounds.weekStart.toISOString()
    const monthStartIso = bounds.monthStart.toISOString()
    const yearStartIso = bounds.yearStart.toISOString()
    const today = localDay(now)

    const [studentRows, dayRows] = await Promise.all([
      this.db.execute(sql`
        with student_xp as (
          select
            a.user_id,
            count(distinct aa.question_id) filter (where a.submitted_at >= ${weekStartIso}::timestamptz and a.submitted_at <= ${iso}::timestamptz)::int as week_q,
            count(distinct aa.question_id) filter (where a.submitted_at >= ${monthStartIso}::timestamptz and a.submitted_at <= ${iso}::timestamptz)::int as month_q,
            count(distinct aa.question_id) filter (where a.submitted_at >= ${yearStartIso}::timestamptz and a.submitted_at <= ${iso}::timestamptz)::int as year_q,
            count(distinct aa.question_id)::int as lifetime_q
          from attempt_answers aa
          join attempts a on a.id = aa.attempt_id
          where aa.is_correct = true
            and a.status in ('SUBMITTED', 'EXPIRED')
            and a.submitted_at is not null
            and a.submitted_at <= ${iso}::timestamptz
          group by a.user_id
        ),
        game_xp as (
          select
            v.user_id,
            coalesce(sum(v.xp_awarded) filter (where v.played_at >= ${weekStartIso}::timestamptz and v.played_at <= ${iso}::timestamptz), 0)::int as week_g,
            coalesce(sum(v.xp_awarded) filter (where v.played_at >= ${monthStartIso}::timestamptz and v.played_at <= ${iso}::timestamptz), 0)::int as month_g,
            coalesce(sum(v.xp_awarded) filter (where v.played_at >= ${yearStartIso}::timestamptz and v.played_at <= ${iso}::timestamptz), 0)::int as year_g,
            coalesce(sum(v.xp_awarded), 0)::int as lifetime_g
          from vocab_game_logs v
          where v.played_at <= ${iso}::timestamptz
          group by v.user_id
        )
        select
          u.id as user_id,
          u.full_name as name,
          u.avatar_url,
          u.avatar_frame,
          u.avatar_frame_expires_at,
          u.reward_points,
          cm.class_id,
          c.name as class_name,
          coalesce(sx.week_q, 0)::int as week_q,
          coalesce(sx.month_q, 0)::int as month_q,
          coalesce(sx.year_q, 0)::int as year_q,
          coalesce(sx.lifetime_q, 0)::int as lifetime_q,
          coalesce(gx.week_g, 0)::int as week_g,
          coalesce(gx.month_g, 0)::int as month_g,
          coalesce(gx.year_g, 0)::int as year_g,
          coalesce(gx.lifetime_g, 0)::int as lifetime_g
        from users u
        left join student_xp sx on sx.user_id = u.id
        left join game_xp gx on gx.user_id = u.id
        left join class_members cm on cm.user_id = u.id
        left join classes c on c.id = cm.class_id
        where u.role = 'STUDENT' and u.status = 'ACTIVE'
      `) as unknown as Promise<
        Rows<{
          user_id: string
          name: string
          avatar_url: string | null
          avatar_frame: string
          avatar_frame_expires_at: Date | string | null
          reward_points: number
          class_id: string | null
          class_name: string | null
          week_q: number
          month_q: number
          year_q: number
          lifetime_q: number
          week_g: number
          month_g: number
          year_g: number
          lifetime_g: number
        }>
      >,
      this.db.execute(sql`
        select distinct user_id, day from (
          select a.user_id, to_char(aa.answered_at at time zone ${TZ_SQL}, 'YYYY-MM-DD') as day
          from attempt_answers aa
          join attempts a on a.id = aa.attempt_id
          join users u on u.id = a.user_id
          where u.role = 'STUDENT'
            and u.status = 'ACTIVE'
            and aa.answered_at > ${iso}::timestamptz - interval '400 days'
            and aa.answered_at <= ${iso}::timestamptz
          union
          select v.user_id, v.played_day as day
          from vocab_game_logs v
          join users u on u.id = v.user_id
          where u.role = 'STUDENT'
            and u.status = 'ACTIVE'
            and v.played_at > ${iso}::timestamptz - interval '400 days'
            and v.played_at <= ${iso}::timestamptz
        ) active_days
      `) as unknown as Promise<Rows<{ user_id: string; day: string }>>,
    ])

    const daysByUser = new Map<string, string[]>()
    for (const r of dayRows.rows) {
      const list = daysByUser.get(r.user_id) ?? []
      list.push(r.day)
      daysByUser.set(r.user_id, list)
    }

    const students: RawMemberXp[] = studentRows.rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      avatarUrl: r.avatar_url,
      avatarFrame: effectiveAvatarFrame('STUDENT', r.avatar_frame, r.avatar_frame_expires_at, now),
      rewardPoints: Number(r.reward_points ?? 0),
      classId: r.class_id,
      className: r.class_name,
      weekQ: Number(r.week_q) * XP_PER_CORRECT + Number(r.week_g ?? 0),
      monthQ: Number(r.month_q) * XP_PER_CORRECT + Number(r.month_g ?? 0),
      yearQ: Number(r.year_q) * XP_PER_CORRECT + Number(r.year_g ?? 0),
      lifetimeQ: Number(r.lifetime_q) * XP_PER_CORRECT + Number(r.lifetime_g ?? 0),
      streakDays: computeStreakDays(daysByUser.get(r.user_id) ?? [], today),
    }))

    return {
      enabled: true,
      bounds,
      rewardConfig,
      byUser: new Map(students.map((s) => [s.userId, s])),
      students,
    }
  }

  private rankStudents(
    snap: HonorSnapshot,
    scope: HonorScope,
    period: HonorPeriod,
    classId: string | null,
  ): Array<RawMemberXp & { place: number; periodXp: number; questionXp: number; streakBonusXp: number }> {
    if (scope === 'class' && !classId) return []
    const minPodiumXp = scope === 'center' ? CENTER_MIN_XP[period] : 1
    const candidates = snap.students
      .filter((s) => (scope === 'class' ? s.classId === classId : Boolean(s.classId)))
      .map((s) => {
        const questionXp = period === 'week' ? s.weekQ : period === 'month' ? s.monthQ : s.yearQ
        const bonus = questionXp > 0 ? streakBonusXp(s.streakDays, period) : 0
        return {
          ...s,
          questionXp,
          streakBonusXp: bonus,
          periodXp: questionXp + bonus,
        }
      })
      .filter((s) => s.periodXp > 0)

    return assignPodiumPlaces(candidates, minPodiumXp)
  }

  private toEntry(
    row: RawMemberXp & { place: number; periodXp: number; questionXp: number; streakBonusXp: number },
    viewerId: string | null,
    yours: Set<string>,
  ): HonorEntryDto {
    return {
      place: row.place,
      name: row.name,
      avatarUrl: row.avatarUrl,
      avatarFrame: row.avatarFrame,
      className: row.className ?? '',
      periodXp: row.periodXp,
      questionXp: row.questionXp,
      streakDays: row.streakDays,
      streakBonusXp: row.streakBonusXp,
      lifetimeXp: row.lifetimeQ,
      rank: rankFromXp(row.lifetimeQ),
      you: row.userId === viewerId,
      yours: row.classId ? yours.has(row.classId) : false,
    }
  }

  private buildScopedBoard(
    snap: HonorSnapshot,
    scope: HonorScope,
    period: HonorPeriod,
    classId: string | null,
    viewerId: string | null,
    yours: Set<string>,
    allForStaff = false,
  ): HonorScopedPeriodDto {
    const minPodiumXp = scope === 'center' ? CENTER_MIN_XP[period] : 1
    const endsAt = (period === 'week' ? snap.bounds.weekEnd : period === 'month' ? snap.bounds.monthEnd : snap.bounds.yearEnd).toISOString()
    const ranked = this.rankStudents(snap, scope, period, classId).map((r) => ({
      entry: this.toEntry(r, viewerId, yours),
      userId: r.userId,
    }))

    const entries = (allForStaff ? ranked : ranked.slice(0, HONOR_TOP_SIZE)).map((x) => x.entry)
    const youIdx = viewerId ? ranked.findIndex((x) => x.userId === viewerId) : -1
    const you = youIdx >= 0 ? ranked[youIdx]!.entry : null

    let rivals: HonorEntryDto[] = []
    if (youIdx >= 0) {
      rivals = ranked.slice(Math.max(0, youIdx - 2), Math.min(ranked.length, youIdx + 3)).map((x) => x.entry)
    } else if (viewerId) {
      const meRaw = snap.byUser.get(viewerId)
      const inScope = meRaw && (scope === 'center' ? Boolean(meRaw.classId) : meRaw.classId === classId)
      if (inScope && ranked.length > 0) {
        const tail = ranked.slice(-2).map((x) => x.entry)
        rivals = [
          ...tail,
          {
            place: ranked.length + 1,
            name: meRaw.name,
            avatarUrl: meRaw.avatarUrl,
            avatarFrame: meRaw.avatarFrame,
            className: meRaw.className ?? '',
            periodXp: 0,
            questionXp: 0,
            streakDays: meRaw.streakDays,
            streakBonusXp: 0,
            lifetimeXp: meRaw.lifetimeQ,
            rank: rankFromXp(meRaw.lifetimeQ),
            you: true,
            yours: false,
          },
        ]
      }
    }

    return {
      entries,
      you,
      rivals,
      participants: ranked.length,
      minPodiumXp,
      endsAt,
    }
  }

  /** Settles completed previous week/month/year only when that period finished AFTER the rollout sentinel timestamp. */
  private async ensurePastCyclesSettled(bounds: PeriodBounds, config: HonorRewardConfig, now: Date) {
    const windowKey = `${bounds.weekStartDay}:${bounds.monthKey}:${bounds.yearKey}`
    if (this.lastSettledWindowKey === windowKey) return

    const [existingRollout] = await this.db
      .select({ settledAt: honorSettlements.settledAt })
      .from(honorSettlements)
      .where(and(eq(honorSettlements.cycleKey, ROLLOUT_CYCLE_KEY), eq(honorSettlements.scopeKey, ROLLOUT_SCOPE_KEY)))
      .limit(1)

    let rolloutAt = existingRollout?.settledAt
    if (!rolloutAt) {
      const [inserted] = await this.db
        .insert(honorSettlements)
        .values({ cycleKey: ROLLOUT_CYCLE_KEY, scopeKey: ROLLOUT_SCOPE_KEY, period: 'week', winners: [] })
        .onConflictDoNothing()
        .returning({ settledAt: honorSettlements.settledAt })
      if (inserted) {
        rolloutAt = inserted.settledAt
      } else {
        const [reloaded] = await this.db
          .select({ settledAt: honorSettlements.settledAt })
          .from(honorSettlements)
          .where(and(eq(honorSettlements.cycleKey, ROLLOUT_CYCLE_KEY), eq(honorSettlements.scopeKey, ROLLOUT_SCOPE_KEY)))
          .limit(1)
        rolloutAt = reloaded?.settledAt ?? now
      }
    }

    if (bounds.weekStart.getTime() > rolloutAt.getTime()) {
      await this.settleCompletedWindow('week', `WEEK:${bounds.prevWeekDay}`, bounds.prevWeekStart, bounds.weekStart, config, now)
    }
    if (bounds.monthStart.getTime() > rolloutAt.getTime()) {
      await this.settleCompletedWindow('month', `MONTH:${bounds.prevMonthKey}`, bounds.prevMonthStart, bounds.monthStart, config, now)
    }
    if (bounds.yearStart.getTime() > rolloutAt.getTime()) {
      await this.settleCompletedWindow('year', `YEAR:${bounds.prevYearKey}`, bounds.prevYearStart, bounds.yearStart, config, now)
    }

    this.lastSettledWindowKey = windowKey
  }

  private async settleCompletedWindow(
    period: HonorPeriod,
    cycleKey: string,
    start: Date,
    end: Date,
    config: HonorRewardConfig,
    settledAt: Date,
  ) {
    const startIso = start.toISOString()
    const endIso = end.toISOString()
    const [xpRows, gameRows, dayRows, roomRows] = await Promise.all([
      this.db.execute(sql`
        select
          u.id as user_id,
          u.full_name as name,
          cm.class_id,
          count(distinct aa.question_id)::int as q_count
        from users u
        join class_members cm on cm.user_id = u.id
        join attempts a on a.user_id = u.id
        join attempt_answers aa on aa.attempt_id = a.id
        where u.role = 'STUDENT'
          and u.status = 'ACTIVE'
          and aa.is_correct = true
          and a.status in ('SUBMITTED', 'EXPIRED')
          and a.submitted_at >= ${startIso}::timestamptz
          and a.submitted_at < ${endIso}::timestamptz
        group by u.id, u.full_name, cm.class_id
      `) as unknown as Promise<Rows<{ user_id: string; name: string; class_id: string; q_count: number }>>,
      this.db.execute(sql`
        select v.user_id, u.full_name as name, cm.class_id, coalesce(sum(v.xp_awarded), 0)::int as g_xp
        from vocab_game_logs v
        join users u on u.id = v.user_id
        join class_members cm on cm.user_id = u.id
        where u.role = 'STUDENT'
          and u.status = 'ACTIVE'
          and v.played_at >= ${startIso}::timestamptz
          and v.played_at < ${endIso}::timestamptz
        group by v.user_id, u.full_name, cm.class_id
      `) as unknown as Promise<Rows<{ user_id: string; name: string; class_id: string; g_xp: number }>>,
      this.db.execute(sql`
        select distinct user_id, day from (
          select a.user_id, to_char(aa.answered_at at time zone ${TZ_SQL}, 'YYYY-MM-DD') as day
          from attempt_answers aa
          join attempts a on a.id = aa.attempt_id
          where aa.answered_at >= ${startIso}::timestamptz - interval '120 days'
            and aa.answered_at < ${endIso}::timestamptz
          union
          select v.user_id, v.played_day as day
          from vocab_game_logs v
          where v.played_at >= ${startIso}::timestamptz - interval '120 days'
            and v.played_at < ${endIso}::timestamptz
        ) active_days
      `) as unknown as Promise<Rows<{ user_id: string; day: string }>>,
      this.db.select({ id: classes.id, name: classes.name }).from(classes).where(isNull(classes.closedAt)),
    ])

    const endLocalDay = previousDay(localDay(end))
    const daysByUser = new Map<string, string[]>()
    for (const r of dayRows.rows) {
      const list = daysByUser.get(r.user_id) ?? []
      list.push(r.day)
      daysByUser.set(r.user_id, list)
    }

    const merged = new Map<string, { userId: string; name: string; classId: string; qXp: number }>()
    for (const r of xpRows.rows) {
      merged.set(r.user_id, {
        userId: r.user_id,
        name: r.name,
        classId: r.class_id,
        qXp: Number(r.q_count) * XP_PER_CORRECT,
      })
    }
    for (const g of gameRows.rows) {
      const cur = merged.get(g.user_id)
      if (cur) cur.qXp += Number(g.g_xp)
      else merged.set(g.user_id, { userId: g.user_id, name: g.name, classId: g.class_id, qXp: Number(g.g_xp) })
    }

    const baseRows = [...merged.values()]
      .map((r) => {
        const streak = computeStreakDays(daysByUser.get(r.userId) ?? [], endLocalDay)
        const bonus = r.qXp > 0 ? streakBonusXp(streak, period) : 0
        return {
          userId: r.userId,
          name: r.name,
          classId: r.classId,
          periodXp: r.qXp + bonus,
        }
      })
      .filter((r) => r.periodXp > 0)

    const centerRanked = assignPodiumPlaces(baseRows, CENTER_MIN_XP[period])
    await this.commitSettlement({
      cycleKey,
      scopeKey: 'CENTER',
      scope: 'center',
      period,
      classId: null,
      className: 'Toàn Trung Tâm',
      ranked: centerRanked,
      config,
      triggeredBy: null,
      settledAt,
    })

    for (const room of roomRows) {
      const classRanked = assignPodiumPlaces(
        baseRows.filter((r) => r.classId === room.id),
        1,
      )
      await this.commitSettlement({
        cycleKey,
        scopeKey: `CLASS:${room.id}`,
        scope: 'class',
        period,
        classId: room.id,
        className: room.name,
        ranked: classRanked,
        config,
        triggeredBy: null,
        settledAt,
      })
    }
  }

  private async commitSettlement(params: {
    cycleKey: string
    scopeKey: string
    scope: HonorScope
    period: HonorPeriod
    classId: string | null
    className: string | null
    ranked: Array<{ userId: string; name: string; place: number; periodXp: number }>
    config: HonorRewardConfig
    triggeredBy: string | null
    settledAt: Date
  }): Promise<HonorSettlementDto | null> {
    const tiers = params.config[params.scope][params.period]
    const podium = params.ranked.filter((r) => r.place >= 1 && r.place <= 3)
    const winners: SettlementWinnerDto[] = podium.map((r) => {
      const tier = tiers.find((t) => t.place === r.place)!
      return {
        place: r.place as 1 | 2 | 3,
        userId: r.userId,
        name: r.name,
        periodXp: r.periodXp,
        points: tier.points,
        frameId: tier.frameId,
      }
    })

    const frameExpiresAt = params.period === 'week' ? new Date(params.settledAt.getTime() + WEEKLY_FRAME_DAYS * 86_400_000) : null
    const source = params.period === 'week' ? 'AUTO_WEEK' : params.period === 'month' ? 'AUTO_MONTH' : 'AUTO_YEAR'
    const periodLabel = params.period === 'week' ? 'Tuần' : params.period === 'month' ? 'Tháng' : 'Năm'
    const scopeTitle = params.scope === 'center' ? 'Toàn Trung Tâm' : params.className ?? 'Lớp học'

    return this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(honorSettlements)
        .values({
          cycleKey: params.cycleKey,
          scopeKey: params.scopeKey,
          period: params.period,
          classId: params.classId,
          className: params.className,
          winners: winners as unknown as Array<Record<string, unknown>>,
          triggeredBy: params.triggeredBy,
          settledAt: params.settledAt,
        })
        .onConflictDoNothing({ target: [honorSettlements.cycleKey, honorSettlements.scopeKey] })
        .returning()

      if (!inserted) return null

      for (const w of winners) {
        if (w.points > 0) {
          await tx
            .update(users)
            .set({ rewardPoints: sql`${users.rewardPoints} + ${w.points}`, updatedAt: params.settledAt })
            .where(eq(users.id, w.userId))
          await tx.insert(rewardPointLedger).values({
            userId: w.userId,
            delta: w.points,
            reason: `Đạt Top ${w.place} ${periodLabel} (${scopeTitle})`,
            source,
            settlementId: inserted.id,
            actorId: params.triggeredBy,
            createdAt: params.settledAt,
          })
        }

        if (w.frameId !== 'none') {
          await this.grantFrameTx(tx, w.userId, w.frameId, frameExpiresAt, params.settledAt)
        }
      }

      return {
        id: inserted.id,
        cycleKey: inserted.cycleKey,
        scopeKey: inserted.scopeKey,
        period: params.period,
        classId: inserted.classId,
        className: inserted.className,
        winners,
        triggeredBy: inserted.triggeredBy,
        settledAt: inserted.settledAt.toISOString(),
      }
    })
  }

  private async syncStreakMilestones(userId: string, streakDays: number, now: Date) {
    for (const m of STREAK_MILESTONES) {
      if (streakDays < m.days) continue
      const cycleKey = `STREAK:${m.days}`
      const scopeKey = `USER:${userId}`
      await this.db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(honorSettlements)
          .values({
            cycleKey,
            scopeKey,
            period: 'month',
            winners: [{ place: 1, userId, name: '', periodXp: streakDays, points: m.points, frameId: m.frameId }],
            settledAt: now,
          })
          .onConflictDoNothing({ target: [honorSettlements.cycleKey, honorSettlements.scopeKey] })
          .returning({ id: honorSettlements.id })

        if (!inserted) return
        await tx
          .update(users)
          .set({ rewardPoints: sql`${users.rewardPoints} + ${m.points}`, updatedAt: now })
          .where(eq(users.id, userId))
        await tx.insert(rewardPointLedger).values({
          userId,
          delta: m.points,
          reason: `Đạt mốc Streak ${m.days} ngày liên tiếp (${getFrameDef(m.frameId).name})`,
          source: 'STREAK',
          settlementId: inserted.id,
          createdAt: now,
        })
        await this.grantFrameTx(tx, userId, m.frameId, null, now)
      })
    }
  }

  /** Grants a frame while guaranteeing permanent (NULL) expiry is never overwritten by a temporary 7-day expiry. */
  private async grantFrameTx(
    tx: Pick<Db, 'insert' | 'update'>,
    userId: string,
    frameId: string,
    expiresAt: Date | null,
    now: Date,
  ) {
    await tx
      .insert(userAvatarFrames)
      .values({ userId, frameId, unlockedAt: now, expiresAt })
      .onConflictDoUpdate({
        target: [userAvatarFrames.userId, userAvatarFrames.frameId],
        set: {
          expiresAt: sql`case when ${userAvatarFrames.expiresAt} is null or excluded.expires_at is null then null else greatest(${userAvatarFrames.expiresAt}, excluded.expires_at) end`,
        },
      })
    if (expiresAt === null) {
      await tx
        .update(users)
        .set({ avatarFrameExpiresAt: null })
        .where(and(eq(users.id, userId), eq(users.avatarFrame, frameId)))
    }
  }
}
