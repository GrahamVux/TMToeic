import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Primitives'
import { ApiError } from '@/lib/api'
import { changePasswordSchema, PASSWORD_MIN_LENGTH } from '@toeic/shared'
import { useState, type FormEvent } from 'react'

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-coral">{message}</p> : null
}

/**
 * Change-password form shared by the forced first-login screen and Settings.
 * Validates with the same Zod schema as the API (single source of truth).
 */
export function ChangePasswordForm({
  onSubmit,
  submitLabel = 'Đổi mật khẩu',
  onDone,
}: {
  onSubmit: (input: { currentPassword: string; newPassword: string }) => Promise<unknown>
  submitLabel?: string
  onDone?: () => void
}) {
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handle(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setDone(false)

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword })
    const next: Record<string, string> = {}
    if (!parsed.success) for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message
    if (newPassword !== confirm) next.confirm = 'Mật khẩu nhập lại không khớp'
    setErrors(next)
    if (Object.keys(next).length > 0 || !parsed.success) return

    setBusy(true)
    try {
      await onSubmit(parsed.data)
      setCurrent('')
      setNew('')
      setConfirm('')
      setDone(true)
      onDone?.()
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
    <form onSubmit={handle} noValidate className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="cp-current">Mật khẩu hiện tại</label>
        <Input id="cp-current" className="mt-1.5" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
        <FieldError message={errors.currentPassword} />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="cp-new">Mật khẩu mới</label>
        <Input id="cp-new" className="mt-1.5" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
        <p className="mt-1 text-xs text-ink/50">Tối thiểu {PASSWORD_MIN_LENGTH} ký tự, gồm cả chữ và số.</p>
        <FieldError message={errors.newPassword} />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="cp-confirm">Nhập lại mật khẩu mới</label>
        <Input id="cp-confirm" className="mt-1.5" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <FieldError message={errors.confirm} />
      </div>
      {formError && (
        <p role="alert" className="rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral">{formError}</p>
      )}
      {done && <p role="status" className="text-sm text-olive">Đã đổi mật khẩu thành công ✓</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Đang xử lý…' : submitLabel}
      </Button>
    </form>
  )
}
