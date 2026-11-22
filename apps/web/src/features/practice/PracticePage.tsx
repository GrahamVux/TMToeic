import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useAttempts, useExams, useStartAttempt } from '@/features/exams/exams.queries'
import { cn } from '@/lib/cn'
import type { AttemptResultDto, ExamSummaryDto } from '@toeic/shared'
import { Play, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { examKind, examSeries, kindBadge, kindLabel, matchesName, type ExamKind } from './catalog'
import { FilterChip, PracticeTabs } from './PracticeTabs'

type KindFilter = 'all' | ExamKind

export function PracticePage() {
  const exams = useExams()
  const attempts = useAttempts()
  const start = useStartAttempt()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilter | null>(null)
  const [series, setSeries] = useState('all')

  const all = attempts.data ?? []
  const bank = exams.data ?? []
  const fullCount = bank.filter((exam) => examKind(exam.parts) === 'full').length
  const activeKind: KindFilter = kind ?? (fullCount > 0 ? 'full' : 'all')
  const seriesOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const exam of bank) {
      const item = examSeries(exam)
      seen.set(item.key, item.label)
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [bank])
  const showSeries = seriesOptions.some((item) => item.label !== 'Khác') || seriesOptions.length > 1

  const visible = bank.filter((exam) => {
    if (!matchesName(exam, query)) return false
    if (activeKind !== 'all' && examKind(exam.parts) !== activeKind) return false
    if (series !== 'all' && examSeries(exam).key !== series) return false
    return true
  })

  if (exams.error) return <QueryErrorRedirect error={exams.error} />

  async function begin(exam: ExamSummaryDto, mode: 'PRACTICE' | 'FULL_TEST') {
    if (mode === 'PRACTICE') {
      const live = all.find((item) => item.attempt.examId === exam.id && item.attempt.mode === 'PRACTICE' && item.attempt.status === 'IN_PROGRESS')
      if (live) {
        navigate(`/attempts/${live.attempt.id}/play`)
        return
      }
    }
    try {
      const created = await start.mutateAsync({ examId: exam.id, mode })
      navigate(`/attempts/${created.id}/play`)
    } catch {
      // shown below
    }
  }

  function startNewest() {
    const target = [...visible].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))[0]
    if (target) void begin(target, 'FULL_TEST')
  }

  return (
    <div className="space-y-5">
      <PracticeTabs />

      <section className="flex flex-col gap-4 rounded-2xl bg-gold-deep px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Kho đề thi thử</h1>
          <p className="mt-1 text-sm text-white/80">Luyện tập làm tiếp được. Thi thử rời bài là kết thúc lượt đó.</p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row lg:max-w-xl">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Tìm đề theo tên</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink/40" />
            <input
              className="h-11 w-full rounded-full border-0 bg-white pr-4 pl-9 text-sm text-ink outline-none placeholder:text-ink/40"
              value={query}
              placeholder="Tìm đề theo tên..."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-button px-4 text-sm font-semibold text-button-ink hover:bg-button-hover disabled:opacity-50"
            disabled={start.isPending || visible.length === 0}
            onClick={startNewest}
          >
            <Play className="size-4" /> Làm đề mới nhất
          </button>
        </div>
      </section>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-ink/45 uppercase">Bộ lọc nhanh</span>
          <FilterChip active={activeKind === 'all'} onClick={() => setKind('all')}>
            Tất cả
          </FilterChip>
          {(['full', 'listening', 'reading'] as const).map((item) => (
            <FilterChip key={item} active={activeKind === item} onClick={() => setKind(item)}>
              {kindLabel(item)}
            </FilterChip>
          ))}
        </div>
        {showSeries ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-ink/45 uppercase">Bộ đề</span>
            <FilterChip active={series === 'all'} onClick={() => setSeries('all')}>
              Tất cả
            </FilterChip>
            {seriesOptions.map((item) => (
              <FilterChip key={item.key} active={series === item.key} onClick={() => setSeries(item.key)}>
                {item.label}
              </FilterChip>
            ))}
          </div>
        ) : null}
      </div>

      {start.error ? (
        <p className="rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">
          Không bắt đầu được bài làm.
        </p>
      ) : null}

      {exams.isPending ? <p className="text-sm text-ink/55">Đang tải…</p> : null}
      {!exams.isPending && bank.length === 0 ? <Card className="p-6 text-sm text-ink/60">Chưa có đề nào được mở. Giáo viên sẽ xuất bản đề sớm.</Card> : null}
      {!exams.isPending && bank.length > 0 && visible.length === 0 ? <Card className="p-6 text-sm text-ink/60">Không có đề khớp tên hoặc bộ lọc này.</Card> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((exam) => (
          <ExamCard key={exam.id} exam={exam} attempts={all.filter((item) => item.attempt.examId === exam.id)} busy={start.isPending} onStart={(mode) => void begin(exam, mode)} />
        ))}
      </div>
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
  onStart: (mode: 'PRACTICE' | 'FULL_TEST') => void
}) {
  const practice = attempts.find((item) => item.attempt.mode === 'PRACTICE' && item.attempt.status === 'IN_PROGRESS')
  const finished = attempts.filter((item) => item.attempt.status === 'SUBMITTED' || item.attempt.status === 'EXPIRED')
  const review = [...finished].sort((a, b) => (b.attempt.submittedAt ?? '').localeCompare(a.attempt.submittedAt ?? ''))[0]
  const best = finished.reduce<number | null>((score, item) => (item.totalScore === null ? score : score === null ? item.totalScore : Math.max(score, item.totalScore)), null)
  const kind = examKind(exam.parts)
  const minutes = Math.round(exam.durationSeconds / 60)
  const status = practice ? 'Đang luyện' : finished.length > 0 ? 'Hoàn thành' : 'Chưa làm'
  const tone = practice ? 'warn' : finished.length > 0 ? 'olive' : 'paper'
  return (
    <Card className={cn('flex h-full flex-col p-5', practice ? 'border-warn/70' : '')}>
      <div className="flex items-start justify-between gap-2">
        <Badge tone={kind === 'listening' ? 'teal' : kind === 'reading' ? 'gold' : 'ink'}>{kindBadge(kind)}</Badge>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight">{exam.title}</h2>
      <p className="mt-2 text-sm font-medium text-ink/80">{best !== null ? `Điểm cao nhất: ${best}` : `${exam.totalQuestions} câu`}</p>
      <p className="mt-1 text-sm text-ink/55">
        {practice
          ? `Luyện tập: ${practice.attempt.answeredCount}/${practice.attempt.totalQuestions} câu`
          : finished.length > 0
            ? 'Bạn đã hoàn thành một lượt làm bài.'
            : `${minutes} phút khi thi thử`}
      </p>
      <div className="mt-4 grid gap-2">
        <Button className="w-full" disabled={busy} onClick={() => onStart('FULL_TEST')}>
          <Play className="size-4" /> Thi thử
        </Button>
        {practice ? (
          <Link to={`/attempts/${practice.attempt.id}/play`} className="block">
            <Button variant="navy" className="w-full">
              Tiếp tục luyện tập
            </Button>
          </Link>
        ) : (
          <Button variant="navy" className="w-full" disabled={busy} onClick={() => onStart('PRACTICE')}>
            Luyện tập
          </Button>
        )}
        {review ? (
          <Link to={`/attempts/${review.attempt.id}/review`} className="block text-center text-sm font-semibold text-gold-deep">
            Chữa đề
          </Link>
        ) : null}
      </div>
    </Card>
  )
}
