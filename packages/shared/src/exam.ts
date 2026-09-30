import { z } from 'zod'
import type { ExamMode, Skill } from './domain'

export const EXAM_STATUSES = ['DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED', 'REJECTED'] as const
export type ExamStatus = (typeof EXAM_STATUSES)[number]

export const ATTEMPT_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED'] as const
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number]

export const ASSET_PROVIDERS = ['CLOUDFLARE_R2', 'GOOGLE_DRIVE'] as const
export type AssetProvider = (typeof ASSET_PROVIDERS)[number]

/** Modes a student can start today. RANDOM needs the question bank (later). */
export const STARTABLE_MODES = ['PRACTICE', 'TIMED', 'FULL_TEST', 'PART_DRILL'] as const satisfies readonly ExamMode[]
export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

// ------------------------------------------------------------------ teacher: exam definition
const partCode = z.string().regex(/^PART_\d+$/, 'Mã part không hợp lệ (VD: PART_5)')

export const createExamSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, 'Chỉ dùng chữ, số, . _ -'),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(100).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  durationSeconds: z.number().int().min(60).max(4 * 3600),
  /** Which Parts this exam contains and their question-number ranges (Part is data, not hard-coded). */
  parts: z
    .array(
      z
        .object({ partCode, questionStart: z.number().int().min(1), questionEnd: z.number().int().min(1) })
        .refine((p) => p.questionEnd >= p.questionStart, 'Số câu kết thúc phải ≥ số câu bắt đầu'),
    )
    .min(1)
    .max(20),
})
export type CreateExamInput = z.infer<typeof createExamSchema>

const optionInput = z.object({
  key: z.enum(OPTION_KEYS),
  text: z.string().trim().max(2000).default(''),
  correct: z.boolean().default(false),
})

const passageInput = z.object({
  label: z.string().trim().min(1).max(4),
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1).max(20000),
})

/** A group = shared stimulus: Part 3/4 conversation, Part 6 text, Part 7 single/double/triple passage. */
const groupInput = z.object({
  key: z.string().trim().min(1).max(40),
  partCode,
  instructions: z.string().trim().max(1000).optional(),
  passages: z.array(passageInput).max(5).default([]),
  /** Shared figure (chart/table/map) for the whole group. Must be an image asset. */
  imageAssetId: z.uuid().optional(),
})

const questionInput = z.object({
  partCode,
  number: z.number().int().min(1).max(200),
  groupKey: z.string().trim().min(1).max(40).optional(),
  type: z.string().trim().max(40).optional(),
  prompt: z.string().trim().max(5000).default(''),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  /** Picture for this question (Part 1 photograph). Must be an image asset. */
  imageAssetId: z.uuid().optional(),
  options: z.array(optionInput).min(2).max(4),
})

/** Replace-all content of a DRAFT exam (questions + groups + answer key). */
export const replaceExamContentSchema = z.object({
  groups: z.array(groupInput).max(100).default([]),
  questions: z.array(questionInput).min(1).max(200),
})
export type ReplaceExamContentInput = z.infer<typeof replaceExamContentSchema>

