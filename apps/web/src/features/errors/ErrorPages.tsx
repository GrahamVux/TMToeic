import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { BrandMark } from '@/components/layout/Shell'
import { ApiError } from '@/lib/api'
import { ERROR_CODES, homePathForRole } from '@toeic/shared'
import { AlertTriangle, Search } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

export function errorLocation(err: unknown): '/404' | '/error' {
  if (err instanceof ApiError && (err.status === 404 || err.code === ERROR_CODES.NOT_FOUND)) return '/404'
  return '/error'
}

export function QueryErrorRedirect({ error }: { error: unknown }) {
  return <Navigate to={errorLocation(error)} replace />
}

function SupportHomeLink() {
  const { user } = useAuth()
  const to = user ? homePathForRole(user.role) : '/login'
  return (
    <Link to={to}>
      <Button variant="gold">{user ? 'Về trang chủ' : 'Về trang đăng nhập'}</Button>
    </Link>
  )
}

function ErrorShell({
  code,
  icon,
  title,
  body,
}: {
  code: string
  icon: ReactNode
  title: string
  body: string
}) {
  const navigate = useNavigate()
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(185,228,236,0.7),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(232,246,249,0.95),transparent_40%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <BrandMark />
        <div className="mt-10 rounded-3xl border border-gold/40 bg-cream p-8 text-center shadow-[0_20px_60px_rgba(43,138,156,0.12)]">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-teal-soft text-gold-deep">{icon}</div>
          <p className="mt-4 text-xs font-semibold text-gold-deep uppercase">{code}</p>
          <h1 className="serif mt-2 text-3xl">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-ink/65">{body}</p>
          <p className="mt-4 text-sm text-ink/55">Nếu cần hỗ trợ, vui lòng liên hệ Thầy Minh.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="navy" onClick={() => navigate(-1)}>
              Quay lại
            </Button>
            <SupportHomeLink />
          </div>
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <ErrorShell
      code="404"
      icon={<Search className="size-6" />}
      title="Không tìm thấy trang"
      body="Đường dẫn này không tồn tại hoặc nội dung đã được chuyển đi. Hãy quay lại trang trước hoặc về trang chủ để tiếp tục."
    />
  )
}

export function SystemErrorPage() {
  return (
    <ErrorShell
      code="Lỗi hệ thống"
      icon={<AlertTriangle className="size-6" />}
      title="Đã có sự cố"
      body="Hệ thống đang gặp trở ngại. Vui lòng thử lại sau. Không cần lo — bài làm đã lưu vẫn còn trên máy chủ."
    />
  )
}

/** Catches render crashes so the stack never reaches the student. */
class CrashBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Intentionally not rendering the error object.
  }

  render() {
    if (this.state.failed) return <Navigate to="/error" replace />
    return this.props.children
  }
}

/** Remounts on navigation so a recovered user is not stuck on the error screen. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <CrashBoundary key={location.pathname}>{children}</CrashBoundary>
}
