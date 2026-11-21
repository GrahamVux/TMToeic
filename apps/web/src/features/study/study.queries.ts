import { api, apiUpload, ApiError } from '@/lib/api'
import type {
  FlashcardDeckDto,
  GrammarLessonDto,
  GrammarLessonInput,
  NotebookEntryDto,
  NotebookImportResult,
  NotebookListDto,
  ReadingMarkDto,
  SaveNotebookResult,
  SaveReadingMarkInput,
  StudyOverviewDto,
  UpdateNotebookInput,
  VocabCourseDto,
  VocabImportResult,
  VocabListDto,
} from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const studyKeys = {
  overview: ['study', 'overview'] as const,
  vocab: (q: string) => ['study', 'vocab', q] as const,
  course: ['study', 'vocab-course'] as const,
  notebook: ['study', 'notebook'] as const,
  deck: (deck: 'catalog' | 'notebook') => ['study', 'flashcards', deck] as const,
  grammar: ['study', 'grammar'] as const,
  marks: (examId: string) => ['study', 'reading-marks', examId] as const,
  lesson: (id: string) => ['study', 'grammar', id] as const,
}

function refreshStudy(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['study'] })
}

export function useStudyOverview() {
  return useQuery({ queryKey: studyKeys.overview, queryFn: () => api<StudyOverviewDto>('/study/overview') })
}

export function useVocabCourse() {
  return useQuery({ queryKey: studyKeys.course, queryFn: () => api<VocabCourseDto>('/study/vocab/sets') })
}

export function useVocabSearch(q: string) {
  return useQuery({ queryKey: studyKeys.vocab(q), queryFn: () => api<VocabListDto>(`/study/vocab?q=${encodeURIComponent(q)}`) })
}

export function useNotebook() {
  return useQuery({ queryKey: studyKeys.notebook, queryFn: () => api<NotebookListDto>('/study/notebook') })
}

export function useImportNotebook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      if (!file.name.toLowerCase().endsWith('.xlsx')) return Promise.reject(new ApiError(400, 'VALIDATION_FAILED', 'Hãy chọn file .xlsx.'))
      if (file.size > 8 * 1024 * 1024) return Promise.reject(new ApiError(400, 'VALIDATION_FAILED', 'File Excel quá lớn (tối đa 8MB).'))
      return apiUpload<NotebookImportResult>('/study/notebook/import', file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    },
    onSuccess: () => refreshStudy(qc),
  })
}

export function useSaveNotebookWord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { word?: string; vocabEntryId?: string; partOfSpeech?: string; meaning?: string; manual?: boolean }) =>
      api<SaveNotebookResult>('/study/notebook', { method: 'POST', body: input }),
    onSuccess: () => refreshStudy(qc),
  })
}

export function useReadingMarks(examId: string | undefined) {
  return useQuery({
    queryKey: studyKeys.marks(examId ?? ''),
    queryFn: () => api<ReadingMarkDto[]>(`/study/reading-marks?examId=${examId}`),
    enabled: !!examId,
  })
}

export function useSaveReadingMark(examId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveReadingMarkInput) => api<ReadingMarkDto>('/study/reading-marks', { method: 'POST', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: studyKeys.marks(examId) }),
  })
}

export function useDeleteReadingMark(examId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/study/reading-marks/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: studyKeys.marks(examId) }),
  })
}

export function useUpdateNotebook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string } & UpdateNotebookInput) =>
      api<NotebookEntryDto>(`/study/notebook/${input.id}`, { method: 'PATCH', body: { partOfSpeech: input.partOfSpeech, meaning: input.meaning } }),
    onSuccess: () => refreshStudy(qc),
  })
}

