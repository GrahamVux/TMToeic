import { useAuth } from '@/app/AuthContext'
import { Eye, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/** Always visible while an admin previews a teacher or student, so nobody mistakes the preview for a real login. */
export function ViewAsBanner() {
  const { user, viewing, stopViewAs } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  if (!viewing || !user) return null

  async function leave() {
    setLeaving(true)
    try {
      await stopViewAs()
      navigate('/admin/view-as', { replace: true })
    } finally {
      setLeaving(false)
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-1 bg-amber-500" aria-hidden />
      <div
        role="status"
        className="fixed bottom-20 left-1/2 z-[90] flex w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl bg-ink/95 px-4 py-2.5 text-white shadow-[0_12px_32px_rgba(30,51,60,0.35)] lg:bottom-5 lg:w-auto lg:rounded-full"
      >
        <span className="flex items-center gap-2 text-[13px]">
          <Eye className="size-4 shrink-0 text-amber-300" />
          <span>
            Đang xem thử với tư cách <strong className="font-semibold">{user.fullName}</strong> ({user.role === 'STUDENT' ? 'học sinh' : 'giáo viên'}). Chỉ xem, không lưu thay đổi.
          </span>
        </span>
        <button
          type="button"
          disabled={leaving}
          onClick={() => void leave()}
          className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[12px] font-semibold text-ink transition hover:bg-amber-300 disabled:opacity-60"
        >
          <LogOut className="size-3.5" />
          {leaving ? 'Đang thoát…' : 'Thoát xem thử'}
        </button>
      </div>
    </>
  )
}
