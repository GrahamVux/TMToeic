import { Button } from '@/components/ui/Button'
import { Card, Input } from '@/components/ui/Primitives'
import { ApiError } from '@/lib/api'
import type { ClassSummaryDto } from '@toeic/shared'
import { useState, type FormEvent } from 'react'
import { AddStudentActions } from './StudentDialogs'
import { useAssignClass, useClasses, useCreateClass, useDeleteClass, useSetClassClosed, useSetClassTeachers, useTeachers } from './users.queries'

export function ClassRooms() {
  const classes = useClasses()
  const teachers = useTeachers()
  const create = useCreateClass()
  const setTeachers = useSetClassTeachers()
  const setClosed = useSetClassClosed()
  const remove = useDeleteClass()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const roster = teachers.data?.items ?? []

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await create.mutateAsync({ name })
      setName('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được lớp.')
    }
  }

  function toggleTeacher(room: ClassSummaryDto, teacherId: string, on: boolean) {
    const current = room.teachers.map((teacher) => teacher.id)
    const teacherIds = on ? [...current, teacherId] : current.filter((id) => id !== teacherId)
    void setTeachers.mutate({ classId: room.id, teacherIds })
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="serif text-2xl">Lớp học</h2>
        <p className="mt-1 text-sm text-ink/60">
          Admin tạo lớp và chọn giáo viên quản lý học viên của lớp đó. Thêm học viên nhiều lần, từng người hoặc bằng Excel.
        </p>
      </div>
      <form onSubmit={(event) => void submit(event)} className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên lớp mới" aria-label="Tên lớp mới" className="w-full sm:max-w-xs" />
        <Button type="submit" disabled={create.isPending || name.trim().length < 2}>
          {create.isPending ? 'Đang tạo…' : 'Thêm lớp'}
        </Button>
      </form>
      {error ? <p role="alert" className="text-sm text-coral">{error}</p> : null}
      <div className="grid gap-3">
        {(classes.data ?? []).map((room) => (
          <Card key={room.id} className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                {room.name}
                {room.closedAt ? <span className="ml-2 text-xs font-semibold text-coral">Đã đóng</span> : null}
              </h3>
              <p className="text-sm text-ink/50">{room.memberCount} học viên</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="paper"
                className="px-3 py-1.5 text-xs"
                disabled={setClosed.isPending || remove.isPending}
                onClick={() => {
                  const next = !room.closedAt
                  const ok = window.confirm(next ? `Đóng lớp “${room.name}”? Lớp không nhận học viên mới. Tài khoản hiện tại vẫn giữ.` : `Mở lại lớp “${room.name}”?`)
                  if (!ok) return
                  setError(null)
                  void setClosed.mutateAsync({ classId: room.id, closed: next }).catch((err: unknown) => {
                    setError(err instanceof ApiError ? err.message : 'Không đổi được trạng thái lớp.')
                  })
                }}
              >
                {room.closedAt ? 'Mở lại lớp' : 'Đóng lớp'}
              </Button>
              <Button
                type="button"
                variant="danger"
                className="px-3 py-1.5 text-xs"
                disabled={setClosed.isPending || remove.isPending}
                onClick={() => {
                  const ok = window.confirm(`Xóa lớp “${room.name}”? Học viên không bị xóa tài khoản, chỉ ra khỏi lớp. Không hoàn tác được.`)
                  if (!ok) return
                  setError(null)
                  void remove.mutateAsync(room.id).catch((err: unknown) => {
                    setError(err instanceof ApiError ? err.message : 'Không xóa được lớp.')
                  })
                }}
              >
                Xóa lớp
              </Button>
            </div>
            <p className="mt-3 text-xs tracking-wide text-ink/45 uppercase">Giáo viên quản lý lớp</p>
            {roster.length === 0 ? <p className="mt-2 text-sm text-ink/55">Chưa có tài khoản giáo viên.</p> : null}
            <div className="mt-2 flex flex-wrap gap-3">
              {roster.map((teacher) => (
                <label key={teacher.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={room.teachers.some((item) => item.id === teacher.id)}
                    disabled={setTeachers.isPending}
                    onChange={(event) => toggleTeacher(room, teacher.id, event.target.checked)}
                  />
                  {teacher.fullName}
                </label>
              ))}
            </div>
            {room.closedAt ? <p className="mt-3 text-sm text-ink/55">Lớp đã đóng nên không thêm học viên.</p> : <AddStudentActions classId={room.id} className={room.name} />}
          </Card>
        ))}
      </div>
    </section>
  )
}

export function TeacherClassPanels({ canCreate }: { canCreate: boolean }) {
  const classes = useClasses()
  const rooms = classes.data ?? []
  if (classes.isPending) return <p className="text-sm text-ink/55">Đang tải lớp…</p>
  if (rooms.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink/70">Admin chưa giao lớp nào cho tài khoản này. Bạn chỉ quản lý học viên của lớp được giao.</p>
      </Card>
    )
  }
  return (
    <div className="grid gap-3">
      {rooms.map((room) => (
        <Card key={room.id} className="p-4">
          <h3 className="font-semibold">
            {room.name}
            {room.closedAt ? <span className="ml-2 text-xs font-semibold text-coral">Đã đóng</span> : null}
          </h3>
          <p className="text-sm text-ink/55">{room.memberCount} học viên</p>
          {room.closedAt ? (
            <p className="mt-2 text-sm text-ink/55">Lớp đã đóng nên không thêm học viên.</p>
          ) : canCreate ? (
            <AddStudentActions classId={room.id} className={room.name} />
          ) : (
            <p className="mt-2 text-sm text-ink/55">Tài khoản chưa có quyền tạo học viên.</p>
          )}
        </Card>
      ))}
    </div>
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
