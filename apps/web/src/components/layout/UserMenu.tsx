import { cn } from '@/lib/cn'
import { Bell, ChevronDown, LogOut, Settings, Target, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  name: string
  code: string
  initials: string
  settingsPath?: string
  onSignOut: () => void
}

/**
 * Menu tài khoản: mở bằng click (ổn định trên cả touch) và cũng mở khi hover.
 * Có "cầu nối" (pt-2) giữa nút và popup để con trỏ không bị mất hover khi di chuột xuống.
 */
export function UserMenu({ name, code, initials, settingsPath = '/settings', onSignOut }: Props) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hovered || pinned
  const wrapRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  function closeAll() {
    window.clearTimeout(closeTimer.current)
    setHovered(false)
    setPinned(false)
  }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeAll()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function hoverOpen() {
    window.clearTimeout(closeTimer.current)
    setHovered(true)
  }
  function hoverClose() {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setHovered(false), 180)
  }
  // Click: nếu menu đang mở do hover -> "ghim" lại; nếu đã ghim -> đóng hẳn.
  function onToggleClick() {
    if (pinned) closeAll()
    else setPinned(true)
  }

  const items = [
    { to: settingsPath, label: 'Thông tin cá nhân', icon: UserRound },
    { to: `${settingsPath}#goal`, label: 'Mục tiêu điểm số', icon: Target },
    { to: `${settingsPath}#notify`, label: 'Thông báo & nhắc học', icon: Bell },
    { to: settingsPath, label: 'Cài đặt tài khoản', icon: Settings },
  ]

  return (
    <div ref={wrapRef} className="relative hidden shrink-0 sm:block" onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggleClick}
        className={cn(
          'flex items-center gap-2 rounded-full border bg-white py-1 pr-2.5 pl-1 transition',
          open ? 'border-gold-deep shadow-sm' : 'border-gold/35 hover:border-gold-deep/60',
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-soft text-[11px] font-bold text-gold-deep">
          {initials}
        </span>
        <span className="text-left leading-none">
          <span className="block whitespace-nowrap text-[12px] font-semibold text-ink">{name}</span>
          <span className="mt-0.5 block whitespace-nowrap text-[10px] text-gold-deep">Mã HV: {code}</span>
        </span>
        <ChevronDown className={cn('size-3.5 text-ink/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-40 w-64 pt-2" role="menu">
          <div className="overflow-hidden rounded-2xl border border-gold/30 bg-white shadow-[0_12px_32px_rgba(30,51,60,0.14)]">
            <div className="flex items-center gap-3 border-b border-gold/20 bg-teal-soft/60 px-4 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-gold-deep">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{name}</p>
                <p className="text-[11px] text-ink/55">Mã HV: {code} • Lớp K42</p>
              </div>
            </div>

            <div className="p-1.5">
              {items.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  role="menuitem"
                  onClick={closeAll}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ink/75 transition hover:bg-teal-soft hover:text-ink"
                >
                  <item.icon className="size-4 text-ink/45" />
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-gold/20 p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeAll()
                  onSignOut()
                }}
                className="flex w-full items-center gap-2.5 rounded-xl justify-center bg-red-600 px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-700"
              >
                <LogOut className="size-4" />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
