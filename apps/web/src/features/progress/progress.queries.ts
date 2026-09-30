import { api } from '@/lib/api'
import type { ClassReportDto, StudentProgressDto } from '@toeic/shared'
import { useQuery } from '@tanstack/react-query'

export function useMyProgress() {
  return useQuery({ queryKey: ['me', 'progress'], queryFn: () => api<StudentProgressDto>('/me/progress'), refetchOnMount: 'always' })
}

/** Teacher/admin view of one student. */
export function useStudentProgress(id: string | undefined) {
  return useQuery({ queryKey: ['students', id, 'progress'], queryFn: () => api<StudentProgressDto>(`/students/${id}/progress`), enabled: !!id })
}

export function useClassReport() {
  return useQuery({ queryKey: ['reports', 'class'], queryFn: () => api<ClassReportDto>('/reports/class'), refetchOnMount: 'always' })
}
