import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { FilePick } from '@/components/ui/FilePick'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Primitives'
import { ApiError, downloadApiFile } from '@/lib/api'
import { DEFAULT_NEW_ACCOUNT_PASSWORD, type CredentialsIssuedDto, type TeacherPermissions, type UserDto } from '@toeic/shared'
import { useState, type FormEvent } from 'react'
import { useCreateStaff, useCreateStudent, useImportStudents, useResetPassword, useSetUserStatus, useTeachers, useUpdateTeacherPermissions } from './users.queries'

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
        Gửi thông tin này cho <span className="font-semibold">{issued.user.fullName}</span>. Lần đăng nhập đầu tiên phải đổi mật khẩu.
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

export function ImportStudentsDialog({
  classId,
  className,
  onClose,
  onDone,
}: {
  classId: string
  className: string
  onClose: () => void
  onDone: (result: { created: number; skipped: number }) => void
}) {
  const importStudents = useImportStudents()
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal title={`Thêm học viên vào ${className}`} onClose={onClose}>
      <p className="text-sm text-ink/65">
        File gồm cột <span className="font-semibold">Họ tên</span> và <span className="font-semibold">Số điện thoại</span>. Học viên mới vào lớp {className}. Có thể tải file này nhiều lần.
      </p>
      <p className="mt-2 text-sm text-ink/65">
        Mật khẩu mặc định của mọi tài khoản mới là <span className="font-mono font-semibold">{DEFAULT_NEW_ACCOUNT_PASSWORD}</span>. Lần đăng nhập đầu phải đổi mật khẩu.
      </p>
      <button
        type="button"
        className="mt-3 text-sm font-semibold text-gold-deep underline underline-offset-4"
        onClick={() => {
          setError(null)
          void downloadApiFile('/users/students/template', 'mau-hoc-vien.xlsx').catch((err: unknown) => {
            setError(err instanceof ApiError ? err.message : 'Không tải được file mẫu.')
          })
        }}
      >
        Tải file mẫu
      </button>
      <div className="mt-4">
        <FilePick
          label={importStudents.isPending ? 'Đang tạo tài khoản…' : 'Chọn file .xlsx'}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={importStudents.isPending}
          hint="Tối đa 500 học viên, 8MB. Số trùng trong cùng file được bỏ qua."
          onFiles={(files) => {
            const file = files[0]
            if (!file) return
            setError(null)
            void importStudents.mutateAsync({ file, classId }).then(onDone, (err) => {
              setError(err instanceof ApiError ? err.message : 'Không nhập được file.')
            })
          }}
        />
      </div>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral">{error}</p> : null}
      <div className="mt-5 flex justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
      </div>
    </Modal>
  )
}

export function AddOneStudentDialog({
  classId,
  className,
  onClose,
  onIssued,
}: {
  classId: string
  className: string
  onClose: () => void
  onIssued: (issued: CredentialsIssuedDto) => void
}) {
  const create = useCreateStudent()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      onIssued(await create.mutateAsync({ fullName: fullName.trim(), phone: phone.trim(), classId }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được học viên.')
    }
  }

  return (
    <Modal title={`Thêm một học viên vào ${className}`} onClose={() => !create.isPending && onClose()}>
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <p className="text-sm text-ink/65">
          Mật khẩu mặc định là <span className="font-mono font-semibold">{DEFAULT_NEW_ACCOUNT_PASSWORD}</span>. Có thể thêm tiếp sau khi đóng hộp thoại.
        </p>
        <div>
          <label className="text-sm font-medium" htmlFor="student-name">Họ và tên</label>
          <Input id="student-name" className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="student-phone">Số điện thoại</label>
          <Input id="student-phone" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={6} />
        </div>
        {error ? <p role="alert" className="rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral">{error}</p> : null}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}</Button>
        </div>
      </form>
    </Modal>
  )
}

/** Stays on the class card so Excel and single adds can be repeated. */
export function AddStudentActions({ classId, className, prominent = false }: { classId: string; className: string; prominent?: boolean }) {
  const [mode, setMode] = useState<'one' | 'excel' | null>(null)
  const [issued, setIssued] = useState<CredentialsIssuedDto | null>(null)
  const [note, setNote] = useState<string | null>(null)

  return (
    <div className={prominent ? undefined : 'mt-3'}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className={prominent ? undefined : 'px-3 py-1.5 text-xs'} onClick={() => setMode('one')}>
          {prominent ? '+ Thêm học viên' : 'Thêm lẻ'}
        </Button>
        <Button type="button" variant="paper" className={prominent ? undefined : 'px-3 py-1.5 text-xs'} onClick={() => setMode('excel')}>
          {prominent ? 'Nhập Excel' : 'Thêm từ Excel'}
        </Button>
      </div>
      {note ? <p className="mt-2 text-sm text-olive">{note}</p> : null}
      {mode === 'one' ? (
        <AddOneStudentDialog
          classId={classId}
          className={className}
          onClose={() => setMode(null)}
          onIssued={(next) => {
            setMode(null)
            setNote(`Đã thêm ${next.user.fullName} vào ${className}.`)
            setIssued(next)
          }}
        />
      ) : null}
      {mode === 'excel' ? (
        <ImportStudentsDialog
          classId={classId}
          className={className}
          onClose={() => setMode(null)}
          onDone={(result) => {
            setMode(null)
            setNote(`Đã tạo ${result.created} tài khoản vào ${className}${result.skipped ? `, bỏ qua ${result.skipped} dòng` : ''}. File tài khoản đã được tải về.`)
          }}
        />
      ) : null}
      {issued ? <CredentialsDialog issued={issued} title="Đã tạo tài khoản học viên" onClose={() => setIssued(null)} /> : null}
    </div>
  )
}

