import { audioContentType, examKeys } from '@/features/exams/exams.queries'
import { api, apiUpload } from '@/lib/api'
import type { AssignmentDetailDto, AssignmentDto, AttemptDto, CreateAssignmentInput, CreateFillAssignmentInput, ExamSummaryDto, ImportAuthoredExamInput } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const MAX_AUDIO_BYTES = 80 * 1024 * 1024
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function imageContentType(file: File): string {
  if (file.type.startsWith('image/')) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'application/octet-stream'
}

export const assignmentKeys = {
  all: ['assignments'] as const,
  one: (id: string) => ['assignments', id] as const,
}

export function useAssignments() {
  return useQuery({ queryKey: assignmentKeys.all, queryFn: () => api<AssignmentDto[]>('/assignments') })
}

export function useAssignment(id: string | undefined) {
  return useQuery({
    queryKey: assignmentKeys.one(id ?? ''),
    queryFn: () => api<AssignmentDetailDto>(`/assignments/${id}`),
    enabled: !!id,
  })
}

export function useCreateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAssignmentInput) => api<AssignmentDto>('/assignments', { method: 'POST', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: assignmentKeys.all }),
  })
}

export function useCreateFillAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFillAssignmentInput) => api<AssignmentDto>('/assignments/fill', { method: 'POST', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: assignmentKeys.all }),
  })
}

export function useSaveAssignmentToBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<AssignmentDto>(`/assignments/${id}/bank`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: assignmentKeys.all })
      void qc.invalidateQueries({ queryKey: examKeys.exams })
    },
  })
}

export function useUploadAssignmentAudio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      if (file.size > MAX_AUDIO_BYTES) throw new Error('File nghe quá lớn (tối đa 80MB).')
      const q = new URLSearchParams({ filename: file.name })
      return apiUpload<{ ok: true }>(`/assignments/${id}/audio/file?${q}`, file, audioContentType(file))
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: assignmentKeys.all }),
  })
}

export function useUploadAssignmentImages() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, files }: { id: string; files: File[] }) => {
      for (const file of files) {
        if (file.size > MAX_IMAGE_BYTES) throw new Error('Mỗi ảnh tối đa 8MB.')
        const q = new URLSearchParams({ filename: file.name })
        await apiUpload<{ ok: true }>(`/assignments/${id}/images?${q}`, file, imageContentType(file))
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: assignmentKeys.all }),
  })
}

export function useCloseAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<AssignmentDto>(`/assignments/${id}/close`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: assignmentKeys.all }),
  })
}

export function useStartAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<AttemptDto>(`/assignments/${id}/start`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: assignmentKeys.all })
      void qc.invalidateQueries({ queryKey: examKeys.attempts })
    },
  })
}

export function useImportAuthoredExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ImportAuthoredExamInput) => api<ExamSummaryDto>('/exams/import-authored', { method: 'POST', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: examKeys.exams }),
  })
}
