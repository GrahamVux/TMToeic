import { useAuth } from '@/app/AuthContext'
import { cn } from '@/lib/cn'
import { HeaderSearch } from '@/components/layout/HeaderSearch'
import { UserMenu } from '@/components/layout/UserMenu'
import { useSite } from '@/features/site/SiteSettingsProvider'
import { BugReportWidget } from '@/features/bugs/BugReportWidget'
import { useBugReportSummary } from '@/features/bugs/bugs.queries'
import { BarChart3, Bell, BookOpen, Bug, ClipboardList, Library, LogOut, Menu, Settings, Users, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const site = useSite()
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <img
        src={site.logoUrl || '/logo.png'}
        alt={site.brandName}
        className="size-9 shrink-0 rounded-full bg-white object-contain shadow-[0_2px_8px_rgba(43,138,156,0.18)]"
      />
      {!compact && (
        <div className="hidden sm:block">
          <p className="text-[15px] font-bold leading-none tracking-tight text-ink">{site.brandName}</p>
          <p className="mt-0.5 text-[9px] font-semibold tracking-[0.2em] text-gold-deep uppercase">{site.slogan}</p>
        </div>
      )}
    </div>
  )
}

export function SiteFooter() {
  const site = useSite()
  return (
    <footer className="mt-12 border-t border-gold/40 bg-cream text-ink">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-3">
        <div>
          <BrandMark />
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink/65">{site.footerAbout}</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-gold-deep uppercase">{site.supportHeading}</p>
          <p className="mt-3 whitespace-pre-line text-sm text-ink/70">{site.supportDetail}</p>
          {site.phone ? <p className="mt-1 text-sm text-ink/70">Hotline: {site.phone}{site.hours ? ` (${site.hours})` : ''}</p> : null}
          {site.address ? <p className="mt-1 text-sm text-ink/70">{site.address}</p> : null}
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-gold-deep uppercase">{site.channelHeading}</p>
          <p className="mt-3 whitespace-pre-line text-sm text-ink/70">{site.channelDetail}</p>
          {site.legalNote ? <p className="mt-4 text-xs text-ink/40">{site.legalNote}</p> : null}
        </div>
      </div>
      <div className="border-t border-gold/30 px-6 py-4 text-center text-xs text-ink/40">{site.copyright}</div>
    </footer>
  )
}

const studentNav = [
  { to: '/dashboard', label: 'Tổng Quan' },
  { to: '/study', label: 'Học Tập' },
  { to: '/practice', label: 'Luyện Tập ETS L&R' },
  { to: '/assignments', label: 'Bài Tập' },
  { to: '/progress', label: 'Tiến Độ' },
]

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)) || '?').toUpperCase()
}

