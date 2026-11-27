import { Button } from '@/components/ui/Button'
import { CornerNotice, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError } from '@/lib/api'
import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { AudioPlayer } from './AudioPlayer'
import { formatClock, isListeningPart, partName, useAttemptResult, useAttemptReview } from './exams.queries'
import { FocusNote } from './FocusNote'
import { ReviewQuestionCards } from './ReviewQuestions'
import { TextZoomBar } from './ZoomableImage'

export function ResultPage() {
  const { attemptId, studentId } = useParams()
  const location = useLocation()
  const staffView = Boolean(studentId)
  const [notice] = useState<CornerNoticeState | null>(() =>
    !staffView && (location.state as { submitted?: boolean } | null)?.submitted ? flashNotice('Đã nộp bài thành công.') : null,
  )
  const { data: r, isPending, error } = useAttemptResult(attemptId)

  if (isPending) return <PageLoading message="Đang tải kết quả…" />
  if (error instanceof ApiError && error.status === 409) {
    if (staffView) return <p className="p-8 text-sm text-ink-soft">Học viên chưa nộp bài này nên chưa có kết quả.</p>
    return <Navigate to={`/attempts/${attemptId}/play`} replace />
  }
  if (error || !r) return <QueryErrorRedirect error={error} />

  const answeredTotal = r.correctCount + r.incorrectCount + r.unansweredCount
  const scaled = r.totalScore !== null
  const reviewTo = staffView ? `/admin/students/${studentId}/attempts/${r.attempt.id}/review` : `/attempts/${r.attempt.id}/review`
  return (
    <div className="space-y-6">
      <CornerNotice notice={notice} />
      {staffView ? (
        <Link to={`/admin/students/${studentId}`} className="text-sm text-gold-deep">
          ← Quay lại hồ sơ học viên
        </Link>
      ) : null}
      <Card className="overflow-hidden p-0">
        <div aria-hidden="true" className="h-1.5 w-full bg-linear-to-r from-button via-navy to-crimson" />
        <div className="border-b border-gold/35 bg-paper px-6 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold tracking-[0.06em] text-gold-deep uppercase">
              Phiếu kết quả TOEIC Listening &amp; Reading
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {r.attempt.status === 'EXPIRED' ? <Badge tone="warn">Tự nộp do hết giờ</Badge> : null}
              {r.attempt.status === 'ABANDONED' ? <Badge tone="danger">Đã rời bài thi — không làm tiếp được</Badge> : null}
            </div>
          </div>
          <h1 className="serif mt-1 text-2xl text-ink sm:text-3xl">{r.attempt.examTitle}</h1>
        </div>
        <div className="p-6 sm:p-8">
          {scaled ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    { label: 'LISTENING', score: r.listeningScore },
                    { label: 'READING', score: r.readingScore },
                  ] as const
                ).map((sec) => (
                  <div key={sec.label} className="rounded-2xl border border-gold/40 bg-paper/70 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold tracking-[0.06em] text-gold-deep uppercase">{sec.label}</span>
                      <span className="text-xs text-ink-soft">Thang 5–495</span>
                    </div>
                    <p className="serif mt-2 text-4xl font-bold text-ink tabular-nums">
                      {sec.score ?? '—'} <span className="text-base font-semibold text-ink-soft">/ 495</span>
                    </p>
                    <ProgressBar className="mt-3" value={sec.score !== null ? (sec.score / 495) * 100 : 0} />
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-button/35 bg-button-soft px-6 py-6 text-center">
                <span className="text-[13px] font-bold tracking-[0.06em] text-gold-deep uppercase">Total Score</span>
                <p className="serif mt-2 text-5xl font-extrabold tracking-tight text-ink tabular-nums">{r.totalScore}</p>
                <p className="mt-1 text-xs font-semibold text-ink-soft tabular-nums">/ 990 điểm</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="serif text-4xl font-bold text-ink tabular-nums sm:text-5xl">
                {r.correctCount} <span className="text-2xl font-semibold text-ink-soft">/ {answeredTotal} câu đúng</span>
              </p>
              <p className="mt-3 text-sm text-ink-soft">
                Điểm quy đổi 990 chỉ tính khi làm đủ 100 câu Listening và/hoặc 100 câu Reading của một đề đầy đủ.
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Đúng" value={r.correctCount} />
        <Stat label="Sai" value={r.incorrectCount} />
        <Stat label="Chưa làm" value={r.unansweredCount} />
        <Stat label="Thời gian làm" value={formatClock(r.durationSeconds)} />
      </div>

      {staffView ? <FocusNote focus={r.focus} /> : null}

      <Card className="p-5">
        <h2 className="serif text-2xl">Kết quả theo Part</h2>
        <div className="mt-4 grid gap-4">
          {r.parts.map((p) => (
            <div key={p.partCode}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{partName(p.partCode)}</span>
                <span className="text-ink-soft tabular-nums">
                  {p.correct}/{p.total} • {p.accuracy}%
                </span>
              </div>
              <ProgressBar className="mt-1.5" value={p.accuracy} />
            </div>
          ))}
        </div>
      </Card>

      <MissedAnswers attemptId={r.attempt.id} staffView={staffView} reviewTo={reviewTo} />

      <div className="flex flex-wrap gap-3">
        {staffView ? (
          <Link to={`/admin/students/${studentId}`}>
            <Button variant="navy">Hồ sơ học viên</Button>
          </Link>
        ) : (
          <>
            <Link to="/practice">
              <Button variant="navy">Làm đề khác</Button>
            </Link>
            <Link to="/progress">
              <Button variant="ghost">Xem tiến độ cá nhân</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function MissedAnswers({ attemptId, staffView, reviewTo }: { attemptId: string; staffView: boolean; reviewTo: string }) {
  const { data, isPending } = useAttemptReview(attemptId)
  const [textZoom, setTextZoom] = useState(1)
  const groups = useMemo(() => new Map((data?.groups ?? []).map((g) => [g.id, g])), [data])
  if (isPending) return <p className="text-sm text-ink-soft">Đang tải câu sai và câu chưa làm…</p>
  if (!data) {
    return (
      <Link to={reviewTo}>
        <Button>Xem bài làm chi tiết</Button>
      </Link>
    )
  }
  const missed = data.questions.filter((q) => q.isCorrect !== true)
  const wrongCount = missed.filter((q) => q.isCorrect === false).length
  const blankCount = missed.length - wrongCount
  const missedParts = new Set(missed.filter((q) => isListeningPart(q.partCode)).map((q) => q.partCode))
  const audio = data.audio.filter((t) => t.partCodes.some((code) => missedParts.has(code)))
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="serif text-2xl">Câu sai và câu chưa làm</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {missed.length === 0
              ? 'Không có câu sai hay câu chưa làm.'
              : `${wrongCount} câu sai, ${blankCount} câu chưa làm. Bài làm chi tiết có toàn bộ câu đúng và câu sai.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {missed.length > 0 ? <TextZoomBar scale={textZoom} onChange={setTextZoom} /> : null}
          <Link to={reviewTo}>
            <Button>Xem bài làm chi tiết</Button>
          </Link>
        </div>
      </div>
      {audio.length > 0 ? (
        <div className="grid gap-2">
          {audio.map((t) => (
            <AudioPlayer key={t.id} attemptId={data.result.attempt.id} tracks={[t]} partCode={t.partCodes[0]} mode="REVIEW" />
          ))}
        </div>
      ) : null}
      {missed.length > 0 ? <ReviewQuestionCards questions={missed} groups={groups} staffView={staffView} textZoom={textZoom} /> : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="serif text-3xl tabular-nums">{value}</p>
    </Card>
  )
}
