import { PRACTICE_LISTENING_SCALE, PRACTICE_READING_SCALE, scaledSectionScore, summarizeScores } from './scoring'

describe('scoring', () => {
  it('fallback scale maps 0..100 raw to 5..495 in steps of 5', () => {
    expect(scaledSectionScore(0, 'LISTENING')).toBe(5)
    expect(scaledSectionScore(100, 'READING')).toBe(495)
    expect(scaledSectionScore(50, 'LISTENING')).toBe(250)
    expect(PRACTICE_LISTENING_SCALE).toHaveLength(101)
    expect(PRACTICE_READING_SCALE).toHaveLength(101)
    expect(scaledSectionScore(86, 'LISTENING')).toBe(475)
    expect(scaledSectionScore(46, 'READING')).toBe(190)
    for (let r = 0; r <= 100; r++) expect(scaledSectionScore(r, 'READING') % 5).toBe(0)
  })

  it('prefers the exam-specific conversion table', () => {
    const table = Array.from({ length: 101 }, (_, i) => 5 + i * 4) // deliberately different
    expect(scaledSectionScore(10, 'LISTENING', { listening: table, reading: [] })).toBe(45)
    // falls back when that section has no table entry
    expect(scaledSectionScore(100, 'READING', { listening: table, reading: [] })).toBe(495)
  })

  it('only scales full 100-question sections; total needs both', () => {
    const full = summarizeScores([
      { skill: 'LISTENING', scopeTotal: 100, examTotal: 100, correct: 90 },
      { skill: 'READING', scopeTotal: 100, examTotal: 100, correct: 80 },
    ])
    expect(full.listeningScore).toBe(scaledSectionScore(90, 'LISTENING'))
    expect(full.totalScore).toBe(full.listeningScore! + full.readingScore!)

    const drill = summarizeScores([{ skill: 'READING', scopeTotal: 30, examTotal: 100, correct: 25 }])
    expect(drill).toEqual({ listeningScore: null, readingScore: null, totalScore: null })

    const listeningOnly = summarizeScores([
      { skill: 'LISTENING', scopeTotal: 100, examTotal: 100, correct: 70 },
      { skill: 'READING', scopeTotal: 0, examTotal: 100, correct: 0 },
    ])
    expect(listeningOnly.listeningScore).not.toBeNull()
    expect(listeningOnly.readingScore).toBeNull()
    expect(listeningOnly.totalScore).toBeNull()
  })
})
