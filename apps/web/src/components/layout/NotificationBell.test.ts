import type { AssignmentDto, StudyOverviewDto } from '@toeic/shared'
import { describe, expect, it } from 'vitest'
import { remindersOf } from './NotificationBell'

const now = Date.parse('2026-10-24T12:00:00Z')

function assignment(patch: Partial<AssignmentDto>): AssignmentDto {
  return {
    id: 'a',
    title: 'Bài Part 5',
    description: null,
    examId: 'e',
    examTitle: 'Đề',
    examCode: 'E',
    partCodes: ['PART_5'],
    parts: [],
    durationSeconds: 600,
    dueAt: null,
    status: 'PUBLISHED',
    publishedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    studentCount: 1,
    submittedCount: 0,
    hasAudio: false,
    imageCount: 0,
    wholeExam: false,
    fillBlank: false,
    inBank: true,
    myProgress: { status: 'ASSIGNED', attemptId: null, answeredCount: 0, totalQuestions: 10 },
    ...patch,
  }
}

const study = (patch: Partial<StudyOverviewDto> = {}): StudyOverviewDto => ({
  vocabTotal: 0,
  catalogDue: 0,
  catalogNew: 10,
  notebookTotal: 0,
  notebookDue: 0,
  notebookMissingMeaning: 0,
  grammarTotal: 0,
  grammarCompleted: 0,
  ...patch,
})

describe('remindersOf', () => {
  it('keeps the bell quiet when nothing is due', () => {
    const later = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(remindersOf([assignment({ dueAt: later })], study(), now)).toEqual([])
  })

  it('lists overdue work, work due within a day, an unfinished sitting, and due cards', () => {
    const soon = new Date(now + 2 * 60 * 60 * 1000).toISOString()
    const items = remindersOf(
      [
        assignment({ id: 'late', title: 'Quá hạn', myProgress: { status: 'OVERDUE', attemptId: null, answeredCount: 0, totalQuestions: 5 } }),
        assignment({ id: 'soon', title: 'Sắp hạn', dueAt: soon }),
        assignment({ id: 'open', title: 'Đang làm', myProgress: { status: 'IN_PROGRESS', attemptId: 'x', answeredCount: 1, totalQuestions: 5 } }),
        assignment({ id: 'done', title: 'Đã nộp', myProgress: { status: 'COMPLETED', attemptId: 'y', answeredCount: 5, totalQuestions: 5 } }),
      ],
      study({ catalogDue: 3, notebookDue: 1 }),
      now,
    )
    expect(items.map((item) => item.title)).toEqual(['Quá hạn', 'Sắp hạn', 'Đang làm', 'Ôn từ vựng', 'Sổ tay từ vựng'])
    expect(items.filter((item) => item.urgent).map((item) => item.id)).toEqual(['asg-late', 'asg-soon'])
  })

  it('hides a kind the student turned off', () => {
    const soon = new Date(now + 2 * 60 * 60 * 1000).toISOString()
    const items = remindersOf(
      [
        assignment({ id: 'late', title: 'Quá hạn', myProgress: { status: 'OVERDUE', attemptId: null, answeredCount: 0, totalQuestions: 5 } }),
        assignment({ id: 'soon', title: 'Sắp hạn', dueAt: soon, myProgress: { status: 'IN_PROGRESS', attemptId: 'x', answeredCount: 1, totalQuestions: 5 } }),
        assignment({ id: 'open', title: 'Đang làm', myProgress: { status: 'IN_PROGRESS', attemptId: 'z', answeredCount: 1, totalQuestions: 5 } }),
      ],
      study({ catalogDue: 3, notebookDue: 1 }),
      now,
      { overdue: false, dueSoon: false, inProgress: true, vocab: false },
    )
    expect(items.map((item) => item.title)).toEqual(['Sắp hạn', 'Đang làm'])
    expect(items[0]?.body).toBe('Bài đang làm dở')
  })
})
