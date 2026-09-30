import { Button } from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { ApiError } from '@/lib/api'
import { Link, Navigate, useParams } from 'react-router-dom'
import { formatClock, partName, useAttemptResult } from './exams.queries'

export function ResultPage() {
  const { attemptId } = useParams()
  const { data: r, isPending, error } = useAttemptResult(attemptId)

  if (isPending) return <p className="p-8 text-sm text-ink/55">Đang tải kết quả…</p>
  if (error instanceof ApiError && error.status === 409) return <Navigate to={`/attempts/${attemptId}/play`} replace />
  if (error || !r) {
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <h1 className="serif text-2xl">Không tải được kết quả</h1>
        <p className="mt-2 text-sm text-ink/60">{error instanceof ApiError ? error.message : 'Vui lòng thử lại.'}</p>
        <Link to="/practice" className="mt-5 inline-block">
          <Button variant="navy">Về danh sách đề</Button>
        </Link>
      </Card>
    )
  }

  const answeredTotal = r.correctCount + r.incorrectCount + r.unansweredCount
  const scaled = r.totalScore !== null
  return (
    <div className="space-y-6">
      <Card className="bg-teal-soft p-8">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-gold-deep">{r.attempt.examTitle}</p>
          {r.attempt.status === 'EXPIRED' ? <Badge tone="warn">Tự nộp do hết giờ</Badge> : null}
        </div>
        {scaled ? (
          <>
            <h1 className="serif mt-2 text-5xl">{r.totalScore} / 990</h1>
            <p className="mt-3 text-ink/70">
              Listening {r.listeningScore ?? '—'} • Reading {r.readingScore ?? '—'}
            </p>
          </>
        ) : (
          <>
            <h1 className="serif mt-2 text-5xl">
              {r.correctCount} / {answeredTotal} câu đúng
            </h1>
            <p className="mt-3 text-ink/70">
              Điểm quy đổi 990 chỉ tính khi làm đủ 100 câu Listening và/hoặc 100 câu Reading của một đề đầy đủ.
            </p>
          </>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Đúng" value={r.correctCount} />
        <Stat label="Sai" value={r.incorrectCount} />
        <Stat label="Bỏ trống" value={r.unansweredCount} />
        <Stat label="Thời gian làm" value={formatClock(r.durationSeconds)} />
      </div>

      <Card className="p-5">
        <h2 className="serif text-2xl">Kết quả theo Part</h2>
        <div className="mt-4 grid gap-4">
          {r.parts.map((p) => (
            <div key={p.partCode}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{partName(p.partCode)}</span>
                <span className="text-ink/60">
                  {p.correct}/{p.total} • {p.accuracy}%
                </span>
              </div>
              <ProgressBar className="mt-1.5" value={p.accuracy} />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link to={`/attempts/${r.attempt.id}/review`}>
          <Button>Chữa đề chi tiết</Button>
        </Link>
        <Link to="/practice">
          <Button variant="navy">Làm đề khác</Button>
        </Link>
        <Link to="/progress">
          <Button variant="ghost">Xem tiến độ cá nhân</Button>
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-ink/55">{label}</p>
      <p className="serif text-3xl">{value}</p>
    </Card>
  )
}