export function StudentShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function signOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-gold/30 bg-white/95 text-ink backdrop-blur-md">
        {/* ─── Main row: fixed height 60px ─── */}
        <div className="mx-auto flex h-[60px] max-w-7xl items-center gap-4 px-4 sm:px-6">

          {/* Logo */}
          <Link to="/dashboard" className="flex shrink-0 items-center no-underline cursor-pointer">
            <BrandMark />
          </Link>

          {/* Divider */}
          <div className="hidden h-6 w-px shrink-0 bg-gold/40 lg:block" />

          {/* Nav links – nowrap to stop text wrapping */}
          <nav className="hidden min-w-0 items-center gap-0.5 lg:flex">
            {studentNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-gold-deep text-white'
                      : 'text-ink/65 hover:bg-teal-soft hover:text-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex shrink-0 items-center gap-2">

            {/* Search – thu nhỏ mặc định, bấm để kéo giãn */}
            <HeaderSearch />

            {/* Bell */}
            <button
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-white text-ink/60 transition hover:border-gold-deep hover:text-gold-deep"
              type="button"
              aria-label="Thông báo"
            >
              <Bell className="size-4" />
            </button>

            {/* Tài khoản: cài đặt + đăng xuất */}
            <UserMenu
              name={user?.fullName ?? ''}
              code={user?.studentCode ?? user?.username ?? ''}
              initials={initialsOf(user?.fullName ?? '?')}
              onSignOut={() => void signOut()}
            />

            {/* Hamburger – mobile / tablet */}
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-white lg:hidden"
              type="button"
              aria-label="Mở menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {/* ─── Mobile drawer ─── */}
        {open && (
          <div className="border-t border-gold/25 bg-white px-4 pb-3 pt-2 lg:hidden">
            {studentNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-gold-deep text-white' : 'text-ink/75 hover:bg-paper',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <hr className="my-2 border-gold/20" />
            <NavLink
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink/75 hover:bg-paper"
            >
              <Settings className="size-4" /> Cài đặt cá nhân
            </NavLink>
            <button
              className="mt-1 flex w-full items-center gap-2 rounded-xl justify-center bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
              type="button"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
              Đăng xuất
            </button>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter />
      <BugReportWidget />
    </div>
  )
}

const adminNav = [
  { to: '/admin', label: 'Quản lý học viên', short: 'Học viên', icon: Users, end: true },
  { to: '/admin/exams', label: 'Kho đề', short: 'Kho đề', icon: BookOpen, end: false },
  { to: '/admin/assignments', label: 'Bài tập', short: 'Bài tập', icon: ClipboardList, end: false },
  { to: '/admin/reports', label: 'Báo cáo', short: 'Báo cáo', icon: BarChart3, end: false },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const roleLabel = user?.role === 'ADMIN' ? 'Quản trị viên' : 'Giáo viên'
  const bugs = useBugReportSummary(user?.role === 'ADMIN')
  const openCount = bugs.data?.openCount ?? 0
  const grants = user?.permissions
  const teacherNav = adminNav.filter((item) => {
    if (user?.role === 'ADMIN') return true
    if (item.to === '/admin/exams') return !!grants?.manageAssignments
    if (item.to === '/admin/assignments') return !!grants?.manageAssignments || !!grants?.viewProgress
    if (item.to === '/admin/reports') return !!grants?.viewProgress
    return true
  })
  const nav =
    user?.role === 'ADMIN'
      ? [
          ...teacherNav,
          { to: '/admin/study', label: 'Học liệu', short: 'Học liệu', icon: Library, end: false },
          { to: '/admin/bugs', label: openCount ? `Báo lỗi (${openCount})` : 'Báo lỗi', short: 'Lỗi', icon: Bug, end: false },
          { to: '/admin/settings', label: 'Cài đặt', short: 'Cài đặt', icon: Settings, end: false },
        ]
      : teacherNav

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  async function signOut() {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen overflow-x-hidden text-ink">
      <header className="sticky top-0 z-30 border-b border-gold/30 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link to="/admin" className="flex min-w-0 shrink-0 items-center no-underline cursor-pointer">
            <BrandMark />
          </Link>
          <div className="hidden h-6 w-px shrink-0 bg-gold/40 lg:block" />
          <p className="hidden whitespace-nowrap text-[11px] font-semibold tracking-[0.18em] text-gold-deep uppercase xl:block">
            Cổng quản lý đào tạo
          </p>
          <nav className="ml-2 hidden min-w-0 items-center gap-0.5 lg:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                    isActive ? 'bg-gold-deep text-white' : 'text-ink/65 hover:bg-teal-soft hover:text-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden leading-none text-right md:block">
              <p className="max-w-[160px] truncate text-[13px] font-semibold">{user?.fullName}</p>
              <p className="mt-0.5 text-[10px] text-gold-deep">{roleLabel}</p>
            </div>
            <button
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-red-700 lg:flex"
              type="button"
              onClick={() => void signOut()}
            >
              <LogOut className="size-3.5" />
              Đăng xuất
            </button>
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-white lg:hidden"
              type="button"
              aria-label={open ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {open ? (
          <div className="border-t border-gold/25 bg-white px-4 pb-3 pt-2 lg:hidden">
            <p className="px-3 py-2 text-xs text-ink/50">
              {user?.fullName}
              {user?.username ? ` · ${user.username}` : ''}
            </p>
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-gold-deep text-white' : 'text-ink/75 hover:bg-paper',
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
            <hr className="my-2 border-gold/20" />
            <button
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              type="button"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
              Đăng xuất
            </button>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/30 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Menu quản lý"
      >
        <div className={cn('mx-auto grid max-w-[1400px]', nav.length >= 6 ? 'grid-cols-6' : nav.length > 4 ? 'grid-cols-5' : 'grid-cols-4')}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-gold-deep' : 'text-ink/50 hover:text-ink',
                )
              }
            >
              <item.icon className="size-5" />
              {item.short}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
