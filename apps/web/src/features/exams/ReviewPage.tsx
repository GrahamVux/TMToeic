import { Button } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Badge, Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AudioPlayer } from './AudioPlayer'
import { partName, useAttemptReview } from './exams.queries'
import { SelectableText } from '@/features/study/SelectableText'
import { PassageView } from './PassageView'
import { SheetGallery } from './SheetGallery'
import { examTextStyle, TextZoomBar, ZoomableImage } from './ZoomableImage'

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
    if (staffView) return <p className="p-8 text-sm text-ink/60">Học viên chưa nộp bài này nên chưa xem được bài làm chi tiết.</p>
    return <Navigate to={`/attempts/${attemptId}/play`} replace />
  }
  if (error || !data) return <QueryErrorRedirect error={error} />

  const resultTo = staffView ? `/admin/students/${studentId}/attempts/${data.result.attempt.id}` : `/attempts/${data.result.attempt.id}/result`

  const visible = data.questions.filter((q) => (filter === 'wrong' ? q.isCorrect === false : filter === 'blank' ? q.isCorrect === null : true))
  const shownGroups = new Set<string>()

  return (
    <div className="space-y-6">
      {staffView ? (
        <Link to={`/admin/students/${studentId}`} className="text-sm text-gold-deep">
          ← Quay lại hồ sơ học viên
        </Link>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink/50">{staffView ? 'Bài làm của học viên' : 'Chữa đề'}</p>
          <h1 className="serif mt-1 text-3xl">{data.result.attempt.examTitle}</h1>
          <p className="mt-1 text-sm text-ink/60">
            Đúng {data.result.correctCount} • Sai {data.result.incorrectCount} • Bỏ trống {data.result.unansweredCount}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TextZoomBar scale={textZoom} onChange={setTextZoom} />
          <Link to={resultTo}>
            <Button variant="navy">Về kết quả</Button>
          </Link>
        </div>
      </header>

      {data.audio.length > 0 ? (
        <div className="sticky top-2 z-10 grid gap-2">
          {data.audio.map((t) => (
            <AudioPlayer key={t.id} attemptId={data.result.attempt.id} tracks={[t]} partCode={t.partCodes[0]} mode="REVIEW" />
          ))}
        </div>
      ) : null}

      <SheetGallery images={data.sheetImages} />

      <div className="flex flex-wrap gap-2">
        {([['all', 'Tất cả'], ['wrong', 'Câu sai'], ['blank', 'Bỏ trống']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn('rounded-full px-4 py-2 text-sm font-semibold', filter === id ? 'bg-gold-deep text-white' : 'bg-paper-2')}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? <p className="text-sm text-ink/55">Không có câu nào trong mục này.</p> : null}

      <div className="grid gap-4">
        {visible.map((q) => {
          const group = q.groupId ? groups.get(q.groupId) : undefined
          const showPassage = group && !shownGroups.has(group.id)
          if (group) shownGroups.add(group.id)
          return (
            <Card key={q.id} className="p-5">
              <div style={examTextStyle(textZoom)}>
              {showPassage ? (
                <div className="mb-4">
                  <PassageView group={group} />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink/50">{partName(q.partCode)} • Câu {q.number}</span>
                {q.isCorrect === true ? <Badge tone="olive">Đúng</Badge> : q.isCorrect === false ? <Badge tone="danger">Sai</Badge> : <Badge tone="paper">Bỏ trống</Badge>}
              </div>
              {q.imageUrl ? (
                <div className="mt-2">
                  <ZoomableImage src={q.imageUrl} alt={`Hình minh họa câu ${q.number}`} compact />
                </div>
              ) : null}
              {q.prompt ? <SelectableText className="mt-2 text-lg leading-8 font-medium" text={q.prompt} /> : null}
              <ul className="mt-3 grid gap-2">
                {q.options.map((o) => {
                  const isCorrect = o.key === q.correctKey
                  const isPicked = o.key === q.selectedKey
                  return (
                    <li
                      key={o.key}
                      className={cn(
                        'rounded-xl border px-4 py-2.5 text-sm',
                        isCorrect ? 'border-olive/50 bg-[#e4efd8]' : isPicked ? 'border-coral/50 bg-[#f8dcd8]' : 'border-ink/10',
                      )}
                    >
                      <span className="mr-2 font-bold">{o.key}.</span>
                      {o.text}
                      {isCorrect ? <span className="ml-2 text-xs font-semibold text-olive">Đáp án đúng</span> : null}
                      {isPicked && !isCorrect ? (
                        <span className="ml-2 text-xs font-semibold text-coral">{staffView ? 'Học viên chọn' : 'Bạn chọn'}</span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
