import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useStaffHonor } from '@/features/progress/progress.queries'
import { StaffHonorBoards } from './HonorBoards'

export function StaffHonorPage() {
  const { data, isPending, error } = useStaffHonor()
  if (isPending) return <PageLoading message="Đang tải bảng xếp hạng…" />
  if (error || !data) return <QueryErrorRedirect error={error} />
  return <StaffHonorBoards honor={data} />
}
