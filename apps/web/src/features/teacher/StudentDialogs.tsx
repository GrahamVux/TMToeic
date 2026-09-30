import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Primitives'
import { ApiError } from '@/lib/api'
import { createStudentSchema, type CredentialsIssuedDto, type UserDto } from '@toeic/shared'
import { useState, type FormEvent } from 'react'
import { useCreateStudent, useResetPassword, useSetUserStatus } from './users.queries'

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-coral">{message}</p> : null
}

/** Temporary password is returned by the API exactly once — keep the dialog open until the teacher confirms they noted it. */
export function CredentialsDialog({ issued, title, onClose }: { issued: CredentialsIssuedDto; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const loginId = issued.user.studentCode ?? issued.user.username
  const text = `Mã đăng nhập: ${loginId}\nMật khẩu tạm: ${issued.temporaryPassword}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} dismissible={false}>
      <p className="text-sm text-ink/65">
        Gửi thông tin này cho <span className="font-semibold">{issued.user.fullName}</span>. Học viên sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.
      </p>
      <dl className="mt-4 space-y-3 rounded-xl bg-paper p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink/55">Mã đăng nhập</dt>
          <dd className="font-mono font-semibold">{loginId}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink/55">Mật khẩu tạm</dt>
          <dd className="font-mono font-semibold select-all" data-testid="temp-password">{issued.temporaryPassword}</dd>
        </div>
      </dl>
      <p className="mt-3 rounded-xl bg-[#f8e7c9] px-3 py-2 text-xs text-warn">
        Mật khẩu này chỉ hiển thị một lần. Nếu đóng hộp thoại mà chưa ghi lại, bạn cần cấp lại mật khẩu mới.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="paper" onClick={() => void copy()}>{copied ? 'Đã sao chép ✓' : 'Sao chép'}</Button>
        <Button onClick={onClose}>Đã ghi lại</Button>
      </div>
    </Modal>
  )
}

export function CreateStudentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (issued: CredentialsIssuedDto) => void }) {
  const create = useCreateStudent()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', targetScore: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = createStudentSchema.safeParse({
      fullName: form.fullName,
      ...(form.email.trim() ? { email: form.email } : {}),
      ...(form.phone.trim() ? { phone: form.phone } : {}),
      ...(form.targetScore.trim() ? { targetScore: Number(form.targetScore) } : {}),
    })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message
      setErrors(next)
      return
    }
    setErrors({})
    try {
      onCreated(await create.mutateAsync(parsed.data))
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields)
        if (Object.keys(err.fields).length === 0) setFormError(err.message)
      } else setFormError('Đã có lỗi xảy ra, vui lòng thử lại.')
    }
  }

  return (
    <Modal title="Thêm học viên" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-3">
        <div>
          <label htmlFor="cs-name" className="text-sm font-medium">Họ và tên *</label>
          <Input id="cs-name" className="mt-1" value={form.fullName} onChange={set('fullName')} autoFocus />
          <FieldError message={errors.fullName} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="cs-email" className="text-sm font-medium">Email</label>
            <Input id="cs-email" className="mt-1" type="email" value={form.email} onChange={set('email')} />
            <FieldError message={errors.email} />
          </div>
          <div>
            <label htmlFor="cs-phone" className="text-sm font-medium">Số điện thoại</label>
            <Input id="cs-phone" className="mt-1" value={form.phone} onChange={set('phone')} />
            <FieldError message={errors.phone} />
          </div>
        </div>
        <div>
          <label htmlFor="cs-target" className="text-sm font-medium">Điểm mục tiêu</label>
          <Input id="cs-target" className="mt-1" inputMode="numeric" placeholder="VD: 850" value={form.targetScore} onChange={set('targetScore')} />
          <FieldError message={errors.targetScore} />
        </div>
        <p className="text-xs text-ink/50">Mã học viên và mật khẩu tạm sẽ được hệ thống tạo tự động.</p>
        {formError && <p role="alert" className="rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral">{formError}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Đang tạo…' : 'Tạo học viên'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/** Reset-password + disable/enable with confirmation. Shared by the student list and the detail page. */
export function AccountActions({ user, compact = false }: { user: UserDto; compact?: boolean }) {
  const reset = useResetPassword()
  const setStatus = useSetUserStatus()
  const [confirm, setConfirm] = useState<'reset' | 'status' | null>(null)
  const [issued, setIssued] = useState<CredentialsIssuedDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const disabled = user.status === 'DISABLED'
  const busy = reset.isPending || setStatus.isPending

  async function run() {
    setError(null)
    try {
      if (confirm === 'reset') setIssued(await reset.mutateAsync(user.id))
      else await setStatus.mutateAsync({ id: user.id, status: disabled ? 'ACTIVE' : 'DISABLED' })
      setConfirm(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại.')
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="paper" className={compact ? 'px-3 py-1.5 text-xs' : ''} onClick={() => setConfirm('reset')}>Cấp lại MK</Button>
        <Button variant={disabled ? 'teal' : 'ghost'} className={compact ? 'px-3 py-1.5 text-xs' : ''} onClick={() => setConfirm('status')}>
          {disabled ? 'Mở khóa' : 'Khóa'}
        </Button>
      </div>

      {confirm && (
        <Modal title={confirm === 'reset' ? 'Cấp lại mật khẩu?' : disabled ? 'Mở khóa tài khoản?' : 'Khóa tài khoản?'} onClose={() => !busy && setConfirm(null)}>
          <p className="text-sm text-ink/65">
            {confirm === 'reset'
              ? `Mật khẩu hiện tại của ${user.fullName} sẽ bị vô hiệu, mọi thiết bị đang đăng nhập bị đăng xuất, và học viên phải đổi lại mật khẩu khi vào.`
              : disabled
                ? `${user.fullName} sẽ có thể đăng nhập lại.`
                : `${user.fullName} sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập cho đến khi được mở khóa. Dữ liệu học tập được giữ nguyên.`}
          </p>
          {error && <p role="alert" className="mt-3 rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral">{error}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Hủy</Button>
            <Button variant={confirm === 'status' && !disabled ? 'danger' : 'gold'} disabled={busy} onClick={() => void run()}>
              {busy ? 'Đang xử lý…' : 'Xác nhận'}
            </Button>
          </div>
        </Modal>
      )}

      {issued && <CredentialsDialog issued={issued} title="Mật khẩu tạm mới" onClose={() => setIssued(null)} />}
    </>
  )
}
