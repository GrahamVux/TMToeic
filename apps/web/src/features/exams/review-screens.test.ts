import { describe, expect, it } from 'vitest'
import { reviewScreens } from './ReviewQuestions'

describe('reviewScreens', () => {
  it('keeps standalone Part 5 items 1 per screen and groups consecutive Part 6/7 items with the same non-null groupId', () => {
    const items = [
      { partCode: 'PART_5', groupId: null },
      { partCode: 'PART_5', groupId: null },
      { partCode: 'PART_6', groupId: 'g1' },
      { partCode: 'PART_6', groupId: 'g1' },
      { partCode: 'PART_6', groupId: 'g1' },
      { partCode: 'PART_6', groupId: 'g1' },
      { partCode: 'PART_7', groupId: 'g2' },
      { partCode: 'PART_7', groupId: 'g2' },
    ]
    expect(reviewScreens(items)).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 1 },
      { start: 2, end: 5 },
      { start: 6, end: 7 },
    ])
  })

  it('delegates Part 3 and Part 4 to listeningScreen so 3-question audio groups stay together', () => {
    const items = [
      { partCode: 'PART_1', groupId: null },
      { partCode: 'PART_3', groupId: 'g3' },
      { partCode: 'PART_3', groupId: 'g3' },
      { partCode: 'PART_3', groupId: 'g3' },
      { partCode: 'PART_4', groupId: null },
      { partCode: 'PART_4', groupId: null },
      { partCode: 'PART_4', groupId: null },
    ]
    expect(reviewScreens(items)).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 3 },
      { start: 4, end: 6 },
    ])
  })

  it('returns an empty list when given zero questions', () => {
    expect(reviewScreens([])).toEqual([])
  })
})
