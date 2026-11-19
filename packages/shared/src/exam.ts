import { z } from 'zod'
import { PART_CODE_PATTERN, type ExamMode, type Skill } from './domain'

/** A full Listening paper contains every listening part. */
export const FULL_LISTENING_PARTS = ['PART_1', 'PART_2', 'PART_3', 'PART_4'] as const
/** A full Reading paper contains every reading part. */
export const FULL_READING_PARTS = ['PART_5', 'PART_6', 'PART_7'] as const

export function isFullSkillExam(parts: ReadonlyArray<{ code: string; skill: string }>, skill: 'LISTENING' | 'READING'): boolean {
  const required = skill === 'LISTENING' ? FULL_LISTENING_PARTS : FULL_READING_PARTS
  const codes = new Set(parts.map((part) => part.code))
  const skills = new Set(parts.map((part) => part.skill))
  return skills.size === 1 && skills.has(skill) && required.every((code) => codes.has(code))
}

export const EXAM_STATUSES = ['DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED', 'REJECTED'] as const
export type ExamStatus = (typeof EXAM_STATUSES)[number]

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  DRAFT: 'Bản nháp',
  PROCESSING: 'Đang xử lý',
  PENDING_REVIEW: 'Chờ duyệt',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Đã lưu trữ',
  REJECTED: 'Từ chối',
}

export const ATTEMPT_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED'] as const
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number]

export const ASSET_PROVIDERS = ['CLOUDFLARE_R2', 'GOOGLE_DRIVE'] as const
export type AssetProvider = (typeof ASSET_PROVIDERS)[number]

/**
 * An uploaded file is recorded in the database first (PENDING), then its bytes are pushed to object storage.
 * Only a STORED file can be attached or served. FAILED keeps the reason the push did not finish.
 */
export const ASSET_STATUSES = ['PENDING', 'STORED', 'FAILED'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

/** Modes a student can start today. RANDOM needs the question bank (later). */
export const STARTABLE_MODES = ['PRACTICE', 'TIMED', 'FULL_TEST', 'PART_DRILL'] as const satisfies readonly ExamMode[]
export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

// ------------------------------------------------------------------ teacher: exam definition
const partCode = z.string().regex(PART_CODE_PATTERN, 'Mã part không hợp lệ (VD: PART_5)')

/** Cloze homework. Three or more underscores in the prompt are one blank. */
export const FILL_PART_CODE = 'FILL_1'
export const FILL_QUESTION_TYPE = 'FILL_BLANK'
export const FILL_EXAM_SOURCE = 'fill-blank'
const BLANK_PATTERN = /_{3,}/g

export function countBlanks(prompt: string): number {
  return prompt.match(BLANK_PATTERN)?.length ?? 0
}

/** Case and surrounding punctuation do not change a cloze answer. Alternatives are already split. */
export function normalizeFillAnswer(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.。,!?;:'"]+$/g, '')
}

export function fillAnswerMatches(given: string, accepted: readonly string[]): boolean {
  const normalized = normalizeFillAnswer(given)
  if (!normalized) return false
  return accepted.some((answer) => normalizeFillAnswer(answer) === normalized)
}

export function splitFillAlternatives(raw: string): string[] {
  return [...new Set(raw.split('|').map((part) => part.trim()).filter(Boolean))]
}

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
  /** Shown only after the sitting is submitted. */
  explanation: z.string().trim().max(4000).optional(),
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

/** Staff: import a self-authored exam (no R2 assets) into the bank. Parts become selectable homework groups. */
export const importAuthoredExamSchema = createExamSchema.extend({
  groups: z.array(groupInput).max(100).default([]),
  questions: z.array(questionInput).min(1).max(200),
  publish: z.boolean().default(true),
})
export type ImportAuthoredExamInput = z.infer<typeof importAuthoredExamSchema>

const scanBox = z.tuple([z.number(), z.number(), z.number(), z.number()])

/** JSON Gemini returns for one Listening booklet. The PDF is uploaded beside it; boxes are cut from that PDF. */
export const listeningScanSchema = z.object({
  sourceFile: z.string().trim().max(200).optional(),
  testNo: z.number().int().min(1).max(99).optional(),
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, 'Chỉ dùng chữ, số, . _ -'),
  title: z.string().trim().min(3).max(200),
  durationSeconds: z.number().int().min(60).max(4 * 3600).default(45 * 60),
  continued: z.boolean().optional(),
  nextNumber: z.number().int().nullable().optional(),
  pages: z
    .array(
      z.object({
        page: z.number().int().min(1).max(80),
        role: z.enum(['skip', 'part1-photos', 'part3-4']).optional(),
        rotationDegrees: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
      }),
    )
    .max(80)
    .default([]),
  groups: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        partCode: z.enum(['PART_3', 'PART_4']),
        instructions: z.string().trim().max(1000).optional(),
        imageFile: z.string().trim().min(1).max(80).nullable().optional(),
      }),
    )
    .max(40)
    .default([]),
  questions: z
    .array(
      z.object({
        number: z.number().int().min(1).max(100),
        partCode: z.enum(['PART_1', 'PART_2', 'PART_3', 'PART_4']),
        prompt: z.string().trim().max(5000).default(''),
        groupKey: z.string().trim().min(1).max(40).optional(),
        imageFile: z.string().trim().min(1).max(80).optional(),
        answer: z.enum(['A', 'B', 'C', 'D']).nullable().optional(),
        options: z
          .array(
            z.object({
              key: z.enum(OPTION_KEYS),
              text: z.string().trim().max(2000).default(''),
            }),
          )
          .min(2)
          .max(4),
      }),
    )
    .min(1)
    .max(100),
  crops: z
    .array(
      z.object({
        file: z.string().trim().min(1).max(80),
        page: z.number().int().min(1).max(80),
        kind: z.enum(['photo', 'graphic']).optional(),
        /** Set when an editor dragged this box. The server then cuts that box instead of guessing the photograph. */
        manual: z.boolean().optional(),
        questionNumbers: z.array(z.number().int()).max(10).optional(),
        box: scanBox,
      }),
    )
    .max(40)
    .default([]),
  warnings: z.array(z.string().max(300)).max(200).optional(),
})
export type ListeningScanInput = z.infer<typeof listeningScanSchema>

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

