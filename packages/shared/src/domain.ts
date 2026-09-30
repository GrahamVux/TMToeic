/**
 * Domain constants — single source of truth for web + api.
 * Skills/Parts are data, never hard-coded `if (skill === ...)` branches (backlog §5).
 */

export const ROLES = ['STUDENT', 'TEACHER', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]

export const SKILLS = ['LISTENING', 'READING', 'SPEAKING', 'WRITING'] as const
export type Skill = (typeof SKILLS)[number]

/** Skills enabled in the current MVP. Add 'SPEAKING' | 'WRITING' here (and in the DB `skills.enabled`) to enable later. */
export const ENABLED_SKILLS: readonly Skill[] = ['LISTENING', 'READING']

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const ASSIGNMENT_STATUSES = ['DUE_SOON', 'IN_PROGRESS', 'COMPLETED'] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]

export const RISK_LEVELS = ['NORMAL', 'NEEDS_ATTENTION', 'AT_RISK', 'EXCELLENT'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export const VOCAB_STATUSES = ['NEW', 'LEARNING', 'REVIEW', 'MASTERED'] as const
export type VocabStatus = (typeof VOCAB_STATUSES)[number]

export const EXAM_MODES = ['PRACTICE', 'TIMED', 'FULL_TEST', 'PART_DRILL', 'RANDOM'] as const
export type ExamMode = (typeof EXAM_MODES)[number]

/** Seed data for `skills` and `parts` tables. Part is an independent entity (backlog §5.2). */
export const SKILL_SEED: ReadonlyArray<{ code: Skill; name: string; displayOrder: number }> = [
  { code: 'LISTENING', name: 'Listening', displayOrder: 1 },
  { code: 'READING', name: 'Reading', displayOrder: 2 },
  { code: 'SPEAKING', name: 'Speaking', displayOrder: 3 },
  { code: 'WRITING', name: 'Writing', displayOrder: 4 },
]

export const PART_SEED: ReadonlyArray<{ skill: Skill; code: string; name: string; description: string; displayOrder: number }> = [
  { skill: 'LISTENING', code: 'PART_1', name: 'Part 1 — Photographs', description: 'Mô tả tranh', displayOrder: 1 },
  { skill: 'LISTENING', code: 'PART_2', name: 'Part 2 — Question-Response', description: 'Hỏi – đáp', displayOrder: 2 },
  { skill: 'LISTENING', code: 'PART_3', name: 'Part 3 — Conversations', description: 'Hội thoại ngắn', displayOrder: 3 },
  { skill: 'LISTENING', code: 'PART_4', name: 'Part 4 — Talks', description: 'Bài nói chuyện ngắn', displayOrder: 4 },
  { skill: 'READING', code: 'PART_5', name: 'Part 5 — Incomplete Sentences', description: 'Hoàn thành câu', displayOrder: 5 },
  { skill: 'READING', code: 'PART_6', name: 'Part 6 — Text Completion', description: 'Điền đoạn văn', displayOrder: 6 },
  { skill: 'READING', code: 'PART_7', name: 'Part 7 — Reading Comprehension', description: 'Đọc hiểu', displayOrder: 7 },
]
