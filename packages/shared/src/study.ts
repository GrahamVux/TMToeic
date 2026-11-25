import { z } from 'zod'

/** A single English word a student can save from a passage or question. */
const WORD = /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/

export function singleEnglishWord(raw: string): string | null {
  const trimmed = raw.trim()
  if (/\s/.test(trimmed)) return null
  const word = trimmed.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
  if (word.length < 2 || word.length > 40 || !WORD.test(word)) return null
  return word
}

const PHRASE = /^[A-Za-z]+(?:['’-][A-Za-z]+)*(?: [A-Za-z]+(?:['’-][A-Za-z]+)*){0,7}$/

/** A word or a short English phrase a student can keep in their own dictionary. */
export function notebookPhrase(raw: string): string | null {
  const phrase = raw.trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').replace(/\s+/g, ' ')
  if (phrase.length < 2 || phrase.length > 80 || !PHRASE.test(phrase)) return null
  return phrase
}

export const READING_MARK_COLORS = ['yellow', 'blue', 'green'] as const
export type ReadingMarkColor = (typeof READING_MARK_COLORS)[number]

export type ReadingMarkDto = {
  id: string
  examId: string
  targetKind: 'passage' | 'prompt' | 'option'
  targetId: string
  passageLabel: string
  optionKey: string
  start: number
  end: number
  quote: string
  color: ReadingMarkColor | null
  note: string
}

export const saveReadingMarkSchema = z
  .object({
    examId: z.uuid(),
    targetKind: z.enum(['passage', 'prompt', 'option']),
    targetId: z.uuid(),
    passageLabel: z.string().max(40).optional(),
    optionKey: z.string().max(8).optional(),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    quote: z.string().min(1).max(120),
    color: z.enum(READING_MARK_COLORS).nullable().optional(),
    note: z.string().max(500).optional(),
  })
  .refine((value) => value.end > value.start && value.end - value.start <= 120, 'Chọn một từ hoặc cụm từ')
  .refine((value) => Boolean(value.color) || Boolean(value.note?.trim()), 'Chọn màu hoặc ghi chú')
export type SaveReadingMarkInput = z.infer<typeof saveReadingMarkSchema>

export const NOTEBOOK_CARD_COLORS = ['default', 'rose', 'amber', 'emerald', 'sky', 'violet'] as const
export type NotebookCardColor = (typeof NOTEBOOK_CARD_COLORS)[number]

export type VocabEntryDto = {
  id: string
  word: string
  partOfSpeech: string
  meaning: string
  example: string
  set: { topic: string; title: string; unit: number } | null
}

const vocabTopic = z.string().trim().min(2, 'Chủ đề cần ít nhất 2 ký tự').max(80, 'Chủ đề quá dài')
const vocabTitle = z.string().trim().min(2, 'Tên bộ từ cần ít nhất 2 ký tự').max(120, 'Tên bộ từ quá dài')

/** A workbook either starts a new set or appends the next unit to one that already exists. */
export const vocabImportTargetSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('new'), topic: vocabTopic, title: vocabTitle }),
  z.object({ mode: z.literal('unit'), setId: z.uuid('Hãy chọn một bộ từ') }),
])
export type VocabImportTarget = z.infer<typeof vocabImportTargetSchema>

export type VocabListDto = {
  total: number
  items: VocabEntryDto[]
}

export type VocabUnitWordDto = {
  id: string
  word: string
  partOfSpeech: string
  meaning: string
  example: string
  displayOrder: number
  savedInNotebook: boolean
}

export type VocabUnitDetailDto = {
  setId: string
  topic: string
  title: string
  unit: number
  items: VocabUnitWordDto[]
}

export type VocabPreviewRowDto = {
  unit: number
  word: string
  partOfSpeech: string
  meaning: string
  example: string
  status: 'NEW' | 'UPDATE'
}

export type VocabPreviewDto = {
  suggestedTitle: string | null
  suggestedTopic: string | null
  structured: boolean
  skipped: number
  rows: VocabPreviewRowDto[]
}

