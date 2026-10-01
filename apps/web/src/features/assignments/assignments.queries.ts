import { api } from '@/lib/api'
import type { AssignmentDetailDto, AssignmentDto, AttemptDto, CreateAssignmentInput, ExamSummaryDto, ImportAuthoredExamInput } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { examKeys } from '@/features/exams/exams.queries'

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
