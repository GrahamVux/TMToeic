import { z } from 'zod'

/** EXP from the first time a sentence pattern is answered correctly, and the rank ladder that EXP climbs. */

export const XP_PER_CORRECT = 1
export const XP_PER_RANK = 300
/** Yearly EXP required before a student can hold 1st place on the center board. */
export const CENTER_TOP1_XP = 2000
/** Yearly EXP required before a student can hold 2nd or 3rd place on the center board. */
export const CENTER_PODIUM_XP = 1500
export const HONOR_BOARD_SIZE = 5

/** EXP for a set of sentence patterns that were correct for the first time. */
export function xpForCorrect(correct: number): number {
  return Math.max(0, Math.floor(correct)) * XP_PER_CORRECT
}

/**
 * Center-board places. 1st place needs CENTER_TOP1_XP. 2nd and 3rd need CENTER_PODIUM_XP.
 * Later places are open at any EXP. Empty podium slots stay empty, so the next place number can skip ahead.
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
  avatarUrl: string | null
  weeklyXp: number
  yearlyXp: number
  rank: HonorRankDto
  you: boolean
}

/** One student on the center-wide board, ranked by EXP since 1 January against students from every class. */
export type HonorCenterEntry = {
  place: number
  name: string
  avatarUrl: string | null
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
  classBoard: { entries: HonorStudentEntry[]; you: HonorStudentEntry | null; participants: number; resetAt: string | null }
  centerBoard: HonorCenterEntry[]
}

/** One class roster on the staff honor page. Student names stay inside this class. */
export type StaffClassBoardDto = {
  classId: string
  className: string
  entries: HonorStudentEntry[]
  participants: number
  /** ISO time of the last admin reset. Null means the board still starts on 1 January. */
  resetAt: string | null
}

/** Teachers receive only the classes they manage. Admins receive every class. Every board ranks by this year's EXP. An admin can restart one class board. */
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

export const setClassClosedSchema = z.object({
  closed: z.boolean(),
})
export type SetClassClosedInput = z.infer<typeof setClassClosedSchema>

export type ClassTeacherDto = {
  id: string
  fullName: string
  avatarUrl: string | null
}

export type ClassSummaryDto = {
  id: string
  name: string
  memberCount: number
  /** Set when an admin closed the class. Null while the class still accepts students. */
  closedAt: string | null
  teachers: ClassTeacherDto[]
}
