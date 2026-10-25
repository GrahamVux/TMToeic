import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useResetClassHonor, useStaffHonor } from '@/features/progress/progress.queries'
import { useAuth } from '@/app/AuthContext'
import { StaffHonorBoards } from './HonorBoards'

export function StaffHonorPage() {
  const { user } = useAuth()
  const { data, isPending, error } = useStaffHonor()
  const reset = useResetClassHonor()
  if (isPending) return <PageLoading message="Đang tải bảng xếp hạng…" />
  if (error || !data) return <QueryErrorRedirect error={error} />
  return (
    <StaffHonorBoards
      honor={data}
      canReset={user?.role === 'ADMIN'}
      resettingId={reset.isPending ? reset.variables : null}
      onReset={(classId, className) => {
        if (!window.confirm(`Reset bảng của ${className}? EXP trên bảng lớp này tính lại từ bây giờ. Bảng tổng của năm giữ nguyên.`)) return
        reset.mutate(classId)
      }}
    />
  )
}
