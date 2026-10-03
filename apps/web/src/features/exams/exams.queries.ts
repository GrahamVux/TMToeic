import { api, apiUpload } from '@/lib/api'
import type { AttemptPlayerDto, AttemptResultDto, AttemptReviewDto, ExamSummaryDto, StartAttemptInput, AttemptDto } from '@toeic/shared'
import { PART_SEED } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const examKeys = {
  exams: ['exams'] as const,
  attempts: ['attempts'] as const,
  player: (id: string) => ['attempts', 'player', id] as const,
  result: (id: string) => ['attempts', 'result', id] as const,
  review: (id: string) => ['attempts', 'review', id] as const,
}

export function useExams(enabled = true) {
  return useQuery({ queryKey: examKeys.exams, queryFn: () => api<ExamSummaryDto[]>('/exams'), enabled })
}

/** Attempt history incl. live partial result for in-progress ones. */
export function useAttempts() {
  return useQuery({ queryKey: examKeys.attempts, queryFn: () => api<AttemptResultDto[]>('/attempts') })
}

export function useAttemptPlayer(id: string | undefined) {
  return useQuery({
    queryKey: examKeys.player(id ?? ''),
    queryFn: () => api<AttemptPlayerDto>(`/attempts/${id}`),
    enabled: !!id,
    // The player owns the live answer state; always start from the server copy, never a cached one.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: false,
  })
}

export function useAttemptResult(id: string | undefined) {
  return useQuery({ queryKey: examKeys.result(id ?? ''), queryFn: () => api<AttemptResultDto>(`/attempts/${id}/result`), enabled: !!id })
}

export function useAttemptReview(id: string | undefined) {
  return useQuery({ queryKey: examKeys.review(id ?? ''), queryFn: () => api<AttemptReviewDto>(`/attempts/${id}/review`), enabled: !!id })
}

export function useStartAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ examId, ...input }: { examId: string } & Partial<StartAttemptInput>) =>
      api<AttemptDto>(`/exams/${examId}/attempts`, { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.attempts }),
  })
}

export function useSubmitAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<AttemptResultDto>(`/attempts/${id}/submit`, { method: 'POST' }),
    onSuccess: (result) => {
      qc.setQueryData(examKeys.result(result.attempt.id), result)
      void qc.invalidateQueries({ queryKey: examKeys.attempts })
      void qc.invalidateQueries({ queryKey: ['me', 'dashboard'] }) // score, streak and ranking just changed
    },
  })
}

// ---- staff
export function usePublishExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<ExamSummaryDto>(`/exams/${id}/publish`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.exams }),
  })
}

export function useArchiveExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<ExamSummaryDto>(`/exams/${id}/archive`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.exams }),
  })
}

const MAX_AUDIO_BYTES = 80 * 1024 * 1024

export function audioContentType(file: File): string {
  if (file.type.startsWith('audio/')) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4'
  if (ext === 'wav') return 'audio/wav'
  return 'application/octet-stream'
}

export function useUploadExamAudio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ examId, file, partCode }: { examId: string; file: File; partCode?: string }) => {
      if (file.size > MAX_AUDIO_BYTES) throw new Error('File nghe quá lớn (tối đa 80MB).')
      const q = new URLSearchParams({ filename: file.name })
      if (partCode) q.set('partCode', partCode)
      return apiUpload<{ ok: true }>(`/exams/${examId}/audio/file?${q}`, file, audioContentType(file))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.exams }),
  })
}

// ---- helpers
export const partName = (code: string) => PART_SEED.find((p) => p.code === code)?.name ?? code
export const isListeningPart = (code: string) => PART_SEED.find((p) => p.code === code)?.skill === 'LISTENING'

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
