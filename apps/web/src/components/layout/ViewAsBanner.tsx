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

  const roleLabel = user.role === 'STUDENT' ? 'học sinh' : 'giáo viên'
  const fullNotice = `Đang xem thử với tư cách ${user.fullName} (${roleLabel}). Chỉ xem, không lưu thay đổi.`

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-1 bg-button" aria-hidden />
      <div
        role="status"
        aria-label={fullNotice}
        title={fullNotice}
        className="fixed bottom-20 left-1/2 z-[90] flex w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl bg-ink/95 px-4 py-2.5 text-white shadow-[0_12px_32px_rgba(30,51,60,0.35)] lg:bottom-auto lg:left-auto lg:right-4 lg:top-[62px] lg:w-auto lg:max-w-[22rem] lg:translate-x-0 lg:flex-nowrap lg:gap-2 lg:rounded-full lg:px-2 lg:py-1"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] lg:text-xs">
          <Eye className="size-4 shrink-0 text-button-soft lg:size-3.5" />
          <span className="lg:hidden">
            Đang xem thử với tư cách <strong className="font-semibold">{user.fullName}</strong> ({roleLabel}). Chỉ xem, không lưu thay đổi.
          </span>
          <span className="hidden min-w-0 truncate lg:block">
            Xem thử · <strong className="font-semibold">{user.fullName}</strong>
          </span>
        </span>
        <button
          type="button"
          disabled={leaving}
          aria-label="Thoát xem thử"
          onClick={() => void leave()}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-button px-3 py-1 text-[12px] font-semibold text-button-ink transition hover:bg-button-hover disabled:opacity-60 lg:px-2.5 lg:py-0.5 lg:text-[11px]"
        >
          <LogOut className="size-3.5 lg:size-3" />
          {leaving ? (
            'Đang thoát…'
          ) : (
            <>
              <span className="lg:hidden">Thoát xem thử</span>
              <span className="hidden lg:inline">Thoát</span>
            </>
          )}
        </button>
      </div>
    </>
  )
}
