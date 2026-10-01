import { api } from '@/lib/api'
import type {
  BugReportAdminDto,
  BugReportDto,
  BugReportListDto,
  BugReportStatus,
  BugReportSummaryDto,
  CreateBugReportInput,
  UpdateBugReportInput,
} from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const keys = {
  mine: ['bug-reports', 'mine'] as const,
  summary: ['bug-reports', 'summary'] as const,
  list: (status: BugReportStatus | '', page: number) => ['bug-reports', 'admin', status, page] as const,
}

export function useMyBugReports(enabled: boolean) {
  return useQuery({
    queryKey: keys.mine,
    queryFn: () => api<{ items: BugReportDto[] }>('/bug-reports/mine'),
    enabled,
    staleTime: 15_000,
  })
}

export function useBugReportSummary(enabled: boolean) {
  return useQuery({
    queryKey: keys.summary,
    queryFn: () => api<BugReportSummaryDto>('/bug-reports/summary'),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useAdminBugReports(status: BugReportStatus | '', page: number) {
  return useQuery({
    queryKey: keys.list(status, page),
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (status) p.set('status', status)
      return api<BugReportListDto>(`/bug-reports?${p}`)
    },
    placeholderData: (prev) => prev,
  })
}

export function useCreateBugReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBugReportInput) => api<BugReportDto>('/bug-reports', { method: 'POST', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.mine })
    },
  })
}

export function useUpdateBugReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateBugReportInput & { id: string }) =>
      api<BugReportAdminDto>(`/bug-reports/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bug-reports'] })
    },
  })
}
