import type { Skill } from '@toeic/shared'

/** TOEIC scaled score per section is only meaningful for a full section of 100 questions. */
export const FULL_SECTION_QUESTIONS = 100

export type ScoringConfig = { listening: number[]; reading: number[] } | null | undefined

/**
 * Raw-correct (0..100) → scaled 5..495.
 * Uses the exam's own conversion table when configured (ETS tables differ per test form).
 * Fallback is a linear APPROXIMATION rounded to 5 — NOT the official ETS table; configure `exams.scoring_config` for real tables.
 */
export function scaledSectionScore(raw: number, skill: 'LISTENING' | 'READING', config?: ScoringConfig): number {
  const table = skill === 'LISTENING' ? config?.listening : config?.reading
  if (table && Number.isInteger(table[raw])) return table[raw]
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