export const vocabStageRowSchema = z.object({
  unit: z.number().int().min(1).max(500),
  word: z.string().trim().min(1, 'Nhập từ vựng').max(80),
  partOfSpeech: z.string().trim().min(1, 'Nhập loại từ').max(40),
  meaning: z.string().trim().min(1, 'Nhập nghĩa').max(500),
  example: z.string().trim().max(600).optional(),
})
export type VocabStageRowInput = z.infer<typeof vocabStageRowSchema>

export const commitVocabSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('new'),
    topic: vocabTopic,
    title: vocabTitle,
    rows: z.array(vocabStageRowSchema).min(1, 'Cần ít nhất 1 từ vựng').max(2000),
  }),
  z.object({
    mode: z.literal('existing'),
    setId: z.uuid('Hãy chọn một bộ từ'),
    rows: z.array(vocabStageRowSchema).min(1, 'Cần ít nhất 1 từ vựng').max(2000),
  }),
])
export type CommitVocabInput = z.infer<typeof commitVocabSchema>

export const updateVocabEntrySchema = z.object({
  word: z.string().trim().min(1, 'Nhập từ vựng').max(80),
  partOfSpeech: z.string().trim().min(1, 'Nhập loại từ').max(40),
  meaning: z.string().trim().min(1, 'Nhập nghĩa').max(500),
  example: z.string().trim().max(600).optional(),
  unit: z.number().int().min(1).max(500).optional(),
})
export type UpdateVocabEntryInput = z.infer<typeof updateVocabEntrySchema>

export const createVocabEntrySchema = z.object({
  unit: z.number().int().min(1).max(500),
  word: z.string().trim().min(1, 'Nhập từ vựng').max(80),
  partOfSpeech: z.string().trim().min(1, 'Nhập loại từ').max(40),
  meaning: z.string().trim().min(1, 'Nhập nghĩa').max(500),
  example: z.string().trim().max(600).optional(),
})
export type CreateVocabEntryInput = z.infer<typeof createVocabEntrySchema>

/** One uploaded file is split into units of this many words, in file order. */
export const VOCAB_UNIT_SIZE = 30

/** Words imported before sets existed, or not attached to a named set. */
export const UNASSIGNED_VOCAB_SET = 'unassigned'

export type VocabUnitDto = {
  index: number
  wordCount: number
  learnedCount: number
}

export type VocabSetCardDto = {
  id: string
  topic: string
  title: string
  wordCount: number
  learnedCount: number
  units: VocabUnitDto[]
}

export type VocabCourseDto = {
  sets: VocabSetCardDto[]
}

export type VocabImportResult = {
  imported: number
  updated: number
  skipped: number
  /** Units created by this upload. Zero when every row already existed. */
  units: number
}

/** A student's own Excel list added to their notebook. */
export type NotebookImportResult = {
  added: number
  updated: number
  skipped: number
}

export type NotebookEntryDto = {
  id: string
  word: string
  partOfSpeech: string | null
  meaning: string | null
  example: string | null
  topic: string
  unit: number | null
  color: NotebookCardColor
  vocabEntryId: string | null
  source: 'CATALOG' | 'EXAM' | 'MANUAL'
  /** True when this card is due for review. Cards without a meaning are never due. */
  due: boolean
  createdAt: string
}

export type NotebookListDto = {
  total: number
  dueCount: number
  missingMeaning: number
  items: NotebookEntryDto[]
}

export type SaveNotebookResult = {
  word: string
  alreadySaved: boolean
  entries: NotebookEntryDto[]
}

export type BatchSaveNotebookResult = {
  added: number
  alreadySaved: number
}

export type FlashcardDto = {
  kind: 'CATALOG' | 'NOTEBOOK'
  id: string
  word: string
  partOfSpeech: string
  meaning: string
  example: string
  topic?: string | null
  unit?: number | null
  savedInNotebook?: boolean
}

export type FlashcardDeckDto = {
  deck: 'catalog' | 'notebook'
  title: string
  dueCount: number
  newCount: number
  cards: FlashcardDto[]
}

export type StudyOverviewDto = {
  vocabTotal: number
  catalogDue: number
  catalogNew: number
  notebookTotal: number
  notebookDue: number
  notebookMissingMeaning: number
  grammarTotal: number
  grammarCompleted: number
}

export type GrammarPdfDto = {
  filename: string
  sizeBytes: number
}

