import { z } from 'zod'
import { AVATAR_FRAME_IDS } from './frames'

/** EXP from the first time a sentence pattern is answered correctly, plus Streak bonus and reward cycles. */

export const XP_PER_CORRECT = 1
export const XP_PER_RANK = 300
/** Yearly EXP constants kept for legacy callers. */
export const CENTER_TOP1_XP = 2000
export const CENTER_PODIUM_XP = 1500
export const HONOR_TOP_SIZE = 10
export const HONOR_BOARD_SIZE = HONOR_TOP_SIZE

export const HONOR_PERIODS = ['week', 'month', 'year'] as const
export type HonorPeriod = (typeof HONOR_PERIODS)[number]

export const HONOR_SCOPES = ['class', 'center'] as const
export type HonorScope = (typeof HONOR_SCOPES)[number]

export const CENTER_MIN_XP: Record<HonorPeriod, number> = {
  week: 50,
  month: 200,
  year: 1000,
}

export const STREAK_MILESTONES = [
  { days: 7, frameId: 'streak-7', points: 30 },
  { days: 30, frameId: 'streak-30', points: 100 },
  { days: 100, frameId: 'streak-100', points: 300 },
] as const

/** EXP for a set of sentence patterns that were correct for the first time. */
export function xpForCorrect(correct: number): number {
  return Math.max(0, Math.floor(correct)) * XP_PER_CORRECT
}

/** Bonus EXP from the student's active learning streak for the given leaderboard cycle. */
export function streakBonusXp(streakDays: number, period: HonorPeriod): number {
  const safe = Math.max(0, Math.floor(Number.isFinite(streakDays) ? streakDays : 0))
  if (safe <= 0) return 0
  if (period === 'week') {
    return Math.min(safe, 7) * 5 + (safe >= 7 ? 20 : 0)
  }
  if (period === 'month') {
    return Math.min(safe, 30) * 5 + (safe >= 7 ? 20 : 0) + (safe >= 30 ? 50 : 0)
  }
  return Math.min(safe, 100) * 5 + (safe >= 7 ? 20 : 0) + (safe >= 30 ? 50 : 0) + (safe >= 100 ? 150 : 0)
}

/**
 * Legacy helper kept for backward compatibility.
 */
export function assignCenterPlaces<T extends { yearlyXp: number; name: string }>(rows: readonly T[]): Array<T & { place: number }> {
  const sorted = [...rows].sort((a, b) => b.yearlyXp - a.yearlyXp || a.name.localeCompare(b.name, 'vi'))
  const used = new Set<number>()
  const placed: Array<T & { place: number }> = []
  const take = (place: number, minXp: number) => {
    const index = sorted.findIndex((row, i) => !used.has(i) && row.yearlyXp >= minXp)
    if (index < 0) return
    used.add(index)
    placed.push({ ...sorted[index]!, place })
  }
  take(1, CENTER_TOP1_XP)
  take(2, CENTER_PODIUM_XP)
  take(3, CENTER_PODIUM_XP)
  let place = 4
  sorted.forEach((row, index) => {
    if (used.has(index)) return
    placed.push({ ...row, place })
    place += 1
  })
  return placed.sort((a, b) => a.place - b.place)
}

/**
 * Assigns leaderboard ranks where Top 1-3 require `minPodiumXp` (empty podium spots stay open; remaining students start at #4).
 */
export function assignPodiumPlaces<T extends { periodXp: number; name: string }>(
  rows: readonly T[],
  minPodiumXp: number,
): Array<T & { place: number }> {
  const sorted = [...rows].sort((a, b) => b.periodXp - a.periodXp || a.name.localeCompare(b.name, 'vi'))
  const used = new Set<number>()
  const placed: Array<T & { place: number }> = []
  for (const place of [1, 2, 3] as const) {
    const index = sorted.findIndex((row, i) => !used.has(i) && row.periodXp >= minPodiumXp)
    if (index < 0) continue
    used.add(index)
    placed.push({ ...sorted[index]!, place })
  }
  let place = 4
  sorted.forEach((row, index) => {
    if (used.has(index)) return
    placed.push({ ...row, place })
    place += 1
  })
  return placed.sort((a, b) => a.place - b.place)
}

