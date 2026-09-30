import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { partName } from '@/features/exams/exams.queries'
import { ApiError } from '@/lib/api'
import { MIN_ANSWERS_FOR_INSIGHT } from '@toeic/shared'
import { Link } from 'react-router-dom'
import { AttemptsTable, PartBreakdown, ScoreTrend } from './ProgressParts'
import { useMyProgress } from './progress.queries'

export function ProgressPage() {
  const { data: p, isPending, error, refetch } = useMyProgress()

  if (isPending) return <p className="p-8 text-sm text-ink/55">Đang tải tiến độ…</p>
  if (error || !p) {
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <h1 className="serif text-2xl">Không tải được tiến độ</h1>
        <p className="mt-2 text-sm text-ink/60">{error instanceof ApiError ? error.message : 'Vui lòng thử lại.'}</p>
        <Button className="mt-5" variant="navy" onClick={() => void refetch()}>Thử lại</Button>
      </Card>
    )
  }

  const weak = p.weakestPart
  const drillPath = weak?.skill === 'LISTENING' ? '/practice/listening' : '/practice/reading'

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-ink/50">Trang chủ / Tiến độ & phân tích năng lực</p>
          <h1 className="serif mt-2 text-4xl">Báo cáo tiến độ & năng lực cá nhân</h1>
          <p className="mt-2 text-sm text-ink/60">
            {p.targetScore !== null ? `Mục tiêu TOEIC ${p.targetScore}+` : <>Chưa đặt mục tiêu • <Link to="/settings#goal" className="font-semibold text-gold-deep underline">Đặt mục tiêu</Link></>}
            {p.remainingToTarget !== null ? ` • Còn ${p.remainingToTarget} điểm` : ''}
          </p>
        </div>
        <Link to="/practice"><Button>Làm đề</Button></Link>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs text-ink/45">Điểm thi thử gần nhất</p>
          <p className="serif text-4xl">{p.latestScore?.totalScore ?? '—'}</p>
          <p className="text-sm text-ink/60">
            {p.improvement === null ? (p.latestScore ? 'Bài thi thử đầu tiên' : 'Chưa có bài đủ 200 câu') : `${p.improvement >= 0 ? '+' : ''}${p.improvement} so với lần đầu`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink/45">Listening</p>
          <p className="serif text-4xl">{p.latestScore?.listeningScore ?? '—'}<span className="text-lg text-ink/40"> /495</span></p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink/45">Reading</p>
          <p className="serif text-4xl">{p.latestScore?.readingScore ?? '—'}<span className="text-lg text-ink/40"> /495</span></p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink/45">Tỷ lệ đúng chung</p>
          <p className="serif text-4xl">{p.totals.accuracy === null ? '—' : `${p.totals.accuracy}%`}</p>
          <p className="text-sm text-ink/60">
            {p.totals.answered} câu • {p.totals.attemptsFinished} bài
            {p.totals.avgSeconds !== null ? ` • ${p.totals.avgSeconds}s/câu` : ''}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <ScoreTrend
          history={p.scoreHistory}
          target={p.targetScore}
          subtitle={p.scoreHistory.length >= 2 ? `${p.scoreHistory.length} bài thi thử có điểm quy đổi` : undefined}
        />
        <Card className="bg-teal-soft p-6">
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
          <p className="mt-6 text-xs text-ink/45">Tính từ các bài đã nộp của bạn — không phải dự đoán điểm thi thật.</p>
        </Card>
      </div>

      <section>
        <h2 className="serif text-2xl">Phân tích chi tiết từng Part</h2>
        <p className="mt-1 text-sm text-ink/55">Tỷ lệ đúng trên các câu bạn đã làm trong những bài đã nộp.</p>
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
              <p className="mt-2 text-sm text-ink/60">Tỷ lệ đúng hiện tại {weak.accuracy}%.</p>
              <Link to={drillPath} className="mt-4 inline-block"><Button variant="navy">Luyện ngay</Button></Link>
            </Card>
          ) : (
            <Card className="p-5">
              <Badge>Bắt đầu</Badge>
              <p className="mt-3 font-semibold">Làm một bài luyện để hệ thống hiểu năng lực của bạn</p>
              <p className="mt-2 text-sm text-ink/60">Sau vài bài, phần phân tích điểm yếu sẽ xuất hiện ở đây.</p>
              <Link to="/practice" className="mt-4 inline-block"><Button variant="navy">Chọn đề</Button></Link>
            </Card>
          )}
          <Card className="p-5">
            <Badge tone="warn">Thi thử</Badge>
            <p className="mt-3 font-semibold">Làm một đề đủ 200 câu tính giờ</p>
            <p className="mt-2 text-sm text-ink/60">Có điểm quy đổi Listening/Reading để theo dõi xu hướng.</p>
            <Link to="/practice" className="mt-4 inline-block"><Button variant="gold">Vào kho đề</Button></Link>
          </Card>
        </div>
      </section>
    </div>
  )
}
