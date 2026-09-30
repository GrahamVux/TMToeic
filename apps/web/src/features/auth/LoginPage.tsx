import { BrandMark } from '@/components/layout/Shell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Primitives'
import { useAuth } from '@/app/AuthContext'
import { ApiError } from '@/lib/api'
import { homePathForRole, loginSchema } from '@toeic/shared'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = loginSchema.safeParse({ identifier, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setBusy(true)
    try {
      const user = await login(parsed.data)
      navigate(user.mustChangePassword ? '/change-password' : (from ?? homePathForRole(user.role)), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(185,228,236,0.7),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(232,246,249,0.95),transparent_40%)]" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-2">
        <div>
          <BrandMark />
          <h1 className="serif mt-10 max-w-xl text-5xl leading-tight">Cổng học viên nội bộ lớp TOEIC 800+</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink/65">
            Tài khoản do Thầy Minh cấp phát — không đăng ký công khai. Luyện Listening, Reading, từ vựng, ngữ pháp và theo dõi tiến độ theo lộ trình lớp K42.
          </p>
          <p className="mt-8 max-w-md text-sm text-ink/55">
            Quên mật khẩu hoặc tài khoản bị khóa? Liên hệ Thầy Minh / trợ giảng để được cấp lại mật khẩu tạm.
          </p>
        </div>
        <form
          noValidate
          className="rounded-3xl border border-gold/40 bg-cream p-8 text-ink shadow-[0_20px_60px_rgba(43,138,156,0.12)]"
          onSubmit={submit}
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-deep uppercase">Đăng nhập nội bộ</p>
          <h2 className="serif mt-2 text-3xl">Xin chào trở lại</h2>
          <label className="mt-6 block text-sm font-medium" htmlFor="login-id">Mã học viên / tên đăng nhập</label>
          <Input
            id="login-id"
            className="mt-2"
            autoComplete="username"
            autoCapitalize="none"
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
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral">
              {error}
            </p>
          )}
          <Button className="mt-6 w-full" type="submit" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  )
}
