import { api } from '@/lib/api'
import type { AttemptSummaryDto, ClassReportDto, ExamReportDto, StaffHonorDto, StudentProgressDto } from '@toeic/shared'
import { useQuery } from '@tanstack/react-query'

export function useMyProgress() {
  return useQuery({ queryKey: ['me', 'progress'], queryFn: () => api<StudentProgressDto>('/me/progress'), refetchOnMount: 'always' })
}

/** Teacher/admin view of one student. */
export function useStudentProgress(id: string | undefined) {
  return useQuery({ queryKey: ['students', id, 'progress'], queryFn: () => api<StudentProgressDto>(`/students/${id}/progress`), enabled: !!id })
}

export function useStudentAttempts(id: string | undefined) {
  return useQuery({
    queryKey: ['students', id, 'attempts'],
    queryFn: () => api<AttemptSummaryDto[]>(`/students/${id}/attempts`),
    enabled: !!id,
  })
}

export function useClassReport() {
  return useQuery({ queryKey: ['reports', 'class'], queryFn: () => api<ClassReportDto>('/reports/class'), refetchOnMount: 'always' })
}

export function useExamReport() {
  return useQuery({ queryKey: ['reports', 'exams'], queryFn: () => api<ExamReportDto>('/reports/exams'), refetchOnMount: 'always' })
}

export function useStaffHonor() {
  return useQuery({ queryKey: ['reports', 'honor'], queryFn: () => api<StaffHonorDto>('/reports/honor'), refetchOnMount: 'always' })
}