type RankDef = { tier: string; division: string | null; color: string; ink: string }

const TIERS: Array<{ tier: string; divisions: string[]; color: string; ink: string }> = [
  { tier: 'Đồng', divisions: ['III', 'II', 'I'], color: '#C4843C', ink: '#4A2E12' },
  { tier: 'Bạc', divisions: ['III', 'II', 'I'], color: '#C5CDD6', ink: '#243040' },
  { tier: 'Vàng', divisions: ['III', 'II', 'I'], color: '#E8B931', ink: '#5C4308' },
  { tier: 'Bạch Kim', divisions: ['III', 'II', 'I'], color: '#7ED0D6', ink: '#0E3C42' },
  { tier: 'Kim Cương', divisions: ['III', 'II', 'I'], color: '#4C7FE5', ink: '#FFFFFF' },
  { tier: 'Tinh Anh', divisions: ['V', 'IV', 'III', 'II', 'I'], color: '#8B5CF6', ink: '#FFFFFF' },
  { tier: 'Cao Thủ', divisions: [], color: '#E11D48', ink: '#FFFFFF' },
  { tier: 'Thách Đấu', divisions: [], color: '#F5C451', ink: '#5C3B00' },
]

export const HONOR_RANKS: RankDef[] = TIERS.flatMap((tier): RankDef[] =>
  tier.divisions.length === 0
    ? [{ tier: tier.tier, division: null, color: tier.color, ink: tier.ink }]
    : tier.divisions.map((division) => ({ tier: tier.tier, division, color: tier.color, ink: tier.ink })),
)

/** Special marks for the first three places. Colors match those rank names. */
export const HONOR_PODIUM = [
  { place: 1, title: 'Thách Đấu', color: '#F5C451', ink: '#5C3B00' },
  { place: 2, title: 'Cao Thủ', color: '#E11D48', ink: '#FFFFFF' },
  { place: 3, title: 'Tinh Anh', color: '#8B5CF6', ink: '#FFFFFF' },
] as const

export type HonorRankDto = {
  tier: string
  division: string | null
  label: string
  color: string
  ink: string
  index: number
  /** EXP already earned inside this rank. Null on the final rank. */
  intoRank: number | null
  /** EXP still needed to reach the next rank. Null on the final rank. */
  toNext: number | null
}

export function rankFromXp(xp: number): HonorRankDto {
  const safe = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0))
  const index = Math.min(HONOR_RANKS.length - 1, Math.floor(safe / XP_PER_RANK))
  const def = HONOR_RANKS[index]!
  const last = index === HONOR_RANKS.length - 1
  const into = safe - index * XP_PER_RANK
  return {
    tier: def.tier,
    division: def.division,
    label: def.division ? `${def.tier} ${def.division}` : def.tier,
    color: def.color,
    ink: def.ink,
    index,
    intoRank: last ? null : into,
    toNext: last ? null : XP_PER_RANK - into,
  }
}

export type RewardTierConfig = {
  place: 1 | 2 | 3
  points: number
  frameId: (typeof AVATAR_FRAME_IDS)[number]
}

export type HonorRewardConfig = Record<HonorScope, Record<HonorPeriod, RewardTierConfig[]>>

