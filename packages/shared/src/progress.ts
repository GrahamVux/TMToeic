import { z } from 'zod'
import type { Skill } from './domain'

export const GOAL_TRACKS = ['TWO_SKILL', 'FOUR_SKILL'] as const
export type GoalTrack = (typeof GOAL_TRACKS)[number]

export const GOAL_TRACK_BOUNDS: Record<
  GoalTrack,
  { min: number; max: number; step: number; label: string; hint: string; defaultScore: number }
> = {
  TWO_SKILL: {
    min: 10,
    max: 990,
    step: 5,
    label: '2 kỹ năng',
    hint: 'Listening & Reading — thang TOEIC L&R (10–990)',
    defaultScore: 800,
  },
  FOUR_SKILL: {
    min: 10,
    max: 1390,
    step: 5,
    label: '4 kỹ năng',
    hint: 'Listening, Reading, Speaking & Writing — tổng 4 kỹ năng (10–1390)',
    defaultScore: 1000,
  },
}

export type GoalDto = { track: GoalTrack; score: number } | null

export function goalFromStored(track: string | null | undefined, score: number | null | undefined): GoalDto {
  if ((track === 'TWO_SKILL' || track === 'FOUR_SKILL') && score != null) return { track, score }
  if (score != null) return { track: 'TWO_SKILL', score }
  return null
}

export function formatGoal(goal: GoalDto): string | null {
  if (!goal) return null
  return `${goal.score} (${GOAL_TRACK_BOUNDS[goal.track].label})`
}

/** Distance to the target. Only 2-skill goals can be compared with an L&R 990-scale mock. */
export function remainingToGoal(goal: GoalDto, latestLrScore: number | null): number | null {
  if (!goal || latestLrScore == null || goal.track !== 'TWO_SKILL') return null
  return Math.max(0, goal.score - latestLrScore)
}

export const goalSchema = z
  .object({
    track: z.enum(GOAL_TRACKS),
    score: z.number().int(),
  })
  .superRefine((v, ctx) => {
    const b = GOAL_TRACK_BOUNDS[v.track]
    if (v.score < b.min || v.score > b.max) {
      ctx.addIssue({ code: 'custom', path: ['score'], message: `Điểm mục tiêu ${b.min}–${b.max}` })
    }
  })

/** null clears the goal. Exactly one track may be set at a time. */
export const setGoalSchema = z.object({
  goal: goalSchema.nullable(),
})
export type SetGoalInput = z.infer<typeof setGoalSchema>

export type ScorePointDto = { attemptId: string; at: string; totalScore: number; listeningScore: number | null; readingScore: number | null }

export type SkillStatDto = {
  skill: Skill
  attempts: number
  answered: number
  correct: number
  /** null until the student has answered something in a finished attempt. */
  accuracy: number | null
}

export type LeaderboardEntryDto = {
  rank: number
  /** Only the display name of classmates is shared. */
  name: string
  answered: number
  accuracy: number | null
  you: boolean
}

/** Everything the student home page shows — computed from real attempts; new accounts get zeros/nulls, never sample data. */
export type StudentDashboardDto = {
  targetScore: number | null
  goal: GoalDto
  attemptsFinished: number
  latestScore: ScorePointDto | null
  remainingToTarget: number | null
  /** Change between the first and the latest scored attempt (null with fewer than two). */
  improvement: number | null
  scoreHistory: ScorePointDto[]
  streak: { days: number; activeToday: boolean }
  weekStart: string
  leaderboard: { entries: LeaderboardEntryDto[]; you: LeaderboardEntryDto | null; participants: number }
  skills: SkillStatDto[]
}

// ------------------------------------------------------------------ progress analytics (student + teacher view)
export type PartStatDto = {
  partCode: string
  skill: Skill
  attempts: number
  answered: number
  correct: number
  /** correct / answered, in finished attempts only. null when nothing answered yet. */
  accuracy: number | null
  /** Average seconds spent per answered question (null if never recorded). */
  avgSeconds: number | null
}

export type AttemptSummaryDto = {
  attemptId: string
  examTitle: string
  mode: string
  status: string
  at: string
  correct: number
  total: number
  accuracy: number
  totalScore: number | null
  partCodes: string[]
  /** Set when this sitting was a homework assignment. */
  assignmentTitle: string | null
}

/** Below this many answered questions a part is "not enough data" — no weakness is declared from a handful of clicks. */
export const MIN_ANSWERS_FOR_INSIGHT = 10

export type StudentProgressDto = {
  targetScore: number | null
  goal: GoalDto
  latestScore: ScorePointDto | null
  remainingToTarget: number | null
  improvement: number | null
  scoreHistory: ScorePointDto[]
  parts: PartStatDto[]
  /** Lowest-accuracy part with enough answers; null if there is not enough data yet. */
  weakestPart: PartStatDto | null
  totals: { attemptsFinished: number; answered: number; correct: number; accuracy: number | null; avgSeconds: number | null }
  streak: { days: number; activeToday: boolean }
  lastActivityAt: string | null
  recentAttempts: AttemptSummaryDto[]
}

export type InactiveStudentDto = {
  id: string
  fullName: string
  studentCode: string | null
  lastActivityAt: string | null
  /** null = has logged in but never practised. */
  daysInactive: number | null
}

export const INACTIVE_AFTER_DAYS = 7

export type ClassReportDto = {
  students: { total: number; active: number; pendingFirstLogin: number }
  week: { start: string; activeStudents: number; attempts: number; answered: number }
  /** Correct / graded answers of all students over the last 30 days. */
  accuracy30d: number | null
  inactiveCount: number
  /** Active students who have logged in but not practised for INACTIVE_AFTER_DAYS (or ever). Capped list. */
  inactive: InactiveStudentDto[]
}
