import { Button } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ReadingMarksProvider } from '@/features/study/ReadingMarks'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AudioPlayer } from './AudioPlayer'
import { useAttemptReview } from './exams.queries'
import { FocusNote } from './FocusNote'
import { ReviewQuestionCards } from './ReviewQuestions'
import { SheetGallery } from './SheetGallery'
import { TextZoomBar } from './ZoomableImage'

type Filter = 'all' | 'wrong' | 'blank'

export function ReviewPage() {
  const { attemptId, studentId } = useParams()
  const staffView = Boolean(studentId)
  const { data, isPending, error } = useAttemptReview(attemptId)
  const [filter, setFilter] = useState<Filter>('all')
  const [textZoom, setTextZoom] = useState(1)

  const groups = useMemo(() => new Map((data?.groups ?? []).map((g) => [g.id, g])), [data])

  if (isPending) return <PageLoading message="Đang tải bài chữa…" />
  if (error instanceof ApiError && error.status === 409) {
    if (staffView) return <p className="p-8 text-sm text-ink-soft">Học viên chưa nộp bài này nên chưa xem được bài làm chi tiết.</p>
    return <Navigate to={`/attempts/${attemptId}/play`} replace />
  }
  if (error || !data) return <QueryErrorRedirect error={error} />

  const resultTo = staffView ? `/admin/students/${studentId}/attempts/${data.result.attempt.id}` : `/attempts/${data.result.attempt.id}/result`

  const visible = data.questions.filter((q) => (filter === 'wrong' ? q.isCorrect === false : filter === 'blank' ? q.isCorrect === null : true))

  return (
    <ReadingMarksProvider examId={data.result.attempt.examId}>
    <div className="space-y-6">
      {staffView ? (
        <Link to={`/admin/students/${studentId}`} className="text-sm text-gold-deep">
          ← Quay lại hồ sơ học viên
        </Link>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-soft">{staffView ? 'Bài làm chi tiết của học viên' : 'Bài làm chi tiết'}</p>
          <h1 className="serif mt-1 text-3xl">{data.result.attempt.examTitle}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Đúng {data.result.correctCount} • Sai {data.result.incorrectCount} • Chưa làm {data.result.unansweredCount}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TextZoomBar scale={textZoom} onChange={setTextZoom} />
          <Link to={resultTo}>
            <Button variant="navy">Về kết quả</Button>
          </Link>
        </div>
      </header>

      {staffView ? <FocusNote focus={data.result.focus} /> : null}

      {data.audio.length > 0 ? (
        <div className="sticky top-2 z-10 grid gap-2">
          {data.audio.map((t) => (
            <AudioPlayer key={t.id} attemptId={data.result.attempt.id} tracks={[t]} partCode={t.partCodes[0]} mode="REVIEW" />
          ))}
        </div>
      ) : null}

      {data.sheetImages.length > 0 ? (
        <Card className="min-w-0 p-5">
          <SheetGallery images={data.sheetImages} embedded />
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {([['all', 'Tất cả'], ['wrong', 'Câu sai'], ['blank', 'Chưa làm']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn('rounded-full px-4 py-2 text-sm font-semibold', filter === id ? 'bg-button text-button-ink' : 'bg-paper-2')}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? <p className="text-sm text-ink-soft">Không có câu nào trong mục này.</p> : (
        <ReviewQuestionCards questions={visible} groups={groups} staffView={staffView} textZoom={textZoom} />
      )}
    </div>
    </ReadingMarksProvider>
  )
}