export const DEFAULT_HONOR_REWARD_CONFIG: HonorRewardConfig = {
  class: {
    week: [
      { place: 1, points: 100, frameId: 'class-top1' },
      { place: 2, points: 60, frameId: 'class-top2' },
      { place: 3, points: 40, frameId: 'class-top3' },
    ],
    month: [
      { place: 1, points: 300, frameId: 'class-top1' },
      { place: 2, points: 200, frameId: 'class-top2' },
      { place: 3, points: 120, frameId: 'class-top3' },
    ],
    year: [
      { place: 1, points: 1000, frameId: 'class-top1' },
      { place: 2, points: 600, frameId: 'class-top2' },
      { place: 3, points: 400, frameId: 'class-top3' },
    ],
  },
  center: {
    week: [
      { place: 1, points: 250, frameId: 'center-top1' },
      { place: 2, points: 150, frameId: 'center-top2' },
      { place: 3, points: 100, frameId: 'center-top3' },
    ],
    month: [
      { place: 1, points: 800, frameId: 'center-top1' },
      { place: 2, points: 500, frameId: 'center-top2' },
      { place: 3, points: 300, frameId: 'center-top3' },
    ],
    year: [
      { place: 1, points: 2500, frameId: 'center-top1' },
      { place: 2, points: 1500, frameId: 'center-top2' },
      { place: 3, points: 1000, frameId: 'center-top3' },
    ],
  },
}

const tierConfigSchema = z.object({
  place: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  points: z.number().int().min(0).max(100_000),
  frameId: z.enum(AVATAR_FRAME_IDS),
})

const periodConfigSchema = z.array(tierConfigSchema).length(3)

export const honorRewardConfigSchema = z.object({
  class: z.object({ week: periodConfigSchema, month: periodConfigSchema, year: periodConfigSchema.optional() }),
  center: z.object({ week: periodConfigSchema, month: periodConfigSchema, year: periodConfigSchema.optional() }),
})

function cloneDefaultConfig(): HonorRewardConfig {
  return {
    class: {
      week: DEFAULT_HONOR_REWARD_CONFIG.class.week.map((t) => ({ ...t })),
      month: DEFAULT_HONOR_REWARD_CONFIG.class.month.map((t) => ({ ...t })),
      year: DEFAULT_HONOR_REWARD_CONFIG.class.year.map((t) => ({ ...t })),
    },
    center: {
      week: DEFAULT_HONOR_REWARD_CONFIG.center.week.map((t) => ({ ...t })),
      month: DEFAULT_HONOR_REWARD_CONFIG.center.month.map((t) => ({ ...t })),
      year: DEFAULT_HONOR_REWARD_CONFIG.center.year.map((t) => ({ ...t })),
    },
  }
}

/** Merges stored JSONB config safely with defaults so legacy null/partial (2-period) rows never break. */
export function normalizeHonorRewardConfig(raw: unknown): HonorRewardConfig {
  const parsed = honorRewardConfigSchema.safeParse(raw)
  if (!parsed.success) {
    return cloneDefaultConfig()
  }
  const sortTiers = (list: RewardTierConfig[]) => [1, 2, 3].map((p) => ({ ...(list.find((t) => t.place === p) ?? list[p - 1]!) }))
  return {
    class: {
      week: sortTiers(parsed.data.class.week),
      month: sortTiers(parsed.data.class.month),
      year: sortTiers(parsed.data.class.year ?? DEFAULT_HONOR_REWARD_CONFIG.class.year),
    },
    center: {
      week: sortTiers(parsed.data.center.week),
      month: sortTiers(parsed.data.center.month),
      year: sortTiers(parsed.data.center.year ?? DEFAULT_HONOR_REWARD_CONFIG.center.year),
    },
  }
}

export const adjustUserPointsSchema = z.object({
  userId: z.string().uuid(),
  delta: z.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, 'Số điểm thay đổi phải khác 0'),
  reason: z.string().trim().min(2, 'Nhập lý do tối thiểu 2 ký tự').max(200),
})
export type AdjustUserPointsInput = z.infer<typeof adjustUserPointsSchema>

export const earlySettleHonorSchema = z.object({
  scope: z.enum(HONOR_SCOPES),
  period: z.enum(HONOR_PERIODS),
  classId: z.string().uuid().optional(),
})
export type EarlySettleHonorInput = z.infer<typeof earlySettleHonorSchema>

