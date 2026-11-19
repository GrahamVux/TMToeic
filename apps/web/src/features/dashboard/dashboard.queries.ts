import { useAuth } from '@/app/AuthContext'
import { api } from '@/lib/api'
import type { DailyGoalCounts, DailyGoalsDto, SessionDto, StudentDashboardDto } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const dashboardKey = ['me', 'dashboard'] as const
export const dailyGoalsKey = ['me', 'daily-goals'] as const

export function useDailyGoals() {
  return useQuery({ queryKey: dailyGoalsKey, queryFn: () => api<DailyGoalsDto>('/me/daily-goals'), refetchOnMount: 'always' })
}

export function useSetDailyGoals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (targets: DailyGoalCounts) => api<DailyGoalsDto>('/me/daily-goals', { method: 'PUT', body: targets }),
    onSuccess: (saved) => qc.setQueryData(dailyGoalsKey, saved),
  })
}

export function useDashboard(enabled = true) {
  return useQuery({ queryKey: dashboardKey, queryFn: () => api<StudentDashboardDto>('/me/dashboard'), refetchOnMount: 'always', enabled })
}

export function useSetGoal() {
  const qc = useQueryClient()
  const { updateUser } = useAuth()
  return useMutation({
    mutationFn: (goal: import('@toeic/shared').SetGoalInput['goal']) => api<SessionDto>('/me/goal', { method: 'PATCH', body: { goal } }),
    onSuccess: (s) => {
      updateUser(s.user)
      void qc.invalidateQueries({ queryKey: dashboardKey })
    },
  })
}