const GRANT_FIELDS: Array<{ key: keyof TeacherPermissions; label: string }> = [
  { key: 'createStudents', label: 'Tạo học viên' },
  { key: 'manageAssignments', label: 'Quản lý và giao bài tập' },
  { key: 'viewProgress', label: 'Xem tiến độ bài tập' },
]

export function TeacherAccessPanel() {
  const teachers = useTeachers()
  const create = useCreateStaff()
  const update = useUpdateTeacherPermissions()
  const [open, setOpen] = useState(false)
  const [issued, setIssued] = useState<CredentialsIssuedDto | null>(null)
  const [form, setForm] = useState({ username: '', fullName: '', createStudents: false, manageAssignments: false, viewProgress: false })
  const [formError, setFormError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    try {
      const res = await create.mutateAsync({
        username: form.username,
        fullName: form.fullName,
        role: 'TEACHER',
        permissions: {
          createStudents: form.createStudents,
          manageAssignments: form.manageAssignments,
          viewProgress: form.viewProgress,
        },
      })
      setOpen(false)
      setForm({ username: '', fullName: '', createStudents: false, manageAssignments: false, viewProgress: false })
      setIssued(res)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không tạo được tài khoản giáo viên.')
    }
  }

  return (
    <section id="tai-khoan-giao-vien" className="rounded-2xl border border-gold/35 bg-cream p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="serif text-2xl">Giáo viên</h2>
          <p className="mt-1 text-sm text-ink/60">Tạo tài khoản và bật từng quyền. Mật khẩu mặc định là {DEFAULT_NEW_ACCOUNT_PASSWORD}.</p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Thêm giáo viên</Button>
      </div>
      {teachers.isPending ? <p className="mt-4 text-sm text-ink/55">Đang tải…</p> : null}
      <ul className="mt-4 divide-y divide-gold/25">
        {(teachers.data?.items ?? []).map((teacher) => (
          <li key={teacher.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <AccountAvatar name={teacher.fullName} url={teacher.avatarUrl} frameId={teacher.avatarFrame} />{teacher.fullName}
              </p>
              <p className="text-xs text-ink/50">{teacher.username}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {GRANT_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={teacher.permissions[field.key]}
                    disabled={update.isPending}
                    onChange={(event) => {
                      void update.mutate({
                        id: teacher.id,
                        permissions: { ...teacher.permissions, [field.key]: event.target.checked },
                      })
                    }}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {open ? (
        <Modal title="Thêm giáo viên" onClose={() => !create.isPending && setOpen(false)}>
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            <div>
              <label className="text-sm font-medium" htmlFor="teacher-name">Họ và tên</label>
              <Input id="teacher-name" className="mt-1" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="teacher-user">Tên đăng nhập</label>
              <Input id="teacher-user" className="mt-1" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              {GRANT_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form[field.key]} onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.checked }))} />
                  {field.label}
                </label>
              ))}
            </div>
            {formError ? <p role="alert" className="rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral">{formError}</p> : null}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
      {issued ? <CredentialsDialog issued={issued} title="Đã tạo tài khoản giáo viên" onClose={() => setIssued(null)} /> : null}
    </section>
  )
}

/** Reset-password + disable/enable with confirmation. Shared by the student list and the detail page. */
export function AccountActions({ user, compact = false }: { user: UserDto; compact?: boolean }) {
  const { user: actor } = useAuth()
  const reset = useResetPassword()
  const setStatus = useSetUserStatus()
  const [confirm, setConfirm] = useState<'reset' | 'status' | null>(null)
  const [issued, setIssued] = useState<CredentialsIssuedDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const disabled = user.status === 'DISABLED'
  const busy = reset.isPending || setStatus.isPending
  if (actor?.role === 'TEACHER' && !actor.permissions.createStudents) return null

  async function run() {
    setError(null)
    try {
      if (confirm === 'reset') setIssued(await reset.mutateAsync(user.id))
      else await setStatus.mutateAsync({ id: user.id, status: disabled ? 'ACTIVE' : 'DISABLED' })
      setConfirm(null)
    } catch {
      setError('Không thực hiện được. Vui lòng thử lại.')
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
