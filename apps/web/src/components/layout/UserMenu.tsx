import { cn } from '@/lib/cn'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { Bell, ChevronDown, LogOut, Sparkles, Target, UserRound, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export type UserMenuItem = {
  to: string
  label: string
  icon: LucideIcon
}

type Props = {
  name: string
  code?: string
  subtitle?: string
  avatarUrl?: string | null
  avatarFrame?: string | null
  settingsPath?: string
  menuItems?: UserMenuItem[]
  onSignOut: () => void
}

/**
 * Menu tài khoản: mở bằng click (ổn định trên cả touch) và cũng mở khi hover.
 * Có "cầu nối" (pt-2) giữa nút và popup để con trỏ không bị mất hover khi di chuột xuống.
 */
export function UserMenu({ name, code, subtitle, avatarUrl, avatarFrame, settingsPath = '/settings', menuItems, onSignOut }: Props) {
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

  const subLabel = subtitle ?? (code ? `Mã HV: ${code}` : '')
  const items: UserMenuItem[] = menuItems ?? [
    { to: settingsPath, label: 'Thông tin cá nhân', icon: UserRound },
    { to: `${settingsPath}#frames`, label: 'Kho khung viền & Điểm', icon: Sparkles },
    { to: `${settingsPath}#goal`, label: 'Mục tiêu điểm số', icon: Target },
    { to: `${settingsPath}#notify`, label: 'Thông báo & nhắc học', icon: Bell },
  ]

  return (
    <div ref={wrapRef} className="relative shrink-0" onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-label={`Tài khoản ${name}`}
        aria-expanded={open}
        onClick={onToggleClick}
        className={cn(
          'flex min-h-10 items-center gap-2 rounded-full border bg-cream py-1 pr-3 pl-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
          open ? 'border-gold-deep shadow-sm' : 'border-gold/35 hover:border-gold-deep/60',
        )}
      >
        <AccountAvatar name={name} url={avatarUrl} frameId={avatarFrame} className="size-7 text-[13px]" />
        <span className="hidden text-left leading-none sm:block">
          <span className="block whitespace-nowrap text-[14px] font-semibold text-ink">{name}</span>
          {subLabel ? <span className="mt-0.5 block whitespace-nowrap text-[12px] text-gold-deep">{subLabel}</span> : null}
        </span>
        <ChevronDown className={cn('size-3.5 text-ink-soft transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full right-0 z-40 w-64 pt-2" role="menu">
          <div className="overflow-hidden rounded-2xl border border-gold/30 bg-cream shadow-[0_12px_32px_rgba(15,23,42,0.16)]">
            <div className="flex items-center gap-3 border-b border-gold/20 bg-teal-soft/60 px-4 py-3">
              <AccountAvatar name={name} url={avatarUrl} frameId={avatarFrame} className="size-10 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{name}</p>
                {subLabel ? <p className="text-[13px] text-ink-soft">{subLabel}</p> : null}
              </div>
            </div>

            <div className="p-1.5">
              {items.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  role="menuitem"
                  onClick={closeAll}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[15px] text-ink transition hover:bg-teal-soft hover:text-ink"
                >
                  <item.icon className="size-4 text-ink-soft" />
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
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-danger-soft/75 px-3 py-2 text-[15px] font-semibold text-danger transition hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
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
