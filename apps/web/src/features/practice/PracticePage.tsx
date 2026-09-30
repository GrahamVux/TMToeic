import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { useAttempts, useExams, useStartAttempt } from '@/features/exams/exams.queries'
import { ApiError } from '@/lib/api'
import type { AttemptResultDto, ExamSummaryDto } from '@toeic/shared'
import { Link, useNavigate } from 'react-router-dom'

const MODE_LABEL: Record<string, string> = { PRACTICE: 'Luyện tập', TIMED: 'Tính giờ', FULL_TEST: 'Thi thử', PART_DRILL: 'Luyện part' }

export function PracticePage() {
  const exams = useExams()
  const attempts = useAttempts()
  const start = useStartAttempt()
  const navigate = useNavigate()

  const all = attempts.data ?? []
  const finished = all.filter((a) => a.attempt.status !== 'IN_PROGRESS')
  const questionsDone = finished.reduce((s, a) => s + a.correctCount + a.incorrectCount + a.unansweredCount, 0)
  const correct = finished.reduce((s, a) => s + a.correctCount, 0)
  const accuracy = questionsDone ? Math.round((correct / questionsDone) * 1000) / 10 : null
  const lastScaled = finished.find((a) => a.totalScore !== null)

  async function begin(exam: ExamSummaryDto, mode: 'PRACTICE' | 'FULL_TEST') {
    try {
      const a = await start.mutateAsync({ examId: exam.id, mode })
      navigate(`/attempts/${a.id}/play`)
    } catch {
      // surfaced via start.error below
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs text-ink/50">Trang chủ / Luyện tập ETS L&R</p>
        <h1 className="serif mt-2 text-4xl">Luyện đề TOEIC</h1>
        <p className="mt-2 text-sm text-ink/60">
          Đã hoàn thành {finished.length} bài{lastScaled ? ` • Điểm gần nhất ${lastScaled.totalScore}/990` : ''}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-ink/45">Bài đã hoàn thành</p>
          <p className="serif text-3xl">{finished.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink/45">Tỷ lệ chính xác TB</p>
          <p className="serif text-3xl">{accuracy === null ? '—' : `${accuracy}%`}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink/45">Câu đã làm</p>
          <p className="serif text-3xl">{questionsDone}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ModeCard title="Luyện Listening" meta="Bài ngắn • Part 1–4" to="/practice/listening" />
        <ModeCard title="Luyện Reading" meta="Bài ngắn • Part 5–7" to="/practice/reading" />
      </div>

      {start.error ? (
        <p className="rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">
          {start.error instanceof ApiError ? start.error.message : 'Không bắt đầu được bài làm.'}
        </p>
      ) : null}

      <section className="grid gap-4">
        <h2 className="serif text-2xl">Kho đề</h2>
        {exams.isPending ? <p className="text-sm text-ink/55">Đang tải…</p> : null}
        {exams.error ? <p className="text-sm text-coral">Không tải được danh sách đề.</p> : null}
        {exams.data?.length === 0 ? <Card className="p-6 text-sm text-ink/60">Chưa có đề nào được mở. Giáo viên sẽ publish đề sớm.</Card> : null}
        {exams.data?.map((exam) => (
          <ExamCard key={exam.id} exam={exam} attempts={all.filter((a) => a.attempt.examId === exam.id)} busy={start.isPending} onStart={begin} />
        ))}
      </section>
    </div>
  )
}

function ExamCard({
  exam,
  attempts,
  busy,
  onStart,
}: {
  exam: ExamSummaryDto
  attempts: AttemptResultDto[]
  busy: boolean
  onStart: (exam: ExamSummaryDto, mode: 'PRACTICE' | 'FULL_TEST') => void
}) {
  const live = attempts.filter((a) => a.attempt.status === 'IN_PROGRESS')
  const last = attempts.find((a) => a.attempt.status !== 'IN_PROGRESS')
  const minutes = Math.round(exam.durationSeconds / 60)
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <div className="flex flex-wrap gap-2">
          {exam.parts.map((p) => (
            <Badge key={p.code} tone={p.skill === 'LISTENING' ? 'teal' : 'gold'}>
              {p.code.replace('PART_', 'Part ')}
            </Badge>
          ))}
          {live.length > 0 ? <Badge tone="warn">Đang làm dở</Badge> : last ? <Badge tone="olive">Đã hoàn thành</Badge> : null}
        </div>
        <h3 className="mt-2 text-lg font-semibold">{exam.title}</h3>
        <p className="text-sm text-ink/55">
          {minutes} phút • {exam.totalQuestions} câu
        </p>
        {last ? (
          <p className="mt-1 text-sm">
            Lần gần nhất: {last.totalScore !== null ? `${last.totalScore}/990` : `${last.correctCount}/${last.correctCount + last.incorrectCount + last.unansweredCount} câu đúng`}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {live.map((a) => (
          <Link key={a.attempt.id} to={`/attempts/${a.attempt.id}/play`}>
            <Button>Tiếp tục ({MODE_LABEL[a.attempt.mode] ?? a.attempt.mode})</Button>
          </Link>
        ))}
        {last ? (
          <Link to={`/attempts/${last.attempt.id}/review`}>
            <Button variant="paper">Chữa đề</Button>
          </Link>
        ) : null}
        <Button variant="navy" disabled={busy} onClick={() => onStart(exam, 'PRACTICE')}>
          Luyện tập
        </Button>
        <Button variant="navy" disabled={busy} onClick={() => onStart(exam, 'FULL_TEST')}>
          Thi thử tính giờ
        </Button>
      </div>
    </Card>
  )
}

function ModeCard({ title, meta, to }: { title: string; meta: string; to: string }) {
  return (
    <Link to={to}>
      <Card className="p-5 transition hover:-translate-y-0.5">
        <h3 className="serif text-2xl">{title}</h3>
        <p className="mt-2 text-sm text-ink/55">{meta}</p>
        <p className="mt-4 text-sm font-semibold">Vào luyện →</p>
      </Card>
    </Link>
  )
}
