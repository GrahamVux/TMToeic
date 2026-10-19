import type { Skill } from '@toeic/shared'

/** TOEIC scaled score per section is only meaningful for a full section of 100 questions. */
export const FULL_SECTION_QUESTIONS = 100

export type ScoringConfig = { listening: number[]; reading: number[] } | null | undefined

/**
 * Practice conversion used by the center (raw correct 0..100 → scaled 5..495).
 * An exam can still override this with `exams.scoring_config`.
 */
export const PRACTICE_LISTENING_SCALE = [
  5, 5, 5, 5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 115, 120, 125, 130, 135, 140, 145, 150, 160,
  165, 170, 175, 180, 185, 190, 195, 200, 210, 215, 220, 230, 240, 245, 250, 255, 260, 270, 275, 280, 290, 295, 300, 310, 315, 320, 325, 330, 340, 345,
  350, 360, 365, 370, 380, 385, 390, 395, 400, 405, 410, 420, 425, 430, 440, 445, 450, 460, 465, 470, 475, 480, 485, 490, 495, 495, 495, 495, 495, 495,
  495, 495, 495, 495, 495,
] as const

export const PRACTICE_READING_SCALE = [
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 65, 70, 80, 85, 90, 95, 100, 110, 115, 120, 125, 130, 140, 145,
  150, 160, 165, 170, 175, 180, 190, 195, 200, 210, 215, 220, 225, 230, 235, 240, 250, 255, 260, 265, 270, 280, 285, 290, 300, 305, 310, 320, 325, 330,
  335, 340, 350, 355, 360, 365, 370, 380, 385, 390, 395, 400, 405, 410, 415, 420, 425, 430, 435, 445, 450, 455, 465, 470, 480, 485, 490, 495, 495, 495,
  495,
] as const

/**
 * Raw-correct (0..100) → scaled 5..495.
 * Uses the exam's own conversion table when configured (forms differ).
 * Otherwise uses the center's practice table.
 */
export function scaledSectionScore(raw: number, skill: 'LISTENING' | 'READING', config?: ScoringConfig): number {
  const table = skill === 'LISTENING' ? config?.listening : config?.reading
  if (table && Number.isInteger(table[raw])) return table[raw]
  const fallback = skill === 'LISTENING' ? PRACTICE_LISTENING_SCALE[raw] : PRACTICE_READING_SCALE[raw]
  if (Number.isInteger(fallback)) return fallback
  return Math.max(5, Math.round((raw * 4.95) / 5) * 5)
}

export type SkillTally = { skill: Skill; scopeTotal: number; examTotal: number; correct: number }

export type ScoreSummary = {
  listeningScore: number | null
  readingScore: number | null
  totalScore: number | null
}

/**
 * Scaled scores are produced only when the attempt covers the WHOLE section (100 questions).
 * Part drills / partial practice report accuracy only (no misleading 990-scale score).
 */
export function summarizeScores(tallies: SkillTally[], config?: ScoringConfig): ScoreSummary {
  const section = (skill: 'LISTENING' | 'READING') => {
    const t = tallies.find((x) => x.skill === skill)
    if (!t || t.scopeTotal !== t.examTotal || t.scopeTotal !== FULL_SECTION_QUESTIONS) return null
    return scaledSectionScore(t.correct, skill, config)
  }
  const listeningScore = section('LISTENING')
  const readingScore = section('READING')
  return {
    listeningScore,
    readingScore,
    totalScore: listeningScore !== null && readingScore !== null ? listeningScore + readingScore : null,
  }
}
