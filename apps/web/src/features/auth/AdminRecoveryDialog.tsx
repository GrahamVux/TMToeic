import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Primitives'
import { ApiError } from '@/lib/api'
import { PASSWORD_MIN_LENGTH, recoverAdminPasswordSchema, type UserDto } from '@toeic/shared'
import { useState, type FormEvent } from 'react'

/** Admin sets a new password with the recovery code, without knowing the current one. */
export function AdminRecoveryDialog({ onClose, onDone }: { onClose: () => void; onDone: (user: UserDto) => void }) {
  const { recoverAdmin } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = recoverAdminPasswordSchema.safeParse({ identifier, recoveryCode, newPassword })
    const next: Record<string, string> = {}
    if (!parsed.success) for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message
    if (newPassword !== confirm) next.confirm = 'Mật khẩu nhập lại không khớp'
    setErrors(next)
    if (!parsed.success || Object.keys(next).length > 0) return

    setBusy(true)
    try {
      onDone(await recoverAdmin(parsed.data))
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields)
        if (Object.keys(err.fields).length === 0) setFormError(err.message)
      } else setFormError('Đã có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Khôi phục mật khẩu quản trị" onClose={onClose}>
      <p className="text-sm leading-6 text-ink-soft">
        Dành cho tài khoản quản trị khi quên mật khẩu. Nhập mã khôi phục cùng mật khẩu mới.
      </p>
      <form noValidate className="mt-4 space-y-3" onSubmit={submit}>
        <div>
          <label className="text-sm font-medium" htmlFor="recover-id">Tên đăng nhập</label>
          <Input id="recover-id" className="mt-1.5" autoComplete="username" autoCapitalize="none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <FieldError message={errors.identifier} />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="recover-code">Mã khôi phục</label>
          <Input id="recover-code" className="mt-1.5" type="password" autoComplete="off" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} />
          <FieldError message={errors.recoveryCode} />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="recover-new">Mật khẩu mới</label>
          <Input id="recover-new" className="mt-1.5" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <p className="mt-1 text-xs text-ink-soft">Tối thiểu {PASSWORD_MIN_LENGTH} ký tự, gồm cả chữ và số.</p>
          <FieldError message={errors.newPassword} />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="recover-confirm">Nhập lại mật khẩu mới</label>
          <Input id="recover-confirm" className="mt-1.5" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <FieldError message={errors.confirm} />
        </div>
        {formError ? (
          <p role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</p>
        ) : null}
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
        </Button>
      </form>
    </Modal>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-coral">{message}</p> : null
}
