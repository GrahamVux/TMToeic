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

export type VocabEntryDto = {
  id: string
  word: string
  partOfSpeech: string
  meaning: string
}

export type VocabListDto = {
  total: number
  items: VocabEntryDto[]
}

export type VocabImportResult = {
  imported: number
  updated: number
  skipped: number
}

export type NotebookEntryDto = {
  id: string
  word: string
  partOfSpeech: string | null
  meaning: string | null
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

export type FlashcardDto = {
  kind: 'CATALOG' | 'NOTEBOOK'
  id: string
  word: string
  partOfSpeech: string
  meaning: string
}

export type FlashcardDeckDto = {
  deck: 'catalog' | 'notebook'
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
    /** Student typed this card themselves, with their own word type and meaning. */
    manual: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.word || value.vocabEntryId), 'Chọn một từ')
export type SaveNotebookInput = z.infer<typeof saveNotebookSchema>

export const updateNotebookSchema = z.object({
  partOfSpeech: z.string().trim().min(1, 'Nhập loại từ').max(40),
  meaning: z.string().trim().min(1, 'Nhập nghĩa').max(500),
})
export type UpdateNotebookInput = z.infer<typeof updateNotebookSchema>

export const reviewCardSchema = z.object({
  kind: z.enum(['CATALOG', 'NOTEBOOK']),
  id: z.uuid(),
  result: z.enum(['AGAIN', 'GOOD']),
})
export type ReviewCardInput = z.infer<typeof reviewCardSchema>

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
