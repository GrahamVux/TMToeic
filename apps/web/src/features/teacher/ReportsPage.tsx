import { Button } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Card, ProgressBar } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { partName } from '@/features/exams/exams.queries'
import { useClassReport, useExamReport } from '@/features/progress/progress.queries'
import { INACTIVE_AFTER_DAYS, SUPPORT_ACCURACY_BELOW, type ExamReportItemDto, type InactiveStudentDto, type SupportReason } from '@toeic/shared'
import { Link } from 'react-router-dom'

const when = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

export function ReportsPage() {
  const { data, isPending, error } = useExamReport()
  const support = useClassReport()

  if (isPending) return <PageLoading message="Đang tải báo cáo…" />
  if (error || !data) return <QueryErrorRedirect error={error} />

  const exams = data.exams
  const attempts = exams.reduce((sum, exam) => sum + exam.attempts, 0)
  const answered = exams.reduce((sum, exam) => sum + exam.answered, 0)
  const correct = exams.reduce((sum, exam) => sum + exam.correct, 0)
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null

  return (
    <div className="space-y-6">
      <header>
        <h1 className="serif text-3xl sm:text-4xl">Báo cáo theo bộ đề</h1>
        <p className="mt-2 text-sm text-ink/60">Mỗi bộ đề đã xuất bản: số lượt nộp, tỷ lệ đúng và part yếu nhất.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Bộ đề" value={String(exams.length)} meta="Đề đã xuất bản và đề đã có bài nộp" />
        <Kpi label="Lượt nộp" value={String(attempts)} meta="Bài đã nộp hoặc hết giờ" />
        <Kpi label="Tỷ lệ đúng" value={accuracy === null ? '—' : `${accuracy}%`} meta="Trên các câu của bài đã nộp" />
      </div>

      <Card className="scroll-mt-24 p-6" id="luu-tam">
        <h2 className="serif text-2xl">Học viên cần lưu tâm</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Tỉ lệ đúng dưới {SUPPORT_ACCURACY_BELOW}%, từ {INACTIVE_AFTER_DAYS} ngày không làm bài, hoặc bài giao đã quá hạn mà chưa nộp.
        </p>
        {support.isPending ? <p className="mt-3 text-sm text-ink-soft">Đang tải danh sách…</p> : null}
        {support.isError ? <p className="mt-3 text-sm text-coral">Không tải được danh sách học viên cần lưu tâm.</p> : null}
        {support.data ? <InactiveList items={support.data.inactive} total={support.data.inactiveCount} /> : null}
      </Card>

      {exams.length === 0 ? <p className="rounded-2xl bg-paper p-4 text-sm text-ink/60">Chưa có bộ đề nào để báo cáo.</p> : null}

      <div className="space-y-4">
        {exams.map((exam) => (
          <ExamCard key={exam.id} exam={exam} />
        ))}
      </div>
    </div>
  )
}

function ExamCard({ exam }: { exam: ExamReportItemDto }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-gold-deep uppercase">{exam.code}{exam.status === 'ARCHIVED' ? ' • Đã lưu trữ' : ''}</p>
          <h2 className="serif mt-1 text-2xl">{exam.title}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            {exam.totalQuestions} câu
            {exam.lastSubmittedAt ? ` • nộp gần nhất ${when.format(new Date(exam.lastSubmittedAt))}` : ' • chưa có bài nộp'}
          </p>
        </div>
        {exam.weakestPart ? (
          <p className="rounded-full bg-paper px-3 py-1 text-xs text-ink/70">
            Part yếu: {partName(exam.weakestPart.partCode)} • {exam.weakestPart.accuracy}%
          </p>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Học viên đã làm" value={String(exam.students)} />
        <Stat label="Lượt nộp" value={String(exam.attempts)} />
        <Stat label="Tỷ lệ đúng" value={exam.accuracy === null ? '—' : `${exam.accuracy}%`} />
        <Stat label="Điểm trung bình" value={exam.averageScore === null ? '—' : String(exam.averageScore)} />
      </div>
      {exam.parts.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {exam.parts.map((part) => (
            <div key={part.partCode}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{partName(part.partCode)}</span>
                <span className="text-ink-soft">
                  {part.correct}/{part.answered} • {part.accuracy ?? 0}%
                </span>
              </div>
              <ProgressBar className="mt-1.5" value={part.accuracy ?? 0} />
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper px-4 py-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="serif mt-1 text-2xl">{value}</p>
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
  if (items.length === 0) return <p className="mt-3 rounded-2xl bg-paper p-4 text-sm text-ink/60">Không có học viên nào cần lưu tâm.</p>
  return (
    <>
      <ul className="mt-4 space-y-2">
        {items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
            <div>
              <p className="font-semibold">{s.fullName}</p>
              <p className="text-xs text-ink-soft">
                {s.studentCode ? `${s.studentCode} • ` : ''}
                {s.reasons.map((reason) => reasonText(s, reason)).join(' • ')}
              </p>
            </div>
            <Link to={`/admin/students/${s.id}`}><Button variant="paper" className="px-3 py-1.5 text-xs">Xem hồ sơ</Button></Link>
          </li>
        ))}
      </ul>
      {total > items.length ? <p className="mt-3 text-xs text-ink-soft">Hiển thị {items.length}/{total} học viên.</p> : null}
    </>
  )
}

function Kpi({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="serif mt-2 text-4xl">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{meta}</p>
    </Card>
  )
}
