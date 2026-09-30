import { api } from '@/lib/api'
import type { CreateStudentInput, CredentialsIssuedDto, Paginated, StudentStatsDto, UserDto, UserStatus } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type StudentFilters = { q: string; status: UserStatus | ''; page: number; pageSize: number }

const keys = {
  all: ['users'] as const,
  list: (f: StudentFilters) => ['users', 'list', f] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  stats: ['users', 'stats'] as const,
}

export function useStudents(filters: StudentFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: () => {
      const p = new URLSearchParams({ role: 'STUDENT', page: String(filters.page), pageSize: String(filters.pageSize) })
      if (filters.q) p.set('q', filters.q)
      if (filters.status) p.set('status', filters.status)
      return api<Paginated<UserDto>>(`/users?${p}`)
    },
    placeholderData: (prev) => prev,
  })
}

export function useStudentStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => api<StudentStatsDto>('/users/stats/students') })
}

export function useUser(id: string | undefined) {
  return useQuery({ queryKey: keys.detail(id ?? ''), queryFn: () => api<UserDto>(`/users/${id}`), enabled: !!id })
}

function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: keys.all })
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

export function useSetUserStatus() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      api<UserDto>(`/users/${id}/${status === 'DISABLED' ? 'disable' : 'enable'}`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}
