import { buttonClasses } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Badge, Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { partName } from '@/features/exams/exams.queries'
import { MIN_ANSWERS_FOR_INSIGHT, formatGoal } from '@toeic/shared'
import { Link } from 'react-router-dom'
import { AttemptsTable, PartBreakdown, ScoreTrend } from './ProgressParts'
import { useMyProgress } from './progress.queries'

export function ProgressPage() {
  const { data: p, isPending, error } = useMyProgress()

  if (isPending) return <PageLoading message="Đang tải tiến độ…" />
  if (error || !p) return <QueryErrorRedirect error={error} />

  const weak = p.weakestPart
  const drillPath = weak?.skill === 'LISTENING' ? '/practice/listening' : '/practice/reading'

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-ink-soft">Trang chủ / Tiến độ & phân tích năng lực</p>
          <h1 className="serif mt-2 text-4xl">Báo cáo tiến độ & năng lực cá nhân</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {formatGoal(p.goal) ? `Mục tiêu ${formatGoal(p.goal)}` : <>Chưa đặt mục tiêu • <Link to="/settings#goal" className="font-semibold text-gold-deep underline">Đặt mục tiêu</Link></>}
            {p.remainingToTarget !== null ? ` • Còn ${p.remainingToTarget} điểm` : ''}
          </p>
        </div>
        <Link to="/practice" className={buttonClasses('gold')}>Làm đề</Link>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card className="p-5">
          <p className="text-xs text-ink-soft">Điểm thi thử gần nhất</p>
          <p className="serif text-4xl tabular-nums">{p.latestScore?.totalScore ?? '—'}</p>
          <p className="text-sm text-ink-soft">
            {p.improvement === null ? (p.latestScore ? 'Bài thi thử đầu tiên' : 'Chưa có bài đủ 200 câu') : `${p.improvement >= 0 ? '+' : ''}${p.improvement} so với lần đầu`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink-soft">Listening</p>
          <p className="serif text-4xl tabular-nums">{p.latestScore?.listeningScore ?? '—'}<span className="text-lg text-ink-soft"> /495</span></p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink-soft">Reading</p>
          <p className="serif text-4xl tabular-nums">{p.latestScore?.readingScore ?? '—'}<span className="text-lg text-ink-soft"> /495</span></p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink-soft">Tỷ lệ đúng chung</p>
          <p className="serif text-4xl tabular-nums">{p.totals.accuracy === null ? '—' : `${p.totals.accuracy}%`}</p>
          <p className="text-sm text-ink-soft tabular-nums">
            {p.totals.answered} câu • {p.totals.attemptsFinished} bài
            {p.totals.avgSeconds !== null ? ` • ${p.totals.avgSeconds}s/câu` : ''}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <ScoreTrend
          history={p.scoreHistory}
          target={p.goal}
          subtitle={p.scoreHistory.length >= 2 ? `${p.scoreHistory.length} bài thi thử có điểm quy đổi` : undefined}
        />
        <section className="rounded-2xl border border-gold/35 bg-teal-soft p-6">
          <p className="text-gold-deep">Nhận xét tự động</p>
          {weak ? (
            <p className="mt-4 text-sm leading-7">
              Phần bạn đang yếu nhất là <strong>{partName(weak.partCode)}</strong> với {weak.accuracy}% đúng ({weak.correct}/{weak.answered} câu).
              {weak.avgSeconds !== null ? ` Thời gian trung bình ${weak.avgSeconds}s mỗi câu.` : ''} Hãy luyện thêm phần này trước.
            </p>
          ) : (
            <p className="mt-4 text-sm leading-7">
              Chưa đủ dữ liệu để nhận xét. Hệ thống cần ít nhất {MIN_ANSWERS_FOR_INSIGHT} câu đã nộp ở một Part mới đánh giá điểm yếu.
            </p>
          )}
          <p className="mt-6 text-xs text-ink-soft">Tính từ các bài đã nộp của bạn — không phải dự đoán điểm thi thật.</p>
        </section>
      </div>

      <section>
        <h2 className="serif text-2xl">Phân tích chi tiết từng Part</h2>
        <p className="mt-1 text-sm text-ink-soft">Tỷ lệ đúng trên các câu bạn đã làm trong những bài đã nộp.</p>
        <div className="mt-4"><PartBreakdown parts={p.parts} /></div>
      </section>

      <section>
        <h2 className="serif text-2xl">Bài làm gần đây</h2>
        <div className="mt-4"><AttemptsTable attempts={p.recentAttempts} reviewLinks /></div>
      </section>

      <section>
        <h2 className="serif text-2xl">Đề xuất hành động</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {weak ? (
            <Card className="p-5">
              <Badge tone="danger">Khắc phục {weak.partCode.replace('PART_', 'Part ')}</Badge>
              <p className="mt-3 font-semibold">Luyện tập {partName(weak.partCode)}</p>
              <p className="mt-2 text-sm text-ink-soft">Tỷ lệ đúng hiện tại {weak.accuracy}%.</p>
              <Link to={drillPath} className={buttonClasses('navy', 'mt-4')}>Luyện ngay</Link>
            </Card>
          ) : (
            <Card className="p-5">
              <Badge>Bắt đầu</Badge>
              <p className="mt-3 font-semibold">Làm một bài luyện để hệ thống hiểu năng lực của bạn</p>
              <p className="mt-2 text-sm text-ink-soft">Sau vài bài, phần phân tích điểm yếu sẽ xuất hiện ở đây.</p>
              <Link to="/practice" className={buttonClasses('navy', 'mt-4')}>Chọn đề</Link>
            </Card>
          )}
          <Card className="p-5">
            <Badge tone="warn">Thi thử</Badge>
            <p className="mt-3 font-semibold">Làm một đề đủ 200 câu tính giờ</p>
            <p className="mt-2 text-sm text-ink-soft">Có điểm quy đổi Listening/Reading để theo dõi xu hướng.</p>
            <Link to="/practice" className={buttonClasses('gold', 'mt-4')}>Vào kho đề</Link>
          </Card>
        </div>
      </section>
    </div>
  )
}
