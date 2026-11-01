import { describe, expect, it } from 'vitest'
import { answerSheetScreens, listeningScreen } from './listening-screen'

const q = (partCode: string, groupId: string | null) => ({ partCode, groupId })

describe('listeningScreen', () => {
  it('keeps a Part 3 conversation on one screen from any question inside it', () => {
    const questions = [
      q('PART_2', null),
      q('PART_3', 'g1'),
      q('PART_3', 'g1'),
      q('PART_3', 'g1'),
      q('PART_3', 'g2'),
    ]
    expect(listeningScreen(questions, 2)).toEqual({ start: 1, end: 3 })
    expect(listeningScreen(questions, 4)).toEqual({ start: 4, end: 4 })
  })

  it('bundles an ungrouped Part 4 into threes and leaves other parts one question at a time', () => {
    const questions = [
      q('PART_4', null),
      q('PART_4', null),
      q('PART_4', null),
      q('PART_4', null),
      q('PART_5', null),
      q('PART_6', 'text'),
      q('PART_6', 'text'),
      q('PART_7', 'pass'),
      q('PART_7', 'pass'),
    ]
    expect(listeningScreen(questions, 1)).toEqual({ start: 0, end: 2 })
    expect(listeningScreen(questions, 3)).toEqual({ start: 3, end: 3 })
    expect(listeningScreen(questions, 4)).toEqual({ start: 4, end: 4 })
    expect(listeningScreen(questions, 6)).toEqual({ start: 6, end: 6 })
    expect(listeningScreen(questions, 8)).toEqual({ start: 8, end: 8 })
  })

  it('lists the answer sheet as one entry per Part 3 group and one entry per other question', () => {
    const questions = [
      q('PART_2', null),
      q('PART_3', 'g1'),
      q('PART_3', 'g1'),
      q('PART_3', 'g1'),
      q('PART_7', 'p'),
      q('PART_7', 'p'),
    ]
    expect(answerSheetScreens(questions)).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 3 },
      { start: 4, end: 4 },
      { start: 5, end: 5 },
    ])
  })
})
