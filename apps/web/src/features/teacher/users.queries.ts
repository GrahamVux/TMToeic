import { api, apiDownload } from '@/lib/api'
import type { ClassSummaryDto, CreateClassInput, CreateStaffInput, CreateStudentInput, CredentialsIssuedDto, Paginated, StudentStatsDto, TeacherPermissions, UserDto, UserStatus } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type StudentFilters = { q: string; status: UserStatus | ''; classId: string; page: number; pageSize: number }

const keys = {
  all: ['users'] as const,
  list: (f: StudentFilters) => ['users', 'list', f] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  stats: ['users', 'stats'] as const,
}

export function useStudents(filters: StudentFilters, enabled = true) {
  return useQuery({
    queryKey: keys.list(filters),
    enabled,
    queryFn: () => {
      const p = new URLSearchParams({ role: 'STUDENT', page: String(filters.page), pageSize: String(filters.pageSize) })
      if (filters.q) p.set('q', filters.q)
      if (filters.status) p.set('status', filters.status)
      if (filters.classId) p.set('classId', filters.classId)
      return api<Paginated<UserDto>>(`/users?${p}`)
    },
    placeholderData: (prev) => prev,
  })
}

export function useStudentStats(enabled = true) {
  return useQuery({ queryKey: keys.stats, queryFn: () => api<StudentStatsDto>('/users/stats/students'), enabled })
}

export function useUser(id: string | undefined) {
  return useQuery({ queryKey: keys.detail(id ?? ''), queryFn: () => api<UserDto>(`/users/${id}`), enabled: !!id })
}

function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: keys.all })
}

export function useTeachers() {
  return useQuery({
    queryKey: ['users', 'teachers'] as const,
    queryFn: () => api<Paginated<UserDto>>('/users?role=TEACHER&pageSize=100'),
  })
}

export function useCreateStaff() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: CreateStaffInput) => api<CredentialsIssuedDto>('/users/staff', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useUpdateTeacherPermissions() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: TeacherPermissions }) =>
      api<UserDto>(`/users/${id}/permissions`, { method: 'PATCH', body: { permissions } }),
    onSuccess: invalidate,
  })
}

export function useImportStudents() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: async ({ file, classId }: { file: File; classId: string }) => {
      const result = await apiDownload(`/users/students/import?classId=${encodeURIComponent(classId)}`, file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      link.click()
      URL.revokeObjectURL(url)
      return {
        created: Number(result.headers.get('x-students-created') ?? 0),
        skipped: Number(result.headers.get('x-students-skipped') ?? 0),
      }
    },
    onSuccess: invalidate,
  })
}

export function useCreateStudent() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: CreateStudentInput) => api<CredentialsIssuedDto>('/users/students', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useResetPassword() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (id: string) => api<CredentialsIssuedDto>(`/users/${id}/reset-password`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}

export function useClasses() {
  return useQuery({ queryKey: ['classes'] as const, queryFn: () => api<ClassSummaryDto[]>('/classes') })
}

export function useCreateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateClassInput) => api<ClassSummaryDto>('/classes', { method: 'POST', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
    },
  })
}

export function useSetClassTeachers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ classId, teacherIds }: { classId: string; teacherIds: string[] }) =>
      api<ClassSummaryDto>(`/classes/${classId}/teachers`, { method: 'PUT', body: { teacherIds } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
    },
  })
}

export function useAssignClass() {
  const invalidate = useInvalidateUsers()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; classId: string }) => api<{ ok: boolean }>('/classes/members', { method: 'PUT', body: input }),
    onSuccess: () => {
      invalidate()
      void qc.invalidateQueries({ queryKey: ['classes'] })
    },
  })
}

export function useSetUserStatus() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      api<UserDto>(`/users/${id}/${status === 'DISABLED' ? 'disable' : 'enable'}`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}