export type HonorEntryDto = {
  place: number
  name: string
  avatarUrl: string | null
  avatarFrame: string
  className: string
  periodXp: number
  questionXp: number
  streakDays: number
  streakBonusXp: number
  lifetimeXp: number
  rank: HonorRankDto
  you: boolean
  yours: boolean
}

export type HonorScopedPeriodDto = {
  entries: HonorEntryDto[]
  you: HonorEntryDto | null
  rivals: HonorEntryDto[]
  participants: number
  minPodiumXp: number
  endsAt: string
}

export type HonorBoardDto = {
  enabled: boolean
  weekStart: string
  monthKey: string
  yearKey: string
  className: string | null
  me: {
    weeklyXp: number
    monthlyXp: number
    yearlyXp: number
    lifetimeXp: number
    streakDays: number
    rank: HonorRankDto
    rewardPoints: number
    avatarFrame: string
  }
  boards: {
    class: Record<HonorPeriod, HonorScopedPeriodDto>
    center: Record<HonorPeriod, HonorScopedPeriodDto>
  }
  rewardConfig: HonorRewardConfig
}

export type StaffClassBoardDto = {
  classId: string
  className: string
  boards: Record<HonorPeriod, { entries: HonorEntryDto[]; participants: number; endsAt: string }>
}

export type SettlementWinnerDto = {
  place: 1 | 2 | 3
  userId: string
  name: string
  periodXp: number
  points: number
  frameId: string
}

export type HonorSettlementDto = {
  id: string
  cycleKey: string
  scopeKey: string
  period: HonorPeriod
  classId: string | null
  className: string | null
  winners: SettlementWinnerDto[]
  triggeredBy: string | null
  settledAt: string
}

export type StaffHonorDto = {
  enabled: boolean
  weekStart: string
  monthKey: string
  yearKey: string
  classes: StaffClassBoardDto[]
  center: Record<HonorPeriod, { entries: HonorEntryDto[]; participants: number; minPodiumXp: number; endsAt: string }>
  rewardConfig: HonorRewardConfig
  settlements: HonorSettlementDto[]
}

export type UnlockedFrameDto = {
  frameId: string
  unlockedAt: string
  expiresAt: string | null
}

export type PointLedgerSource = 'AUTO_WEEK' | 'AUTO_MONTH' | 'AUTO_YEAR' | 'STREAK' | 'ADMIN'

export type PointLedgerEntryDto = {
  id: string
  delta: number
  reason: string
  source: PointLedgerSource
  createdAt: string
}

export type AccountRewardsDto = {
  rewardPoints: number
  avatarFrame: string
  unlockedFrames: UnlockedFrameDto[]
  ledger: PointLedgerEntryDto[]
}

export const createClassBodySchema = z.object({
  name: z.string().trim().min(2, 'Tên lớp quá ngắn').max(80),
})
export type CreateClassInput = z.infer<typeof createClassBodySchema>

export const renameClassSchema = z.object({
  name: z.string().trim().min(2, 'Tên lớp quá ngắn').max(80),
})
export type RenameClassInput = z.infer<typeof renameClassSchema>

export const assignClassSchema = z.object({
  userId: z.string().uuid(),
  classId: z.string().uuid(),
})
export type AssignClassInput = z.infer<typeof assignClassSchema>

export const setClassTeachersSchema = z.object({
  teacherIds: z.array(z.string().uuid()).max(50),
})
export type SetClassTeachersInput = z.infer<typeof setClassTeachersSchema>

export const setClassClosedSchema = z.object({
  closed: z.boolean(),
})
export type SetClassClosedInput = z.infer<typeof setClassClosedSchema>

export type ClassTeacherDto = {
  id: string
  fullName: string
  avatarUrl: string | null
  avatarFrame: string
}

export type ClassSummaryDto = {
  id: string
  name: string
  memberCount: number
  /** Set when an admin closed the class. Null while the class still accepts students. */
  closedAt: string | null
  teachers: ClassTeacherDto[]
}
