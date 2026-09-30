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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(185,228,236,0.7),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(232,246,249,0.95),transparent_40%)]" />
      <div className="relative w-full max-w-md">
        <BrandMark />
        <div className="mt-8 rounded-3xl border border-gold/40 bg-cream p-8 shadow-[0_20px_60px_rgba(43,138,156,0.12)]">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-deep uppercase">Lần đăng nhập đầu tiên</p>
          <h1 className="serif mt-2 text-3xl">Đặt mật khẩu mới</h1>
          <p className="mt-2 mb-6 text-sm text-ink/60">
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
            className="mt-4 w-full text-center text-sm text-ink/55 underline-offset-2 hover:underline"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
