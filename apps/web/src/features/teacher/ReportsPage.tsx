import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Primitives'
import { useClassReport } from '@/features/progress/progress.queries'
import { ApiError } from '@/lib/api'
import { INACTIVE_AFTER_DAYS } from '@toeic/shared'
import { Link } from 'react-router-dom'

const dateFmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

export function ReportsPage() {
  const { data: r, isPending, error, refetch } = useClassReport()

  if (isPending) return <p className="py-16 text-center text-ink/55" role="status">Đang tải báo cáo…</p>
  if (error || !r) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-coral">{error instanceof ApiError ? error.message : 'Không tải được báo cáo.'}</p>
        <Button variant="paper" onClick={() => void refetch()}>Thử lại</Button>
      </div>
    )
  }

  const [y, m, d] = r.week.start.split('-')
  return (
    <div className="space-y-6">
      <header>
        <h1 className="serif text-4xl">Báo cáo tổng hợp lớp</h1>
        <p className="mt-2 text-sm text-ink/60">Tuần bắt đầu thứ Hai {d}/{m}/{y} • giờ Việt Nam</p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Học viên đang hoạt động trong tuần" value={`${r.week.activeStudents}/${r.students.active}`} meta="Có làm ít nhất 1 câu" />
        <Kpi label="Bài làm trong tuần" value={String(r.week.attempts)} meta={`${r.week.answered} câu đã làm`} />
        <Kpi label="Tỷ lệ đúng 30 ngày" value={r.accuracy30d === null ? '—' : `${r.accuracy30d}%`} meta="Trên các bài đã nộp" />
        <Kpi label={`Cần hỗ trợ (≥${INACTIVE_AFTER_DAYS} ngày không làm bài)`} value={String(r.inactiveCount)} meta={`${r.students.pendingFirstLogin} bạn chưa đăng nhập lần đầu`} />
      </div>

      <Card className="p-6">
        <h2 className="serif text-2xl">Học viên cần hỗ trợ</h2>
        <InactiveList items={r.inactive} total={r.inactiveCount} />
      </Card>
    </div>
  )
}

export function InactiveList({ items, total }: { items: Array<{ id: string; fullName: string; studentCode: string | null; lastActivityAt: string | null; daysInactive: number | null }>; total: number }) {
  if (items.length === 0) return <p className="mt-3 rounded-2xl bg-paper p-4 text-sm text-ink/60">Không có học viên nào bị bỏ lỡ. Tất cả đang học đều đặn.</p>
  return (
    <>
      <ul className="mt-4 space-y-2">
        {items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
            <div>
              <p className="font-semibold">{s.fullName}</p>
              <p className="text-xs text-ink/55">
                {s.studentCode} • {s.lastActivityAt ? `Làm bài lần cuối ${dateFmt.format(new Date(s.lastActivityAt))} (${s.daysInactive} ngày trước)` : 'Đã đăng nhập nhưng chưa làm bài nào'}
              </p>
            </div>
            <Link to={`/admin/students/${s.id}`}><Button variant="paper" className="px-3 py-1.5 text-xs">Xem hồ sơ</Button></Link>
          </li>
        ))}
      </ul>
      {total > items.length ? <p className="mt-3 text-xs text-ink/50">Hiển thị {items.length}/{total} học viên.</p> : null}
    </>
  )
}

function Kpi({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="serif mt-2 text-4xl">{value}</p>
      <p className="mt-1 text-xs text-ink/50">{meta}</p>
    </Card>
  )
}
