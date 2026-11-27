import { useAuth } from '@/app/AuthContext'
import { cn } from '@/lib/cn'
import { HeaderSearch } from '@/components/layout/HeaderSearch'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { UserMenu } from '@/components/layout/UserMenu'
import { DarkModeSwitch } from '@/components/ui/DarkModeSwitch'
import { FrameWardrobeModal } from '@/features/honor/FrameWardrobeModal'
import { useColorMode, useSite } from '@/features/site/SiteSettingsProvider'
import { BugReportWidget } from '@/features/bugs/BugReportWidget'
import { useBugReportSummary } from '@/features/bugs/bugs.queries'
import { BarChart3, BookOpen, Bug, ChevronDown, ClipboardList, Coins, Eye, Library, LogOut, Menu, MoreHorizontal, Settings, Trophy, UserRound, Users, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const site = useSite()
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <img
        src={site.logoUrl || '/logo.png'}
        alt={site.brandName}
        className="size-10 shrink-0 rounded-full bg-cream object-contain ring-1 ring-ink/8 shadow-[0_2px_8px_rgba(20,56,153,0.16)]"
      />
      {!compact && (
        <div className="hidden sm:block">
          <p className="font-[family-name:var(--font-display)] text-[17px] font-bold leading-tight tracking-tight text-ink">{site.brandName}</p>
          <p className="mt-0.5 text-[13px] font-semibold tracking-[0.06em] text-crimson uppercase">{site.slogan}</p>
        </div>
      )}
    </div>
  )
}

export function SiteFooter() {
  const site = useSite()
  return (
    <footer className="relative mt-12 overflow-hidden border-t border-gold/40 bg-cream text-ink">
      <div aria-hidden="true" className="h-[2px] w-full bg-linear-to-r from-button/60 via-gold to-crimson/60" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 0% 100%, color-mix(in srgb, var(--color-button) 10%, transparent), transparent 28%), radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--color-crimson) 8%, transparent), transparent 24%)',
        }}
      />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-3">
        <div>
          <BrandMark />
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink-soft">{site.footerAbout}</p>
        </div>
        <div>
          <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">{site.supportHeading}</p>
          <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{site.supportDetail}</p>
          {site.phone ? <p className="mt-1 text-sm text-ink-soft">Hotline: {site.phone}{site.hours ? ` (${site.hours})` : ''}</p> : null}
          {site.address ? <p className="mt-1 text-sm text-ink-soft">{site.address}</p> : null}
        </div>
        <div>
          <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">{site.channelHeading}</p>
          <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{site.channelDetail}</p>
          {site.legalNote ? <p className="mt-4 text-xs text-ink-soft">{site.legalNote}</p> : null}
        </div>
      </div>
      <div className="relative border-t border-gold/30 px-6 py-4 text-center text-xs text-ink-soft">{site.copyright}</div>
    </footer>
  )
}

const studentNav = [
  { to: '/dashboard', label: 'Tổng Quan' },
  { to: '/study', label: 'Học Tập' },
  { to: '/practice', label: 'Luyện Tập ETS L&R' },
  { to: '/assignments', label: 'Bài Tập' },
  { to: '/honor', label: 'Xếp Hạng' },
  { to: '/progress', label: 'Tiến Độ' },
]