export type GrammarLessonDto = {
  id: string
  title: string
  summary: string
  body: string
  displayOrder: number
  completed: boolean
  pdf: GrammarPdfDto | null
}

export const saveNotebookSchema = z
  .object({
    word: z.string().trim().min(1).max(80).optional(),
    vocabEntryId: z.uuid().optional(),
    partOfSpeech: z.string().trim().max(40).optional(),
    meaning: z.string().trim().max(500).optional(),
    example: z.string().trim().max(600).optional(),
    topic: z.string().trim().max(80).optional(),
    unit: z.number().int().min(1).max(500).nullable().optional(),
    color: z.enum(NOTEBOOK_CARD_COLORS).optional(),
    /** Student typed this card themselves, with their own word type and meaning. */
    manual: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.word || value.vocabEntryId), 'Chọn một từ')
export type SaveNotebookInput = z.infer<typeof saveNotebookSchema>

export const batchSaveNotebookSchema = z.object({
  vocabEntryIds: z.array(z.uuid()).min(1).max(200),
})
export type BatchSaveNotebookInput = z.infer<typeof batchSaveNotebookSchema>

export const updateNotebookSchema = z
  .object({
    word: z.string().trim().min(1, 'Nhập từ vựng').max(80).optional(),
    partOfSpeech: z.string().trim().max(40).optional(),
    meaning: z.string().trim().max(500).optional(),
    example: z.string().trim().max(600).optional(),
    topic: z.string().trim().max(80).optional(),
    unit: z.number().int().min(1).max(500).nullable().optional(),
    color: z.enum(NOTEBOOK_CARD_COLORS).optional(),
  })
  .refine(
    (value) =>
      value.word !== undefined ||
      value.partOfSpeech !== undefined ||
      value.meaning !== undefined ||
      value.example !== undefined ||
      value.topic !== undefined ||
      value.unit !== undefined ||
      value.color !== undefined,
    'Cần ít nhất một thông tin để cập nhật',
  )
export type UpdateNotebookInput = z.infer<typeof updateNotebookSchema>

export const reviewCardSchema = z.object({
  kind: z.enum(['CATALOG', 'NOTEBOOK']),
  id: z.uuid(),
  result: z.enum(['AGAIN', 'GOOD']),
})
export type ReviewCardInput = z.infer<typeof reviewCardSchema>

export const VOCAB_GAME_DAILY_XP_CAP = 40
export const VOCAB_GAME_KINDS = ['MATCH', 'QUIZ', 'SPELL'] as const
export type VocabGameKind = (typeof VOCAB_GAME_KINDS)[number]

export const completeVocabGameSchema = z.object({
  gameKind: z.enum(VOCAB_GAME_KINDS),
  deckLabel: z.string().trim().min(1).max(160),
  score: z.number().int().min(0).max(500),
  totalItems: z.number().int().min(1).max(100),
  reviewedCards: z
    .array(
      z.object({
        kind: z.enum(['CATALOG', 'NOTEBOOK']),
        id: z.uuid(),
        result: z.enum(['AGAIN', 'GOOD']),
      }),
    )
    .max(60)
    .default([]),
})
export type CompleteVocabGameInput = z.infer<typeof completeVocabGameSchema>

export type CompleteVocabGameResultDto = {
  xpAwarded: number
  todayGameXp: number
  dailyCap: number
  reviewedCount: number
}

export type VocabGameStatusDto = {
  todayGameXp: number
  dailyCap: number
  recent: Array<{
    id: string
    gameKind: VocabGameKind
    deckLabel: string
    score: number
    totalItems: number
    xpAwarded: number
    playedAt: string
  }>
}

export const grammarLessonSchema = z.object({
  title: z.string().trim().min(3, 'Tiêu đề quá ngắn').max(200),
  summary: z.string().trim().min(3, 'Tóm tắt quá ngắn').max(400),
  body: z.string().trim().min(10, 'Nội dung quá ngắn').max(8000),
  displayOrder: z.number().int().min(0).max(999).optional(),
})
export type GrammarLessonInput = z.infer<typeof grammarLessonSchema>

export const grammarProgressSchema = z.object({
  completed: z.boolean(),
})
