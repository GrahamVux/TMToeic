import { useAuth } from '@/app/AuthContext'
import { api } from '@/lib/api'
import type { SessionDto, StudentDashboardDto } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const dashboardKey = ['me', 'dashboard'] as const

export function useDashboard(enabled = true) {
  return useQuery({ queryKey: dashboardKey, queryFn: () => api<StudentDashboardDto>('/me/dashboard'), refetchOnMount: 'always', enabled })
}

export function useSetGoal() {
  const qc = useQueryClient()
  const { updateUser } = useAuth()
  return useMutation({
    mutationFn: (targetScore: number | null) => api<SessionDto>('/me/goal', { method: 'PATCH', body: { targetScore } }),
    onSuccess: (s) => {
      updateUser(s.user)
      void qc.invalidateQueries({ queryKey: dashboardKey })
    },
  })
}
