import { z } from 'zod'
import type { ExamPartDto } from './exam'
import type { AssignmentLifecycle, StudentAssignmentStatus } from './domain'

const partCode = z.string().regex(/^PART_\d+$/, 'Mã part không hợp lệ (VD: PART_5)')

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
