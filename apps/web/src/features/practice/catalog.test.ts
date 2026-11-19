import { describe, expect, it } from 'vitest'
import { examKind, examSeries, matchesName } from './catalog'

describe('exam catalog filters', () => {
  it('treats a paper with both skills as a full test', () => {
    expect(examKind([{ skill: 'LISTENING' }, { skill: 'READING' }])).toBe('full')
    expect(examKind([{ skill: 'LISTENING' }])).toBe('listening')
  })

  it('reads the series and year from the title', () => {
    expect(examSeries({ code: 'YBM-2026-LC-TEST-03', title: 'YBM Listening Test 3' })).toEqual({ key: 'ybm-2026', label: 'YBM 2026' })
    expect(examSeries({ code: 'ETS-01', title: 'ETS TOEIC 2024 - Test 01' })).toEqual({ key: 'ets-2024', label: 'ETS 2024' })
  })

  it('matches a name without caring about accents', () => {
    expect(matchesName({ code: 'ETS-01', title: 'Đề thi thử ETS' }, 'de thi')).toBe(true)
    expect(matchesName({ code: 'ETS-01', title: 'Đề thi thử ETS' }, 'ybm')).toBe(false)
  })
})
