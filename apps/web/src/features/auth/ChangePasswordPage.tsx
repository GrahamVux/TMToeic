import { useAuth } from '@/app/AuthContext'
import { BrandMark } from '@/components/layout/Shell'
import { ChangePasswordForm } from '@/features/auth/PasswordFields'
import { homePathForRole } from '@toeic/shared'
import { Navigate, useNavigate } from 'react-router-dom'

/** Forced screen after the first login with a temporary password. */
export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return <Navigate to="/login" replace />
  if (!user.mustChangePassword) return <Navigate to={homePathForRole(user.role)} replace />

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-paper px-6 py-12 text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-button via-navy to-crimson" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 site-wash" />
      <div className="relative w-full max-w-md">
        <BrandMark />
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-gold/40 bg-cream p-8 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-button via-navy to-crimson" />
          <p className="inline-flex items-center gap-1.5 rounded-full border border-button/20 bg-button-soft px-3 py-1 text-[13px] font-semibold tracking-[0.14em] text-navy uppercase dark:border-sky-400/25">
            <span className="size-1.5 rounded-full bg-crimson" aria-hidden="true" />
            Lần đăng nhập đầu tiên
          </p>
          <h1 className="serif mt-3 text-3xl font-bold">Đặt mật khẩu mới</h1>
          <p className="mt-2 mb-6 text-sm text-ink-soft">
            Xin chào {user.fullName}! Mật khẩu tạm do giáo viên cấp chỉ dùng một lần. Hãy tạo mật khẩu riêng để tiếp tục.
          </p>
          <ChangePasswordForm
            submitLabel="Lưu mật khẩu & vào cổng"
            onSubmit={async (input) => {
              const updated = await changePassword(input)
              navigate(homePathForRole(updated.role), { replace: true })
            }}
          />
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-4 w-full text-center text-sm text-ink-soft underline-offset-2 hover:underline"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
