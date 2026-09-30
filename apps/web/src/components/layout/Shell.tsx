import { useAuth } from '@/app/AuthContext'
import { cn } from '@/lib/cn'
import { HeaderSearch } from '@/components/layout/HeaderSearch'
import { UserMenu } from '@/components/layout/UserMenu'
import { Bell, LogOut, Menu, Settings, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <img
        src="/logo.png"
        alt="MR.MINH TOEIC"
        className="size-9 shrink-0 rounded-full bg-white object-contain shadow-[0_2px_8px_rgba(43,138,156,0.18)]"
      />
      {!compact && (
        <div className="hidden sm:block">
          <p className="text-[15px] font-bold leading-none tracking-tight text-ink">MR. MINH TOEIC</p>
          <p className="mt-0.5 text-[9px] font-semibold tracking-[0.2em] text-gold-deep uppercase">Lớp học nội bộ</p>
        </div>
      )}
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-gold/40 bg-cream text-ink">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-3">
        <div>
          <BrandMark />
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink/65">
            Cổng luyện đề và học tập trực tuyến độc quyền cho học viên khoá TOEIC 800+. Tài khoản do Thầy Minh cấp phát và quản lý học vụ.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-gold-deep uppercase">Hỗ trợ học tập & trợ giảng</p>
          <p className="mt-3 text-sm text-ink/70">Thầy Minh (Trực tiếp): giải đáp bài khó & chữa đề chuyên sâu</p>
          <p className="mt-1 text-sm text-ink/70">Hotline lớp: 0988.xxx.888 (8:00 – 22:00)</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-gold-deep uppercase">Kênh trao đổi lớp học</p>
          <p className="mt-3 text-sm text-ink/70">Group Zalo Lớp K42 (Nhận thông báo)</p>
          <p className="mt-1 text-sm text-ink/70">Kho tài liệu Drive độc quyền Thầy Minh</p>
          <p className="mt-4 text-xs text-ink/40">Mã bảo mật lớp: TM-K42-INTERNAL • Hệ thống phân tích chuẩn ETS</p>
        </div>
      </div>
      <div className="border-t border-gold/30 px-6 py-4 text-center text-xs text-ink/40">
        © 2026 MR. MINH TOEIC Academy • Cổng học viên nội bộ lớp học.
      </div>
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
    </div>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = [
    { to: '/admin', label: 'Quản lý học viên' },
    { to: '/admin/exams', label: 'Kho đề' },
    { to: '/admin/reports', label: 'Báo cáo' },
  ]
  return (
    <div className="min-h-screen text-ink">
      <header className="border-b border-gold/30 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[60px] max-w-[1400px] items-center gap-4 px-6">
          <Link to="/admin" className="flex shrink-0 items-center no-underline cursor-pointer">
            <BrandMark />
          </Link>
          <div className="hidden h-6 w-px shrink-0 bg-gold/40 md:block" />
          <p className="hidden whitespace-nowrap text-[11px] font-semibold tracking-[0.18em] text-gold-deep uppercase md:block">Cổng quản lý đào tạo</p>
          <nav className="ml-2 hidden items-center gap-0.5 lg:flex">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
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
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="leading-none text-right">
              <p className="whitespace-nowrap text-[13px] font-semibold">{user?.fullName}</p>
              <p className="mt-0.5 whitespace-nowrap text-[10px] text-gold-deep">{user?.role === 'ADMIN' ? 'Quản trị viên' : 'Giáo viên'}</p>
            </div>
            <div className="h-5 w-px bg-gold/35" />
            <button
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-red-700"
              type="button"
              onClick={() => {
                void logout().then(() => navigate('/login', { replace: true }))
              }}
            >
              <LogOut className="size-3.5" />
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </div>
  )
}