export function StudentShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const site = useSite()
  const { colorMode, toggleColorMode } = useColorMode()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [wardrobeOpen, setWardrobeOpen] = useState(false)

  async function signOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-gold/30 bg-cream/95 text-ink backdrop-blur-md">
        <div aria-hidden="true" className="h-[3px] w-full bg-linear-to-r from-button via-navy to-crimson" />
        {/* ─── Main row: fixed height 64px ─── */}
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2.5 px-4 sm:px-6 xl:gap-3.5">

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
                    'flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-[15px] font-medium transition-colors xl:px-3',
                    isActive
                      ? 'bg-button text-button-ink'
                      : 'text-ink-soft hover:bg-teal-soft hover:text-ink',
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

            {site.backgroundMode === 'sky' ? null : <DarkModeSwitch checked={colorMode === 'dark'} onToggle={toggleColorMode} scale={0.44} />}

            <NotificationBell />

            <button
              type="button"
              onClick={() => setWardrobeOpen(true)}
              className="hidden min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-300/80 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 transition hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25 sm:inline-flex"
              title="Ví điểm thưởng & Kho khung viền (Đổi quà sắp mở)"
            >
              <Coins className="size-3.5 text-amber-600 dark:text-amber-300" />
              <span className="tabular-nums">{(user?.rewardPoints ?? 0).toLocaleString('vi-VN')} điểm</span>
            </button>

            {/* Tài khoản: cài đặt + đăng xuất */}
            <UserMenu
              name={user?.fullName ?? ''}
              code={user?.studentCode ?? user?.username ?? ''}
              avatarUrl={user?.avatarUrl}
              avatarFrame={user?.avatarFrame}
              onSignOut={() => void signOut()}
            />

            {/* Hamburger – mobile / tablet */}
            <button
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-cream text-ink transition hover:border-gold-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 lg:hidden"
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
          <div className="border-t border-gold/25 bg-cream px-4 pb-3 pt-2 lg:hidden">
            {studentNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-button text-button-ink' : 'text-ink hover:bg-paper',
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
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
            >
              <Settings className="size-4" /> Cài đặt cá nhân
            </NavLink>
            <button
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-danger-soft/75 px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger-soft"
              type="button"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
              Đăng xuất
            </button>
          </div>
        )}
      </header>
      <main className="shell-main mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter />
      <BugReportWidget />
      <FrameWardrobeModal open={wardrobeOpen} initialTab="wallet" onClose={() => setWardrobeOpen(false)} />
    </div>
  )
}

