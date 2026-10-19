import { Button } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useClassReport } from '@/features/progress/progress.queries'
import { INACTIVE_AFTER_DAYS, SUPPORT_ACCURACY_BELOW, type InactiveStudentDto, type SupportReason } from '@toeic/shared'
import { Link } from 'react-router-dom'

export function ReportsPage() {
  const { data: r, isPending, error } = useClassReport()

  if (isPending) return <PageLoading message="Đang tải báo cáo…" />
  if (error || !r) return <QueryErrorRedirect error={error} />

  const [y, m, d] = r.week.start.split('-')
  return (
    <div className="space-y-6">
      <header>
        <h1 className="serif text-3xl sm:text-4xl">Báo cáo tổng hợp lớp</h1>
        <p className="mt-2 text-sm text-ink/60">Tuần bắt đầu thứ Hai {d}/{m}/{y} • giờ Việt Nam</p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Học viên đang hoạt động trong tuần" value={`${r.week.activeStudents}/${r.students.active}`} meta="Có làm ít nhất 1 câu" />
        <Kpi label="Bài làm trong tuần" value={String(r.week.attempts)} meta={`${r.week.answered} câu đã làm`} />
        <Kpi label="Tỷ lệ đúng 30 ngày" value={r.accuracy30d === null ? '—' : `${r.accuracy30d}%`} meta="Trên các bài đã nộp" />
        <Kpi
          label="Học viên cần hỗ trợ"
          value={String(r.inactiveCount)}
          meta={`Đúng dưới ${SUPPORT_ACCURACY_BELOW}%, từ ${INACTIVE_AFTER_DAYS} ngày không làm bài, hoặc quá hạn bài giao`}
        />
      </div>

      <Card className="p-6">
        <h2 className="serif text-2xl">Học viên cần hỗ trợ</h2>
        <InactiveList items={r.inactive} total={r.inactiveCount} />
      </Card>
    </div>
  )
}

function reasonText(student: InactiveStudentDto, reason: SupportReason) {
  if (reason === 'LOW_ACCURACY') return `Tỉ lệ đúng ${student.accuracy}%`
  if (reason === 'OVERDUE') return `${student.overdueCount} bài đã quá hạn chưa nộp`
  if (student.lastActivityAt) return `${student.daysInactive} ngày không làm bài`
  return 'Đã đăng nhập nhưng chưa làm bài nào'
}

export function InactiveList({ items, total }: { items: InactiveStudentDto[]; total: number }) {
  if (items.length === 0) return <p className="mt-3 rounded-2xl bg-paper p-4 text-sm text-ink/60">Không có học viên nào cần hỗ trợ.</p>
  return (
    <>
      <ul className="mt-4 space-y-2">
        {items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
            <div>
              <p className="font-semibold">{s.fullName}</p>
              <p className="text-xs text-ink/55">
                {s.studentCode ? `${s.studentCode} • ` : ''}
                {s.reasons.map((reason) => reasonText(s, reason)).join(' • ')}
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
