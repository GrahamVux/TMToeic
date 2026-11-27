import { AdminRecoveryDialog } from '@/features/auth/AdminRecoveryDialog'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Primitives'
import { useAuth } from '@/app/AuthContext'
import { useSite } from '@/features/site/SiteSettingsProvider'
import { ApiError } from '@/lib/api'
import { ERROR_CODES, homePathForRole, loginSchema } from '@toeic/shared'
import { PhoneCall } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const LOGIN_DENIED = new Set<string>([
  ERROR_CODES.INVALID_CREDENTIALS,
  ERROR_CODES.TOO_MANY_REQUESTS,
  ERROR_CODES.ACCOUNT_DISABLED,
  ERROR_CODES.UNAUTHENTICATED,
])

export function LoginPage() {
  const { login } = useAuth()
  const site = useSite()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [recover, setRecover] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFieldError(null)
    const parsed = loginSchema.safeParse({ identifier, password })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0].message)
      return
    }
    setBusy(true)
    try {
      const user = await login(parsed.data)
      navigate(user.mustChangePassword ? '/change-password' : (from ?? homePathForRole(user.role)), { replace: true })
    } catch (err) {
      const offline = err instanceof ApiError && (err.code === 'NETWORK' || err.status === 0 || err.status >= 500)
      if (offline) {
        setFieldError('Không kết nối được máy chủ. Hãy thử lại sau vài giây.')
        return
      }
      const deniedLogin =
        err instanceof ApiError &&
        (LOGIN_DENIED.has(err.code) || err.status === 401 || err.status === 403 || err.status === 429)
      if (deniedLogin) setDenied(true)
      else navigate('/error', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden text-ink">
      <div aria-hidden="true" className="h-[3px] w-full shrink-0 bg-linear-to-r from-button via-navy to-crimson" />
      <main className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
        <section className="relative min-w-0 overflow-hidden rounded-3xl border border-gold/50 bg-cream p-6 shadow-[0_24px_64px_rgba(15,23,42,0.16)] sm:p-9">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-button via-navy to-crimson" />
          <div className="flex items-center gap-4 border-b border-gold/35 pb-5">
            <img
              src={site.logoUrl || '/logo.png'}
              alt={site.brandName}
              className="size-14 shrink-0 rounded-2xl bg-[#ffffff] p-1.5 object-contain ring-2 ring-button/20 shadow-[0_8px_24px_rgba(20,56,153,0.22)] sm:size-16"
            />
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight tracking-tight text-navy sm:text-3xl">
                {site.brandName}
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-crimson px-3 py-0.5 text-xs font-bold tracking-[0.16em] text-white uppercase shadow-2xs dark:bg-red-600">
                {site.slogan}
              </span>
            </div>
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-button/25 bg-button-soft px-3.5 py-1 text-xs font-bold tracking-[0.14em] text-navy uppercase dark:border-sky-400/25">
            <span className="size-2 rounded-full bg-crimson" aria-hidden="true" />
            <span>Cổng học viên nội bộ</span>
          </div>

          <h1 className="serif mt-4 text-3xl font-extrabold leading-[1.18] break-words text-ink sm:text-4xl">
            {site.loginHeadline}
          </h1>
          <p className="mt-4 text-base leading-relaxed font-medium break-words text-ink/90">
            {site.loginIntro}
          </p>
        </section>

        <form
          noValidate
          className="relative min-w-0 overflow-hidden rounded-3xl border border-gold/50 bg-cream p-6 text-ink shadow-[0_24px_64px_rgba(15,23,42,0.16)] sm:p-9"
          onSubmit={submit}
        >
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-button via-navy to-crimson" />
          <p className="inline-flex items-center gap-1.5 rounded-full border border-crimson/20 bg-crimson-soft px-3 py-1 text-[13px] font-semibold tracking-[0.14em] text-crimson uppercase">
            Đăng nhập nội bộ
          </p>
          <h2 className="serif mt-3 text-3xl font-bold break-words">Xin chào trở lại</h2>
          <label className="mt-6 block text-sm font-semibold text-ink" htmlFor="login-id">Mã học viên / tên đăng nhập</label>
          <Input
            id="login-id"
            className="mt-2"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="VD: TM-1000"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="login-pw">Mật khẩu</label>
          <Input
            id="login-pw"
            className="mt-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldError ? (
            <p role="alert" className="mt-4 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
              {fieldError}
            </p>
          ) : null}
          <Button className="mt-6 w-full" type="submit" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
          <button
            type="button"
            onClick={() => setRecover(true)}
            className="mt-4 w-full text-center text-sm font-medium text-ink-soft underline-offset-2 hover:underline"
          >
            Quên mật khẩu quản trị?
          </button>
        </form>
      </main>

      <footer className="relative shrink-0 border-t border-gold/45 bg-cream/95 px-4 py-4 text-ink shadow-[0_-8px_28px_rgba(15,23,42,0.08)] backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2.5 text-center sm:flex-row sm:text-left">
          <p className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-ink sm:justify-start">
            <span className="inline-flex items-center gap-1.5 font-bold text-navy">
              <PhoneCall className="size-4 shrink-0 text-crimson" aria-hidden="true" />
              Quên mật khẩu hoặc tài khoản bị khóa?
            </span>
            <span>
              Liên hệ{' '}
              <strong className="inline-flex items-center rounded-full border border-crimson/25 bg-crimson-soft px-2.5 py-0.5 font-bold text-crimson tabular-nums">
                {site.phone || 'Thầy Minh'}
              </strong>{' '}
              để được cấp lại mật khẩu tạm.
            </span>
          </p>
          <p className="shrink-0 text-xs font-medium text-ink-soft">{site.copyright}</p>
        </div>
      </footer>

      {recover ? (
        <AdminRecoveryDialog
          onClose={() => setRecover(false)}
          onDone={(user) => navigate(user.mustChangePassword ? '/change-password' : homePathForRole(user.role), { replace: true })}
        />
      ) : null}

      {denied ? (
        <Modal title="Đăng nhập không thành công" onClose={() => setDenied(false)}>
          <p className="text-sm leading-7 text-ink-soft">
            Bạn đã nhập sai tên đăng nhập hoặc mật khẩu. Nếu không nhớ, xin vui lòng liên hệ{site.phone ? ` ${site.phone}` : ' Thầy Minh'} để được hỗ trợ.
          </p>
          <div className="mt-5 flex justify-end">
            <Button type="button" onClick={() => setDenied(false)}>
              Đã hiểu
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