export const saveAnswerSchema = z
  .object({
    /** Multiple choice. `null` clears the answer. */
    selectedKey: z.enum(OPTION_KEYS).nullable().optional(),
    /** Fill-in-the-blank. `null` or blank clears the answer. */
    answerText: z.string().max(120).nullable().optional(),
    timeSpentSeconds: z.number().int().min(0).max(3600).optional(),
  })
  .refine((v) => v.selectedKey !== undefined || v.answerText !== undefined, { message: 'Thiếu câu trả lời' })
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>

/** Absences shorter than this are a flicker (a click on the browser chrome) and are dropped. */
export const FOCUS_MIN_AWAY_SECONDS = 1

/** Timed sittings and homework. Free practice is not watched. */
export function isFocusWatched(attempt: { mode: string; assignmentId: string | null }): boolean {
  return attempt.assignmentId != null || attempt.mode === 'TIMED' || attempt.mode === 'FULL_TEST'
}

export const recordFocusSchema = z.object({
  state: z.enum(['away', 'back']),
})
export type RecordFocusInput = z.infer<typeof recordFocusSchema>
export type RecordFocusResult = { recorded: boolean }

/** Attach (or detach with `assetId: null`) a Listening recording. Without `partCode` it is the full-length audio of the exam. */
export const setExamAudioSchema = z.object({
  assetId: z.uuid().nullable(),
  partCode: z.string().trim().min(1).max(32).optional(),
})
export type SetExamAudioInput = z.infer<typeof setExamAudioSchema>

/** Combine one full Listening exam with one full Reading exam. `random` picks a pair that does not exist yet. */
export const createExamBundleSchema = z
  .object({
    listeningExamId: z.uuid().optional(),
    readingExamId: z.uuid().optional(),
    random: z.boolean().optional(),
  })
  .refine((value) => value.random === true || (Boolean(value.listeningExamId) && Boolean(value.readingExamId)), {
    message: 'Chọn một đề Listening và một đề Reading, hoặc tạo nhanh.',
  })
export type CreateExamBundleInput = z.infer<typeof createExamBundleSchema>

export type ExamBundleDto = {
  id: string
  examId: string
  code: string
  title: string
  status: ExamStatus
  listeningExamId: string
  readingExamId: string
  listeningCode: string
  listeningTitle: string
  readingCode: string
  readingTitle: string
  createdAt: string
}

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
  /** The student's saved choice (autosave / resume). Null on a fill-in blank. */
  selectedKey: string | null
  /** Typed cloze answer. Null on a multiple-choice question. */
  answerText: string | null
  /** Which `___` in `prompt` this question is, starting at 0. Null on multiple choice. */
  blankIndex: number | null
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
  assignmentId: string | null
  /** True on timed tests and homework. The player records leaving the tab only when this is set. */
  focusWatch: boolean
}

/** Returned while IN_PROGRESS — never contains the answer key. */
export type AttemptPlayerDto = {
  attempt: AttemptDto
  groups: GroupDto[]
  questions: PlayerQuestionDto[]
  audio: AudioTrackDto[]
  /** Scanned exam pages attached to the homework. Empty when the attempt is not an assignment, or none were uploaded. */
  sheetImages: SheetImageDto[]
}

export type PartResultDto = { partCode: string; skill: Skill; total: number; correct: number; accuracy: number }

export type FocusLeaveDto = {
  leftAt: string
  returnedAt: string | null
  awaySeconds: number
}

/**
 * Present on timed tests and homework after the sitting is finished.
 * `leaveCount` 0 means the student was watched and did not leave.
 */
export type FocusReportDto = {
  leaveCount: number
  awaySeconds: number
  longestAwaySeconds: number
  leaves: FocusLeaveDto[]
}

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
  /** Null on free practice, and while the sitting is still in progress. */
  focus: FocusReportDto | null
}

export type SheetImageDto = { id: string; url: string }
export type ReviewQuestionDto = PlayerQuestionDto & {
  correctKey: string
  /** Accepted cloze answers, joined for display. Null on multiple choice. */
  correctText: string | null
  isCorrect: boolean | null
  /** Null when this question has no written explanation. */
  explanation: string | null
}
export type AttemptReviewDto = { result: AttemptResultDto; groups: GroupDto[]; questions: ReviewQuestionDto[]; audio: AudioTrackDto[]; sheetImages: SheetImageDto[] }