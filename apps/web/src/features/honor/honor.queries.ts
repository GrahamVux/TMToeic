import { api } from '@/lib/api'
import type {
  AccountFrameDto,
  AccountRewardsDto,
  AdjustUserPointsInput,
  EarlySettleHonorInput,
  HonorBoardDto,
  HonorRewardConfig,
  HonorSettlementDto,
} from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useMyHonor() {
  return useQuery({
    queryKey: ['me', 'honor'],
    queryFn: () => api<HonorBoardDto>('/me/honor'),
    refetchOnMount: 'always',
  })
}

export function useMyRewards(enabled = true) {
  return useQuery({
    queryKey: ['me', 'rewards'],
    queryFn: () => api<AccountRewardsDto>('/me/rewards'),
    enabled,
    refetchOnMount: 'always',
  })
}

export function useEquipFrame() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (frameId: string) => api<AccountFrameDto>('/me/avatar-frame', { method: 'PUT', body: { frameId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me', 'rewards'] })
      void qc.invalidateQueries({ queryKey: ['me', 'honor'] })
      void qc.invalidateQueries({ queryKey: ['me', 'dashboard'] })
      void qc.invalidateQueries({ queryKey: ['reports', 'honor'] })
    },
  })
}

export function useUpdateHonorConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: HonorRewardConfig) => api<HonorRewardConfig>('/reports/honor/config', { method: 'PUT', body: config }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'honor'] })
      void qc.invalidateQueries({ queryKey: ['me', 'honor'] })
    },
  })
}

export function useAdjustPoints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdjustUserPointsInput) =>
      api<{ userId: string; rewardPoints: number }>('/reports/honor/points', { method: 'POST', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      void qc.invalidateQueries({ queryKey: ['reports', 'honor'] })
    },
  })
}

export function useEarlySettle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EarlySettleHonorInput) =>
      api<HonorSettlementDto>('/reports/honor/settle', { method: 'POST', body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports', 'honor'] })
      void qc.invalidateQueries({ queryKey: ['me', 'honor'] })
      void qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