const adminNav = [
  { to: '/admin', label: 'Học viên', short: 'Học viên', icon: Users, end: true },
  { to: '/admin/exams', label: 'Kho đề', short: 'Kho đề', icon: BookOpen, end: false },
  { to: '/admin/assignments', label: 'Bài tập', short: 'Bài tập', icon: ClipboardList, end: false },
  { to: '/admin/reports', label: 'Báo cáo', short: 'Báo cáo', icon: BarChart3, end: false },
  { to: '/admin/honor', label: 'Xếp hạng', short: 'Xếp hạng', icon: Trophy, end: false },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const site = useSite()
  const { colorMode, toggleColorMode } = useColorMode()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [deskMoreOpen, setDeskMoreOpen] = useState(false)
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
          { to: '/admin/view-as', label: 'Giả lập góc nhìn', short: 'Giả lập', icon: Eye, end: false },
          { to: '/admin/settings', label: 'Cài đặt', short: 'Cài đặt', icon: Settings, end: false },
        ]
      : teacherNav

  const mobilePrimaryPaths = ['/admin', '/admin/exams', '/admin/assignments', '/admin/settings']
  const mobilePrimary = mobilePrimaryPaths.flatMap((to) => nav.filter((item) => item.to === to))
  const mobileMore = nav.filter((item) => !mobilePrimaryPaths.includes(item.to))
  const moreActive = mobileMore.some((item) => (item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)))
  const desktopMorePaths = ['/admin/study', '/admin/bugs', '/admin/view-as', '/admin/settings']
  const desktopMain = nav.filter((item) => !desktopMorePaths.includes(item.to))
  const desktopMore = nav.filter((item) => desktopMorePaths.includes(item.to))
  const desktopMoreActive = desktopMore.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
  const mobileCols = mobilePrimary.length + (mobileMore.length > 0 ? 1 : 0)
  const mobileGrid =
    mobileCols >= 5 ? 'grid-cols-5' : mobileCols === 4 ? 'grid-cols-4' : mobileCols === 3 ? 'grid-cols-3' : mobileCols === 2 ? 'grid-cols-2' : 'grid-cols-1'

  useEffect(() => {
    setOpen(false)
    setMoreOpen(false)
    setDeskMoreOpen(false)
  }, [location.pathname])

  async function signOut() {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen overflow-x-hidden text-ink">
      <header className="sticky top-0 z-30 border-b border-gold/30 bg-cream/95 backdrop-blur-md">
        <div aria-hidden="true" className="h-[3px] w-full bg-linear-to-r from-button via-navy to-crimson" />
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link to="/admin" className="flex min-w-0 shrink-0 items-center no-underline cursor-pointer">
            <BrandMark />
          </Link>
          <div className="hidden h-6 w-px shrink-0 bg-gold/40 lg:block" />
          <p className="hidden whitespace-nowrap text-sm font-semibold tracking-[0.06em] text-gold-deep uppercase 2xl:block">
            Cổng quản lý đào tạo
          </p>
          <nav className="ml-2 hidden min-w-0 items-center gap-0.5 lg:flex">
            {desktopMain.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-full px-2.5 py-1.5 text-[15px] font-medium transition-colors xl:px-3',
                    isActive ? 'bg-button text-button-ink' : 'text-ink-soft hover:bg-teal-soft hover:text-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {desktopMore.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={deskMoreOpen}
                  className={cn(
                    'flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[15px] font-medium transition-colors',
                    desktopMoreActive || deskMoreOpen ? 'bg-button text-button-ink' : 'text-ink-soft hover:bg-teal-soft hover:text-ink',
                  )}
                  onClick={() => setDeskMoreOpen(!deskMoreOpen)}
                >
                  Khác
                  {openCount > 0 ? <span className="size-2 rounded-full bg-crimson" aria-label={`${openCount} báo lỗi chưa xử lý`} /> : null}
                  <ChevronDown className={cn('size-3.5 transition-transform', deskMoreOpen && 'rotate-180')} />
                </button>
                {deskMoreOpen ? (
                  <>
                    <button type="button" className="fixed inset-0 z-30" aria-label="Đóng menu Khác" onClick={() => setDeskMoreOpen(false)} />
                    <div className="absolute top-full left-0 z-40 mt-2 w-48 rounded-2xl border border-gold/30 bg-cream p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.16)]">
                      {desktopMore.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] font-medium',
                              isActive ? 'bg-button text-button-ink' : 'text-ink hover:bg-paper',
                            )
                          }
                        >
                          <item.icon className="size-4" />
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {site.backgroundMode === 'sky' ? null : <DarkModeSwitch checked={colorMode === 'dark'} onToggle={toggleColorMode} scale={0.44} />}
            <UserMenu
              name={user?.fullName ?? ''}
              subtitle={roleLabel}
              avatarUrl={user?.avatarUrl}
              avatarFrame={user?.avatarFrame}
              settingsPath="/admin/profile"
              menuItems={[
                { to: '/admin/profile', label: 'Tài khoản & Khung viền', icon: UserRound },
                ...(user?.role === 'ADMIN' ? [{ to: '/admin/settings', label: 'Cài đặt hệ thống', icon: Settings }] : []),
              ]}
              onSignOut={() => void signOut()}
            />
            <button
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-cream text-ink transition hover:border-gold-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 lg:hidden"
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
          <div className="border-t border-gold/25 bg-cream px-4 pb-3 pt-2 lg:hidden">
            <p className="px-3 py-2 text-xs text-ink-soft">
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
                    isActive ? 'bg-button text-button-ink' : 'text-ink hover:bg-paper',
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
            <hr className="my-2 border-gold/20" />
            <button
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-danger-soft/75 px-3 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-soft"
              type="button"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
              Đăng xuất
            </button>
          </div>
        ) : null}
      </header>

      <main className="shell-main mx-auto max-w-[1400px] px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8">{children}</main>

      {moreOpen ? (
        <button type="button" className="fixed inset-0 z-20 bg-slate-950/35 lg:hidden" aria-label="Đóng xem thêm" onClick={() => setMoreOpen(false)} />
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/30 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label="Menu quản lý"
      >
        {moreOpen && mobileMore.length > 0 ? (
          <div className="border-b border-gold/25 bg-cream px-3 py-2">
            {mobileMore.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold',
                    isActive ? 'bg-button text-button-ink' : 'text-ink hover:bg-paper',
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ) : null}
        <div className={cn('mx-auto grid max-w-[1400px]', mobileGrid)}>
          {mobilePrimary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[13px] font-semibold transition-colors',
                  isActive ? 'text-gold-deep' : 'text-ink-soft hover:text-ink',
                )
              }
            >
              <item.icon className="size-5" />
              {item.short}
            </NavLink>
          ))}
          {mobileMore.length > 0 ? (
            <button
              type="button"
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 text-[13px] font-semibold',
                moreOpen || moreActive ? 'text-gold-deep' : 'text-ink-soft',
              )}
              aria-expanded={moreOpen}
              aria-label="Xem thêm"
              onClick={() => setMoreOpen(!moreOpen)}
            >
              <MoreHorizontal className="size-5" />
              Xem thêm
            </button>
          ) : null}
        </div>
      </nav>
    </div>
  )
}
