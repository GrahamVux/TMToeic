import { useAuth } from '@/app/AuthContext'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Input } from '@/components/ui/Primitives'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { ClassSummaryDto, UserDto } from '@toeic/shared'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AddStudentActions } from './StudentDialogs'
import { useAssignClass, useClasses, useCreateClass, useDeleteClass, useSetClassClosed, useSetClassTeachers, useStudents, useTeachers } from './users.queries'

export function CreateClassButton() {
  const create = useCreateClass()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await create.mutateAsync({ name })
      setName('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được lớp.')
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>+ Tạo lớp</Button>
      {open ? (
        <Modal title="Tạo lớp" onClose={() => !create.isPending && setOpen(false)}>
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            <p className="text-sm text-ink/65">Đặt tên lớp, rồi gán giáo viên và thêm học viên ở thẻ lớp vừa tạo.</p>
            <div>
              <label className="text-sm font-medium" htmlFor="class-name">Tên lớp</label>
              <Input id="class-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: K42 - TOEIC 850+" required minLength={2} autoFocus />
            </div>
            {error ? <p role="alert" className="rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral">{error}</p> : null}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={create.isPending || name.trim().length < 2}>{create.isPending ? 'Đang tạo…' : 'Tạo lớp'}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  )
}

export function ClassSwitcher({
  rooms,
  selectedId,
  onSelect,
}: {
  rooms: ClassSummaryDto[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = needle ? rooms.filter((room) => room.name.toLowerCase().includes(needle)) : []
  const selected = rooms.find((room) => room.id === selectedId) ?? null

  function pick(id: string) {
    setQuery('')
    onSelect(id)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ClassPill active={!selected} label="Xem tất cả" onClick={() => pick('')} />
          {selected ? (
            <span className="inline-flex min-w-0 max-w-[18rem] items-center rounded-full border border-button bg-button-soft px-3 py-1.5 text-sm font-semibold text-ink">
              <span className="truncate">{selected.closedAt ? `${selected.name} · đã đóng` : selected.name}</span>
            </span>
          ) : null}
        </div>
        <div className="w-full sm:w-72">
          <Input className="h-9" value={query} placeholder="Tìm lớp" aria-label="Tìm lớp" onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      {needle ? (
        shown.length === 0 ? (
          <p className="text-right text-sm text-ink/55">Không có lớp khớp “{query.trim()}”.</p>
        ) : (
          <div className="space-y-2">
            {shown.map((room) => (
              <div key={room.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{room.name}{room.closedAt ? ' · đã đóng' : ''}</p>
                  <p className="text-sm text-ink/55">{room.memberCount} học viên</p>
                </div>
                <Button type="button" variant={selectedId === room.id ? 'navy' : 'gold'} className="px-3 py-1.5 text-xs" onClick={() => pick(room.id)}>
                  Quản lý lớp
                </Button>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}

function ClassPill({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap',
        active ? 'border-gold-deep bg-button text-button-ink' : 'border-ink/10 bg-white text-ink/75 hover:border-gold-deep',
      )}
      onClick={onClick}
    >
      {label}
      {count !== undefined ? <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-white/20' : 'bg-paper-2 text-ink/55')}>{count}</span> : null}
    </button>
  )
}

export function ClassRooms({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const classes = useClasses()
  const rooms = classes.data ?? []
  const room = rooms.find((item) => item.id === selectedId) ?? null

  return (
    <section className="space-y-4">
      {classes.isPending ? <p className="text-sm text-ink/55">Đang tải lớp…</p> : null}
      {!classes.isPending && rooms.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-ink/70">Chưa có lớp. Bấm Tạo lớp, rồi gán giáo viên và thêm học viên.</p>
        </Card>
      ) : null}
      {rooms.length > 0 ? <ClassSwitcher rooms={rooms} selectedId={room?.id ?? ''} onSelect={onSelect} /> : null}
      {room ? <ClassWorkspace room={room} /> : rooms.length > 0 ? (
        <Card className="p-5">
          <p className="text-sm text-ink/70">Đang xem học viên của mọi lớp. Tìm tên lớp bên phải, rồi bấm Quản lý lớp để xem số học viên và tài khoản trong lớp đó.</p>
        </Card>
      ) : null}
    </section>
  )
}

function ClassWorkspace({ room }: { room: ClassSummaryDto }) {
  const teachers = useTeachers()
  const setTeachers = useSetClassTeachers()
  const setClosed = useSetClassClosed()
  const remove = useDeleteClass()
  const [editingTeachers, setEditingTeachers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const roster = teachers.data?.items ?? []

  function toggleTeacher(teacherId: string, on: boolean) {
    const current = room.teachers.map((teacher) => teacher.id)
    const teacherIds = on ? [...current, teacherId] : current.filter((id) => id !== teacherId)
    void setTeachers.mutate({ classId: room.id, teacherIds })
  }

  function run(action: 'close' | 'delete') {
    const nextClosed = !room.closedAt
    const ok = window.confirm(
      action === 'delete'
        ? `Xóa lớp “${room.name}”? Học viên không bị xóa tài khoản, chỉ ra khỏi lớp. Không hoàn tác được.`
        : nextClosed
          ? `Đóng lớp “${room.name}”? Lớp không nhận học viên mới. Tài khoản hiện tại vẫn giữ.`
          : `Mở lại lớp “${room.name}”?`,
    )
    if (!ok) return
    setError(null)
    const task = action === 'delete' ? remove.mutateAsync(room.id) : setClosed.mutateAsync({ classId: room.id, closed: nextClosed })
    void task.catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : action === 'delete' ? 'Không xóa được lớp.' : 'Không đổi được trạng thái lớp.')
    })
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="serif text-2xl">{room.name}</h2>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', room.closedAt ? 'bg-[#f8dcd8] text-coral' : 'bg-teal-soft text-gold-deep')}>
              {room.closedAt ? 'Đã đóng' : 'Đang mở'}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink/60">
            {room.memberCount} học viên · {room.teachers.length} giáo viên
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {room.closedAt ? <p className="text-sm text-ink/55">Lớp đã đóng nên không thêm học viên.</p> : <AddStudentActions classId={room.id} className={room.name} prominent />}
          <Button type="button" variant="paper" className="px-3 py-1.5 text-xs" disabled={setClosed.isPending || remove.isPending} onClick={() => run('close')}>
            {room.closedAt ? 'Mở lại lớp' : 'Đóng lớp'}
          </Button>
          <Button type="button" variant="danger" className="px-3 py-1.5 text-xs" disabled={setClosed.isPending || remove.isPending} onClick={() => run('delete')}>
            Xóa lớp
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {room.teachers.length === 0 ? <p className="text-sm text-ink/55">Chưa gán giáo viên cho lớp này.</p> : null}
        {room.teachers.map((teacher) => {
          const account = roster.find((item) => item.id === teacher.id)
          return (
            <div key={teacher.id} className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-white px-3 py-3">
              <AccountAvatar name={teacher.fullName} url={teacher.avatarUrl} frameId={teacher.avatarFrame} className="size-10 text-sm" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{teacher.fullName}</p>
                <p className="truncate text-xs text-ink/50">{account?.username ?? 'Giáo viên của lớp'}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4">
        <Button type="button" variant="navy" className="px-3 py-1.5 text-xs" onClick={() => setEditingTeachers((value) => !value)}>
          {editingTeachers ? 'Xong' : 'Sửa giáo viên của lớp'}
        </Button>
        {editingTeachers ? (
          roster.length === 0 ? <p className="mt-2 text-sm text-ink/55">Chưa có tài khoản giáo viên. Tạo ở mục Tài khoản giáo viên bên dưới.</p> : (
            <div className="mt-3 flex flex-wrap gap-3">
              {roster.map((teacher) => (
                <label key={teacher.id} className="flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={room.teachers.some((item) => item.id === teacher.id)}
                    disabled={setTeachers.isPending}
                    onChange={(event) => toggleTeacher(teacher.id, event.target.checked)}
                  />
                  {teacher.fullName}
                </label>
              ))}
            </div>
          )
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-coral">{error}</p> : null}
      <ClassRoster key={room.id} classId={room.id} memberCount={room.memberCount} />
    </Card>
  )
}

function ClassRoster({ classId, memberCount }: { classId: string; memberCount: number }) {
  const [page, setPage] = useState(1)
  const students = useStudents({ q: '', status: '', classId, page, pageSize: 20 })
  const total = students.data?.total ?? memberCount
  const pages = Math.max(1, Math.ceil(total / 20))
  const items = students.data?.items ?? []
  const { user } = useAuth()
  const canOpenProfile = user?.role === 'ADMIN' || Boolean(user?.permissions.viewProgress)

  return (
    <div className="mt-5 border-t border-gold/30 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="serif text-xl">Tài khoản học viên</h3>
          <p className="mt-1 text-sm text-ink/55">Danh sách tài khoản đang ở lớp này.</p>
        </div>
        <p className="text-sm font-semibold text-gold-deep">{total} học viên</p>
      </div>
      {students.isPending ? <p className="mt-3 text-sm text-ink/55">Đang tải tài khoản…</p> : null}
      {students.isError ? <p className="mt-3 text-sm text-coral">Không tải được danh sách học viên.</p> : null}
      {!students.isPending && items.length === 0 ? <p className="mt-3 text-sm text-ink/55">Lớp chưa có học viên.</p> : null}
      {items.length > 0 ? (
        <ul className="mt-3 divide-y divide-gold/25">
          {items.map((student) => (
            <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <AccountAvatar name={student.fullName} url={student.avatarUrl} frameId={student.avatarFrame} className="size-9 text-xs" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{student.fullName}</p>
                  <p className="truncate text-xs text-ink/50">{accountLine(student)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StudentStatus user={student} />
                {canOpenProfile ? <Link to={`/admin/students/${student.id}`} className="text-xs font-semibold text-gold-deep underline underline-offset-4">Hồ sơ</Link> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {pages > 1 ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trước</Button>
          <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Sau</Button>
        </div>
      ) : null}
    </div>
  )
}

function accountLine(student: UserDto) {
  const parts = [student.studentCode, student.username]
  if (student.email) parts.push(student.email)
  return parts.filter(Boolean).join(' · ')
}

function StudentStatus({ user }: { user: UserDto }) {
  if (user.status === 'DISABLED') return <Badge tone="danger">Đã khóa</Badge>
  if (user.mustChangePassword) return <Badge tone="warn">Chưa đổi MK</Badge>
  return <Badge tone="olive">Hoạt động</Badge>
}

export function TeacherClassPanels({
  canCreate,
  selectedId,
  onSelect,
}: {
  canCreate: boolean
  selectedId: string
  onSelect: (id: string) => void
}) {
  const classes = useClasses()
  const rooms = classes.data ?? []
  const room = rooms.find((item) => item.id === selectedId) ?? null
  if (classes.isPending) return <p className="text-sm text-ink/55">Đang tải lớp…</p>
  if (rooms.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink/70">Admin chưa giao lớp nào cho tài khoản này. Bạn chỉ quản lý học viên của lớp được giao.</p>
      </Card>
    )
  }
  return (
    <section className="space-y-4">
      <ClassSwitcher rooms={rooms} selectedId={room?.id ?? ''} onSelect={onSelect} />
      {room ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="serif text-2xl">{room.name}</h2>
              <p className="mt-1 text-sm text-ink/60">
                {room.memberCount} học viên{room.closedAt ? ' · Đã đóng' : ''}
              </p>
            </div>
            {room.closedAt ? (
              <p className="text-sm text-ink/55">Lớp đã đóng nên không thêm học viên.</p>
            ) : canCreate ? (
              <AddStudentActions classId={room.id} className={room.name} prominent />
            ) : (
              <p className="text-sm text-ink/55">Tài khoản chưa có quyền tạo học viên.</p>
            )}
          </div>
          <ClassRoster key={room.id} classId={room.id} memberCount={room.memberCount} />
        </Card>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-ink/70">Đang xem học viên của mọi lớp được giao. Tìm tên lớp, rồi bấm Quản lý lớp để xem tài khoản trong lớp đó.</p>
        </Card>
      )}
    </section>
  )
}

export function ClassSelect({ userId, classId }: { userId: string; classId: string | null }) {
  const classes = useClasses()
  const assign = useAssignClass()
  return (
    <select
      className="mt-1 max-w-40 rounded-lg border border-gold/40 bg-white px-2 py-1 text-xs"
      aria-label="Lớp của học viên"
      value={classId ?? ''}
      disabled={assign.isPending}
      onChange={(event) => {
        if (!event.target.value) return
        void assign.mutate({ userId, classId: event.target.value })
      }}
    >
      <option value="" disabled>
        Chưa xếp lớp
      </option>
      {(classes.data ?? [])
        .filter((room) => !room.closedAt || room.id === classId)
        .map((room) => (
          <option key={room.id} value={room.id} disabled={Boolean(room.closedAt)}>
            {room.closedAt ? `${room.name} (đã đóng)` : room.name}
          </option>
        ))}
    </select>
  )
}
