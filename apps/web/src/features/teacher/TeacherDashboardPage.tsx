import { useAuth } from '@/app/AuthContext'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { Button } from '@/components/ui/Button'
import { Badge, Card, Input } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useClassReport } from '@/features/progress/progress.queries'
import { formatGoal, INACTIVE_AFTER_DAYS, SUPPORT_ACCURACY_BELOW, type UserStatus } from '@toeic/shared'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { InactiveList } from './ReportsPage'
import { ClassRooms, ClassSelect, CreateClassButton, TeacherClassPanels } from './ClassRooms'
import { AccountActions, TeacherAccessPanel } from './StudentDialogs'
import { useClasses } from './users.queries'
import { useStudentStats, useStudents, type StudentFilters } from './users.queries'

const PAGE_SIZE = 10

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

const dateFmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

export function TeacherDashboardPage() {
  const { user } = useAuth()
  const grants = user?.permissions
  const isAdmin = user?.role === 'ADMIN'
  const canCreate = isAdmin || !!grants?.createStudents
  const canAssign = isAdmin || !!grants?.manageAssignments
  const canView = isAdmin || !!grants?.viewProgress
  const canSeeStudents = isAdmin || canCreate || canAssign || canView
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [page, setPage] = useState(1)
  const [classId, setClassId] = useState('')
  const q = useDebounced(search.trim())
  const rooms = useClasses()
  const knownClassId = !rooms.data || rooms.data.some((room) => room.id === classId) ? classId : ''

  const filters: StudentFilters = { q, status, classId: knownClassId, page, pageSize: PAGE_SIZE }
  const students = useStudents(filters, canSeeStudents)
  const stats = useStudentStats(canSeeStudents, knownClassId)
  const total = students.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const chips: Array<{ id: UserStatus | ''; label: string; count?: number }> = [
    { id: '', label: 'Tất cả', count: stats.data?.total },
    { id: 'ACTIVE', label: 'Đang hoạt động', count: stats.data?.active },
    { id: 'DISABLED', label: 'Đã khóa', count: stats.data?.disabled },
  ]

  if (students.isError) return <QueryErrorRedirect error={students.error} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Cổng quản lý đào tạo</p>
          <h1 className="serif mt-2 text-3xl sm:text-4xl">Quản lý Lớp & Học viên</h1>
          <p className="mt-2 text-sm text-ink/60">Xem tất cả học viên, hoặc tìm đúng một lớp rồi mở lớp đó.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {isAdmin ? <CreateClassButton /> : null}
          {isAdmin ? (
            <Button variant="navy" type="button" onClick={() => document.getElementById('tai-khoan-giao-vien')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Thêm giáo viên
            </Button>
          ) : null}
          {canAssign ? <Link to="/admin/assignments"><Button variant="paper">Giao bài tập</Button></Link> : null}
          {canAssign ? <Link to="/admin/exams"><Button variant="navy">Import đề</Button></Link> : null}
        </div>
      </div>

      {isAdmin ? <ClassRooms selectedId={knownClassId} onSelect={(id) => { setClassId(id); setPage(1) }} /> : canSeeStudents ? <TeacherClassPanels canCreate={canCreate} selectedId={knownClassId} onSelect={(id) => { setClassId(id); setPage(1) }} /> : null}
      {isAdmin ? <TeacherAccessPanel /> : null}
      {!canSeeStudents ? (
        <Card className="p-6">
          <p className="text-sm text-ink/70">Tài khoản này chưa được cấp quyền. Quản trị viên cần bật tạo học viên, giao bài hoặc xem tiến độ.</p>
        </Card>
      ) : null}
      {canSeeStudents ? <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Tổng học viên" value={stats.data?.total} meta={knownClassId ? 'Trong lớp đang chọn' : 'Mọi lớp bạn được xem'} />
        <Stat title="Đang hoạt động" value={stats.data?.active} meta="Có thể đăng nhập" />
        <Stat title="Chưa đổi mật khẩu tạm" value={stats.data?.pendingFirstLogin} meta="Cần nhắc đăng nhập lần đầu" />
        <Stat title="Đã khóa" value={stats.data?.disabled} meta="Không thể đăng nhập" />
      </div> : null}

      {canSeeStudents ? <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.id || 'all'}
              className={`rounded-full px-4 py-2 text-sm ${status === c.id ? 'bg-button text-button-ink' : 'bg-paper-2 text-ink/70'}`}
              onClick={() => {
                setStatus(c.id)
                setPage(1)
              }}
            >
              {c.label}
              {c.count !== undefined ? ` (${c.count})` : ''}
            </button>
          ))}
        </div>
        <Input
          className="w-full sm:max-w-xs"
          placeholder="Tìm theo tên hoặc mã HV (TM-1000)…"
          aria-label="Tìm học viên"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gold/35 bg-cream">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper text-xs tracking-wide text-ink/45 uppercase">
            <tr>
              <th className="px-4 py-3">Học viên</th>
              <th className="px-4 py-3">Lớp</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Mục tiêu</th>
              <th className="px-4 py-3">Đăng nhập gần nhất</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {students.isPending ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink/50">Đang tải danh sách…</td></tr>
            ) : !students.data?.items.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/55">
                  {q || status ? 'Không có học viên khớp bộ lọc.' : 'Chưa có học viên nào. Hãy nhập file Excel để tạo tài khoản.'}
                </td>
              </tr>
            ) : (
              (students.data?.items ?? []).map((u) => (
                <tr key={u.id} className="border-t border-gold/25">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AccountAvatar name={u.fullName} url={u.avatarUrl} frameId={u.avatarFrame} className="size-9 text-xs" />
                      <div>
                        <p className="font-semibold">{u.fullName}</p>
                        <p className="text-xs text-ink/50">{u.studentCode}{u.email ? ` • ${u.email}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-ink/70">{u.className ?? 'Chưa xếp lớp'}</p>
                    {isAdmin ? <ClassSelect userId={u.id} classId={u.classId} /> : null}
                  </td>
                  <td className="px-4 py-3">
                    {u.status === 'DISABLED' ? (
                      <Badge tone="danger">Đã khóa</Badge>
                    ) : u.mustChangePassword ? (
                      <Badge tone="warn">Chờ đăng nhập lần đầu</Badge>
                    ) : (
                      <Badge tone="olive">Hoạt động</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatGoal(u.goal) ?? '—'}</td>
                  <td className="px-4 py-3 text-ink/70">{u.lastLoginAt ? dateFmt.format(new Date(u.lastLoginAt)) : 'Chưa đăng nhập'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <AccountActions user={u} compact />
                      {canView ? <Link to={`/admin/students/${u.id}#bai-lam`}><Button variant="paper" className="px-3 py-1.5 text-xs">Bài làm</Button></Link> : null}
                      {canView ? <Link to={`/admin/students/${u.id}`}><Button variant="paper" className="px-3 py-1.5 text-xs">Hồ sơ</Button></Link> : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/25 px-4 py-3 text-sm text-ink/60">
            <span>Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total} học viên</span>
            {pages > 1 ? (
              <div className="flex gap-1">
                {Array.from({ length: pages }, (_, index) => index + 1)
                  .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
                  .map((n, index, list) => (
                    <span key={n} className="flex items-center gap-1">
                      {index > 0 && list[index - 1] !== n - 1 ? <span className="px-1">…</span> : null}
                      <button type="button" className={`grid size-8 place-items-center rounded-full text-xs font-semibold ${n === page ? 'bg-button text-button-ink' : 'bg-paper-2 text-ink/70'}`} onClick={() => setPage(n)}>
                        {n}
                      </button>
                    </span>
                  ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
      </> : null}

      {canView ? <NeedsAttention /> : null}
    </div>
  )
}

function Stat({ title, value, meta }: { title: string; value?: number; meta: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs text-ink/50">{title}</p>
      <p className="serif mt-2 text-4xl">{value ?? '—'}</p>
      <p className="mt-1 text-xs text-ink/50">{meta}</p>
    </Card>
  )
}

function NeedsAttention() {
  const report = useClassReport()
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="serif text-2xl">Học viên cần lưu tâm</h2>
          <p className="mt-1 text-xs text-ink/50">Tỉ lệ đúng dưới {SUPPORT_ACCURACY_BELOW}%, từ {INACTIVE_AFTER_DAYS} ngày không làm bài, hoặc bài giao đã quá hạn mà chưa nộp.</p>
        </div>
        <Link to="/admin/reports#luu-tam"><Button variant="paper" className="px-3 py-1.5 text-xs">Xem đầy đủ</Button></Link>
      </div>
      {report.isPending ? <p className="mt-3 text-sm text-ink/55">Đang tải…</p> : null}
      {report.isError ? <p className="mt-3 text-sm text-coral">Không tải được dữ liệu hoạt động.</p> : null}
      {report.data ? <InactiveList items={report.data.inactive.slice(0, 5)} total={report.data.inactiveCount} /> : null}
    </Card>
  )
}
