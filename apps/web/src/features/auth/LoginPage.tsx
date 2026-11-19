import { AdminRecoveryDialog } from '@/features/auth/AdminRecoveryDialog'
import { BrandMark } from '@/components/layout/Shell'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Primitives'
import { useAuth } from '@/app/AuthContext'
import { useSite } from '@/features/site/SiteSettingsProvider'
import { ApiError } from '@/lib/api'
import { ERROR_CODES, homePathForRole, loginSchema } from '@toeic/shared'
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
    <div className="relative min-h-screen overflow-x-hidden bg-paper text-ink">
      <div className="pointer-events-none absolute inset-0 site-wash" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-2">
        <div className="min-w-0">
          <BrandMark />
          <h1 className="serif mt-8 max-w-xl text-3xl leading-tight break-words sm:mt-10 sm:text-5xl">{site.loginHeadline}</h1>
          <p className="mt-5 max-w-lg text-base leading-7 break-words text-ink/65">{site.loginIntro}</p>
          <p className="mt-8 max-w-md text-sm text-ink/55">
            Quên mật khẩu hoặc tài khoản bị khóa? Liên hệ{site.phone ? ` ${site.phone}` : ' Thầy Minh'} để được cấp lại mật khẩu tạm.
          </p>
        </div>
        <form
          noValidate
          className="min-w-0 rounded-3xl border border-gold/40 bg-cream p-5 text-ink shadow-[0_20px_60px_rgba(43,138,156,0.12)] sm:p-8"
          onSubmit={submit}
        >
          <p className="text-xs font-semibold tracking-[0.12em] break-words text-gold-deep uppercase sm:tracking-[0.2em]">Đăng nhập nội bộ</p>
          <h2 className="serif mt-2 text-3xl break-words">Xin chào trở lại</h2>
          <label className="mt-6 block text-sm font-medium" htmlFor="login-id">Mã học viên / tên đăng nhập</label>
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
          <label className="mt-4 block text-sm font-medium" htmlFor="login-pw">Mật khẩu</label>
          <Input
            id="login-pw"
            className="mt-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldError ? (
            <p role="alert" className="mt-4 rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral">
              {fieldError}
            </p>
          ) : null}
          <Button className="mt-6 w-full" type="submit" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
          <button
            type="button"
            onClick={() => setRecover(true)}
            className="mt-4 w-full text-center text-sm text-ink/55 underline-offset-2 hover:underline"
          >
            Quên mật khẩu quản trị?
          </button>
        </form>
      </div>

      {recover ? (
        <AdminRecoveryDialog
          onClose={() => setRecover(false)}
          onDone={(user) => navigate(user.mustChangePassword ? '/change-password' : homePathForRole(user.role), { replace: true })}
        />
      ) : null}

      {denied ? (
        <Modal title="Đăng nhập không thành công" onClose={() => setDenied(false)}>
          <p className="text-sm leading-7 text-ink/70">
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
