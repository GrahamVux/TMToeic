import { z } from 'zod'
import { countBlanks, type ExamPartDto } from './exam'
import { PART_CODE_PATTERN, type AssignmentLifecycle, type StudentAssignmentStatus } from './domain'

const partCode = z.string().regex(PART_CODE_PATTERN, 'Mã part không hợp lệ (VD: PART_5)')

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(3, 'Tiêu đề quá ngắn').max(200),
  description: z.string().trim().max(2000).optional(),
  examId: z.uuid(),
  partCodes: z.array(partCode).min(1, 'Chọn ít nhất một part').max(20),
  /** Sitting time once the student starts. */
  durationSeconds: z.number().int().min(60).max(4 * 3600),
  dueAt: z
    .string()
    .trim()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Ngày hạn không hợp lệ')
    .optional(),
  /** Empty / omitted = every active student. */
  studentIds: z.array(z.uuid()).max(500).optional(),
  publish: z.boolean().default(true),
})
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>

const fillItemSchema = z.object({
  /** Sentence or short text. Each blank is three or more underscores. */
  prompt: z.string().trim().min(1).max(2000),
  /** One string per blank, in order. Separate accepted alternatives with `|`. */
  answers: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  explanation: z.string().trim().max(4000).optional(),
})

/** A cloze homework set. It is assigned immediately and stays out of the exam bank until saved there. */
export const createFillAssignmentSchema = z
  .object({
    title: z.string().trim().min(3, 'Tiêu đề quá ngắn').max(200),
    description: z.string().trim().max(2000).optional(),
    durationSeconds: z.number().int().min(60).max(4 * 3600),
    dueAt: z
      .string()
      .trim()
      .refine((s) => !Number.isNaN(Date.parse(s)), 'Ngày hạn không hợp lệ')
      .optional(),
    studentIds: z.array(z.uuid()).max(500).optional(),
    publish: z.boolean().default(true),
    items: z.array(fillItemSchema).min(1, 'Thêm ít nhất một câu').max(40),
  })
  .superRefine((value, ctx) => {
    value.items.forEach((item, index) => {
      const blanks = countBlanks(item.prompt)
      if (blanks === 0) {
        ctx.addIssue({ code: 'custom', path: ['items', index, 'prompt'], message: 'Mỗi câu cần ít nhất một chỗ trống ___' })
      } else if (blanks !== item.answers.length) {
        ctx.addIssue({ code: 'custom', path: ['items', index, 'answers'], message: 'Số đáp án phải bằng số chỗ trống' })
      }
    })
  })
export type CreateFillAssignmentInput = z.infer<typeof createFillAssignmentSchema>

export type AssignmentProgressDto = {
  studentId: string
  fullName: string
  studentCode: string | null
  status: StudentAssignmentStatus
  attemptId: string | null
  answeredCount: number
  totalQuestions: number
  /** Null until the sitting is submitted or expired. */
  correctCount: number | null
  submittedAt: string | null
  totalScore: number | null
  /** Leaves recorded on a finished sitting. Null until the student submits. */
  focusLeaveCount: number | null
}

export type AssignmentDto = {
  id: string
  title: string
  description: string | null
  examId: string
  examTitle: string
  examCode: string
  partCodes: string[]
  parts: ExamPartDto[]
  durationSeconds: number
  dueAt: string | null
  status: AssignmentLifecycle
  publishedAt: string | null
  createdAt: string
  studentCount: number
  submittedCount: number
  /** True when this homework has its own listening file. */
  hasAudio: boolean
  /** Scanned exam pages attached to this homework. */
  imageCount: number
  /** True when every part of the source exam was assigned (a full paper, not a part drill). */
  wholeExam: boolean
  /** True when this homework is a fill-in-the-blank set. */
  fillBlank: boolean
  /** True when the underlying paper is published in the exam bank. */
  inBank: boolean
  /** Present on the student list / start payload. */
  myProgress?: {
    status: StudentAssignmentStatus
    attemptId: string | null
    answeredCount: number
    totalQuestions: number
  }
}

export type AssignmentDetailDto = AssignmentDto & {
  students: AssignmentProgressDto[]
}