const importAssetInput = z.object({
  objectKey: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().nonnegative().optional(),
  checksum: z.string().trim().max(128).optional(),
  originalFilename: z.string().trim().max(260).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/** Staff: create/update a Listening exam from an importer draft, registering R2 objects already uploaded. */
export const importListeningDraftSchema = z.object({
  exam: createExamSchema,
  assets: z.array(importAssetInput).max(200).default([]),
  groups: z
    .array(groupInput.omit({ imageAssetId: true }).extend({ imageObjectKey: z.string().trim().min(1).max(500).optional() }))
    .max(100)
    .default([]),
  questions: z
    .array(questionInput.omit({ imageAssetId: true }).extend({ imageObjectKey: z.string().trim().min(1).max(500).optional() }))
    .min(1)
    .max(200),
  audioObjectKey: z.string().trim().min(1).max(500).optional(),
})
export type ImportListeningDraftInput = z.infer<typeof importListeningDraftSchema>

// ------------------------------------------------------------------ student: attempts
export const startAttemptSchema = z
  .object({
    mode: z.enum(STARTABLE_MODES).default('PRACTICE'),
    /** Required for PART_DRILL, optional scope for PRACTICE/TIMED. */
    partCodes: z.array(partCode).max(20).optional(),
  })
  .refine((v) => v.mode !== 'PART_DRILL' || (v.partCodes && v.partCodes.length > 0), {
    path: ['partCodes'],
    message: 'Chọn ít nhất một part để luyện',
  })
export type StartAttemptInput = z.infer<typeof startAttemptSchema>

export const saveAnswerSchema = z.object({
  /** `null` clears the answer. */
  selectedKey: z.enum(OPTION_KEYS).nullable(),
  timeSpentSeconds: z.number().int().min(0).max(3600).optional(),
})
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>

/** Attach (or detach with `assetId: null`) a Listening recording. Without `partCode` it is the full-length audio of the exam. */
export const setExamAudioSchema = z.object({
  assetId: z.uuid().nullable(),
  partCode: z.string().trim().min(1).max(32).optional(),
})
export type SetExamAudioInput = z.infer<typeof setExamAudioSchema>

export const listExamsQuerySchema = z.object({
  status: z.enum(EXAM_STATUSES).optional(),
  q: z.string().trim().max(64).optional(),
})

// ------------------------------------------------------------------ DTOs
export type ExamPartDto = { code: string; name: string; skill: Skill; questionStart: number; questionEnd: number; questionCount: number }

export type ExamSummaryDto = {
  id: string
  code: string
  title: string
  description: string | null
  status: ExamStatus
  difficulty: string
  durationSeconds: number
  totalQuestions: number
  parts: ExamPartDto[]
  /** True when any Listening audio is attached (full-length or per part). */
  hasAudio: boolean
  publishedAt: string | null
}

/**
 * One playable recording. `url` is a short-lived signed URL (never stored); `partCodes` are the parts it covers
 * (a full-length recording covers every Listening part of the attempt).
 */
export type AudioTrackDto = { id: string; label: string; partCodes: string[]; url: string; expiresAt: string }
export type AttemptAudioDto = { audio: AudioTrackDto[] }

export type PassageDto = { label: string; title: string | null; content: string }
/** `imageUrl` is a short-lived signed URL (null when there is no figure or storage is not configured). */
export type GroupDto = { id: string; partCode: string; instructions: string | null; passages: PassageDto[]; imageUrl: string | null }

export type PlayerQuestionDto = {
  id: string
  number: number
  partCode: string
  groupId: string | null
  type: string | null
  prompt: string
  /** Signed URL of the question's picture (Part 1), or null. */
  imageUrl: string | null
  options: Array<{ key: string; text: string }>
  /** The student's saved answer (autosave / resume). */
  selectedKey: string | null
}

export type AttemptDto = {
  id: string
  examId: string
  examTitle: string
  mode: ExamMode
  status: AttemptStatus
  startedAt: string
  submittedAt: string | null
  /** ISO time when the attempt auto-submits; null = untimed. */
  deadlineAt: string | null
  remainingSeconds: number | null
  partCodes: string[]
  totalQuestions: number
  answeredCount: number
}

/** Returned while IN_PROGRESS — never contains the answer key. */
export type AttemptPlayerDto = {
  attempt: AttemptDto
  groups: GroupDto[]
  questions: PlayerQuestionDto[]
  audio: AudioTrackDto[]
}

export type PartResultDto = { partCode: string; skill: Skill; total: number; correct: number; accuracy: number }

export type AttemptResultDto = {
  attempt: AttemptDto
  totalScore: number | null
  listeningScore: number | null
  readingScore: number | null
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  durationSeconds: number
  parts: PartResultDto[]
}

export type ReviewQuestionDto = PlayerQuestionDto & { correctKey: string; isCorrect: boolean | null }
export type AttemptReviewDto = { result: AttemptResultDto; groups: GroupDto[]; questions: ReviewQuestionDto[]; audio: AudioTrackDto[] }