export function useDeleteNotebook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/study/notebook/${id}`, { method: 'DELETE' }),
    onSuccess: () => refreshStudy(qc),
  })
}

export function useFlashcards(deck: 'catalog' | 'notebook', unit?: { setId: string; unit: number }) {
  const scope = unit ? `&setId=${encodeURIComponent(unit.setId)}&unit=${unit.unit}` : ''
  return useQuery({
    queryKey: [...studyKeys.deck(deck), unit?.setId ?? '', unit?.unit ?? 0] as const,
    queryFn: () => api<FlashcardDeckDto>(`/study/flashcards?deck=${deck}${scope}`),
  })
}

export function useReviewCard() {
  return useMutation({
    mutationFn: (input: { kind: 'CATALOG' | 'NOTEBOOK'; id: string; result: 'AGAIN' | 'GOOD' }) =>
      api('/study/flashcards/review', { method: 'POST', body: input }),
  })
}

export function useGrammarLessons() {
  return useQuery({ queryKey: studyKeys.grammar, queryFn: () => api<GrammarLessonDto[]>('/study/grammar') })
}

export function useGrammarLesson(id: string | undefined) {
  return useQuery({
    queryKey: studyKeys.lesson(id ?? ''),
    queryFn: () => api<GrammarLessonDto>(`/study/grammar/${id}`),
    enabled: !!id,
  })
}

export function useGrammarProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; completed: boolean }) =>
      api<GrammarLessonDto>(`/study/grammar/${input.id}/progress`, { method: 'POST', body: { completed: input.completed } }),
    onSuccess: () => refreshStudy(qc),
  })
}

export function useImportVocab() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { file: File; mode?: 'new' | 'unit'; topic?: string; title?: string; setId?: string }) => {
      if (!input.file.name.toLowerCase().endsWith('.xlsx')) return Promise.reject(new ApiError(400, 'VALIDATION_FAILED', 'Hãy chọn file .xlsx.'))
      if (input.file.size > 8 * 1024 * 1024) return Promise.reject(new ApiError(400, 'VALIDATION_FAILED', 'File Excel quá lớn (tối đa 8MB).'))
      const query = new URLSearchParams()
      if (input.mode === 'new' && input.topic && input.title) {
        query.set('mode', 'new')
        query.set('topic', input.topic.trim())
        query.set('title', input.title.trim())
      } else if (input.mode === 'unit' && input.setId) {
        query.set('mode', 'unit')
        query.set('setId', input.setId)
      }
      const suffix = query.size > 0 ? `?${query}` : ''
      return apiUpload<VocabImportResult>(`/study/vocab/import${suffix}`, input.file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    },
    onSuccess: () => refreshStudy(qc),
  })
}

export function useDeleteVocab() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/study/vocab/${id}`, { method: 'DELETE' }),
    onSuccess: () => refreshStudy(qc),
  })
}

export function useCreateGrammar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GrammarLessonInput) => api<GrammarLessonDto>('/study/grammar', { method: 'POST', body: input }),
    onSuccess: () => refreshStudy(qc),
  })
}

export function useDeleteGrammar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/study/grammar/${id}`, { method: 'DELETE' }),
    onSuccess: () => refreshStudy(qc),
  })
}

const MAX_PDF_BYTES = 15 * 1024 * 1024

export function useUploadGrammarPdf() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; file: File }) => {
      if (!input.file.name.toLowerCase().endsWith('.pdf')) return Promise.reject(new ApiError(400, 'VALIDATION_FAILED', 'Hãy chọn file PDF.'))
      if (input.file.size > MAX_PDF_BYTES) return Promise.reject(new ApiError(400, 'VALIDATION_FAILED', 'File PDF quá lớn (tối đa 15MB).'))
      const q = new URLSearchParams({ filename: input.file.name })
      return apiUpload<GrammarLessonDto>(`/study/grammar/${input.id}/pdf?${q}`, input.file, 'application/pdf')
    },
    onSuccess: () => refreshStudy(qc),
  })
}

export function useClearGrammarPdf() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/study/grammar/${id}/pdf`, { method: 'DELETE' }),
    onSuccess: () => refreshStudy(qc),
  })
}

export function notebookSavedMessage(result: SaveNotebookResult) {
  if (result.alreadySaved) return `“${result.word}” đã có trong sổ tay.`
  const withMeaning = result.entries.some((entry) => entry.meaning)
  if (withMeaning) return `Đã thêm “${result.word}” vào sổ tay.`
  return `Đã thêm “${result.word}”. Hãy điền loại từ và nghĩa trong sổ tay.`
}
