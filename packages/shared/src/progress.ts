import { z } from 'zod'
import type { Skill } from './domain'

/** TOEIC L&R scores move in steps of 5; null clears the goal. */
export const setGoalSchema = z.object({
  targetScore: z.number().int().min(10).max(990).multipleOf(5, 'Điểm mục tiêu phải là bội số của 5').nullable(),
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
}

/** Below this many answered questions a part is "not enough data" — no weakness is declared from a handful of clicks. */
export const MIN_ANSWERS_FOR_INSIGHT = 10

export type StudentProgressDto = {
  targetScore: number | null
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
