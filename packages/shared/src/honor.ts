import { z } from 'zod'

/** EXP from one finished piece of work, and the rank ladder that EXP climbs. */

export const XP_PER_RANK = 100
export const HONOR_BOARD_SIZE = 5

/** Percent correct, 0–100. A perfect completion is exactly one rank. */
export function xpForCompletion(correct: number, total: number): number {
  if (total <= 0 || correct <= 0) return 0
  return Math.round((Math.min(correct, total) / total) * 100)
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

export type HonorStudentEntry = {
  place: number
  name: string
  weeklyXp: number
  yearlyXp: number
  rank: HonorRankDto
  you: boolean
}

/** One student on the center-wide board, ranked by EXP since 1 January against students from every class. */
export type HonorCenterEntry = {
  place: number
  name: string
  className: string
  weeklyXp: number
  yearlyXp: number
  rank: HonorRankDto
  you: boolean
  /** True when this student sits in a class the viewer manages. */
  yours: boolean
}

export type HonorBoardDto = {
  enabled: boolean
  weekStart: string
  year: number
  className: string | null
  me: { weeklyXp: number; yearlyXp: number; rank: HonorRankDto }
  classBoard: { entries: HonorStudentEntry[]; you: HonorStudentEntry | null; participants: number }
  centerBoard: HonorCenterEntry[]
}

/** One class roster on the staff honor page. Student names stay inside this class. */
export type StaffClassBoardDto = {
  classId: string
  className: string
  entries: HonorStudentEntry[]
  participants: number
}

/** Teachers receive only the classes they manage. Admins receive every class. The center board ranks students from every class by this year's EXP. */
export type StaffHonorDto = {
  enabled: boolean
  weekStart: string
  year: number
  classes: StaffClassBoardDto[]
  centerBoard: HonorCenterEntry[]
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

export type ClassTeacherDto = {
  id: string
  fullName: string
}

export type ClassSummaryDto = {
  id: string
  name: string
  memberCount: number
  teachers: ClassTeacherDto[]
}
