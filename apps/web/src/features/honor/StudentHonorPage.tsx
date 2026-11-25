import { useAuth } from '@/app/AuthContext'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useState } from 'react'
import { FrameWardrobeModal } from './FrameWardrobeModal'
import { HonorBentoView } from './HonorBoards'
import { useMyHonor } from './honor.queries'

export function StudentHonorPage() {
  const { user } = useAuth()
  const { data, isPending, error } = useMyHonor()
  const [wardrobeTab, setWardrobeTab] = useState<'frames' | 'wallet' | null>(null)

  if (isPending) return <PageLoading message="Đang tải bảng xếp hạng…" />
  if (error || !data) return <QueryErrorRedirect error={error} />

  return (
    <>
      <HonorBentoView
        honor={data}
        userName={user?.fullName ?? ''}
        userAvatarUrl={user?.avatarUrl ?? null}
        onOpenWardrobe={(tab) => setWardrobeTab(tab)}
      />
      <FrameWardrobeModal open={wardrobeTab !== null} initialTab={wardrobeTab ?? 'frames'} onClose={() => setWardrobeTab(null)} />
    </>
  )
}
