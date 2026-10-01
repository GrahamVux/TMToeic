import { Button } from '@/components/ui/Button'
import { Badge, Card, Input } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useClassReport } from '@/features/progress/progress.queries'
import type { CredentialsIssuedDto, UserStatus } from '@toeic/shared'
import { formatGoal } from '@toeic/shared'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { InactiveList } from './ReportsPage'
import { AccountActions, CreateStudentDialog, CredentialsDialog } from './StudentDialogs'
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
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [issued, setIssued] = useState<CredentialsIssuedDto | null>(null)
  const q = useDebounced(search.trim())

  const filters: StudentFilters = { q, status, page, pageSize: PAGE_SIZE }
  const students = useStudents(filters)
  const stats = useStudentStats()
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
          <h1 className="serif mt-2 text-3xl sm:text-4xl">Quản lý học viên & giám sát tiến độ</h1>
          <p className="mt-2 text-sm text-ink/60">Tạo tài khoản, theo dõi tiến độ và xem bài làm chi tiết của từng học viên.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
          <Link to="/admin/assignments" className="sm:w-auto"><Button className="w-full" variant="paper">Giao bài tập</Button></Link>
          <Link to="/admin/exams" className="sm:w-auto"><Button className="w-full">Import đề mới</Button></Link>
          <Button className="w-full sm:w-auto" variant="paper" onClick={() => setCreating(true)}>+ Thêm học viên</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Tổng học viên" value={stats.data?.total} meta="Tài khoản do giáo viên cấp" />
        <Stat title="Đang hoạt động" value={stats.data?.active} meta="Có thể đăng nhập" />
        <Stat title="Chưa đổi mật khẩu tạm" value={stats.data?.pendingFirstLogin} meta="Cần nhắc học viên đăng nhập lần đầu" />
        <Stat title="Đã khóa" value={stats.data?.disabled} meta="Không thể đăng nhập" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.id || 'all'}
              className={`rounded-full px-4 py-2 text-sm ${status === c.id ? 'bg-gold-deep text-white' : 'bg-paper-2 text-ink/70'}`}
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
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Mục tiêu</th>
              <th className="px-4 py-3">Đăng nhập gần nhất</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {students.isPending ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink/50">Đang tải danh sách…</td></tr>
            ) : !students.data?.items.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink/55">
                  {q || status ? 'Không có học viên khớp bộ lọc.' : 'Chưa có học viên nào. Bấm “+ Thêm học viên” để tạo tài khoản đầu tiên.'}
                </td>
              </tr>
            ) : (
              (students.data?.items ?? []).map((u) => (
                <tr key={u.id} className="border-t border-gold/25">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{u.fullName}</p>
                    <p className="text-xs text-ink/50">{u.studentCode}{u.email ? ` • ${u.email}` : ''}</p>
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
                      <Link to={`/admin/students/${u.id}#bai-lam`}><Button variant="paper" className="px-3 py-1.5 text-xs">Bài làm</Button></Link>
                      <Link to={`/admin/students/${u.id}`}><Button variant="paper" className="px-3 py-1.5 text-xs">Hồ sơ</Button></Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-gold/25 px-4 py-3 text-sm text-ink/60">
            <span>Trang {page} / {pages} • {total} học viên</span>
            <div className="flex gap-2">
              <Button variant="ghost" className="px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</Button>
              <Button variant="ghost" className="px-3 py-1.5 text-xs" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Sau</Button>
            </div>
          </div>
        )}
      </div>

      <NeedsAttention />

      {creating && (
        <CreateStudentDialog
          onClose={() => setCreating(false)}
          onCreated={(res) => {
            setCreating(false)
            setIssued(res)
          }}
        />
      )}
      {issued && <CredentialsDialog issued={issued} title="Đã tạo tài khoản học viên" onClose={() => setIssued(null)} />}
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
        <h2 className="serif text-2xl">Học viên cần hỗ trợ</h2>
        <Link to="/admin/reports"><Button variant="paper" className="px-3 py-1.5 text-xs">Báo cáo lớp</Button></Link>
      </div>
      {report.isPending ? <p className="mt-3 text-sm text-ink/55">Đang tải…</p> : null}
      {report.isError ? <p className="mt-3 text-sm text-coral">Không tải được dữ liệu hoạt động.</p> : null}
      {report.data ? <InactiveList items={report.data.inactive.slice(0, 5)} total={report.data.inactiveCount} /> : null}
    </Card>
  )
}
