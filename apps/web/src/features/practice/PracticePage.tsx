import { Button, buttonClasses } from '@/components/ui/Button'
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

      <section className="flex flex-col gap-4 rounded-2xl bg-banner px-5 py-4 text-banner-ink lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="serif text-xl font-bold tracking-tight sm:text-2xl">Kho đề thi thử</h1>
          <p className="mt-1 text-sm text-banner-ink/85">Luyện tập làm tiếp được. Thi thử rời bài là kết thúc lượt đó.</p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row lg:max-w-xl">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Tìm đề theo tên</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
            <input
              className="h-11 w-full rounded-full border border-ink/10 bg-cream pr-4 pl-9 text-sm text-ink outline-none placeholder:text-ink/60 focus:ring-2 focus:ring-banner-ink/70"
              value={query}
              placeholder="Tìm đề theo tên..."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-banner-ink px-4 text-sm font-semibold text-banner shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-banner-ink/80 disabled:opacity-50"
            disabled={start.isPending || visible.length === 0}
            onClick={startNewest}
          >
            <Play className="size-4 fill-current" /> Làm đề mới nhất
          </button>
        </div>
      </section>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tracking-[0.06em] text-ink-soft uppercase">Bộ lọc nhanh</span>
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
            <span className="text-sm font-semibold tracking-[0.06em] text-ink-soft uppercase">Bộ đề</span>
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
        <p className="rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger" role="alert">
          Không bắt đầu được bài làm.
        </p>
      ) : null}

      {exams.isPending ? <p className="text-sm text-ink-soft">Đang tải…</p> : null}
      {!exams.isPending && bank.length === 0 ? <Card className="p-6 text-sm text-ink-soft">Chưa có đề nào được mở. Giáo viên sẽ xuất bản đề sớm.</Card> : null}
      {!exams.isPending && bank.length > 0 && visible.length === 0 ? <Card className="p-6 text-sm text-ink-soft">Không có đề khớp tên hoặc bộ lọc này.</Card> : null}

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
      <p className="mt-2 text-sm font-semibold text-ink tabular-nums">
        {best !== null ? `Điểm cao nhất: ${best}/990` : `${exam.totalQuestions} câu`}
      </p>
      <p className="mt-1 text-sm text-ink-soft tabular-nums">
        {practice
          ? `Luyện tập: ${practice.attempt.answeredCount}/${practice.attempt.totalQuestions} câu`
          : finished.length > 0
            ? 'Bạn đã hoàn thành một lượt làm bài.'
            : `${minutes} phút khi thi thử`}
      </p>
      <div className="mt-auto grid gap-2 pt-4">
        <Button variant="gold" className="w-full shadow-sm" disabled={busy} onClick={() => onStart('FULL_TEST')}>
          <Play className="size-4 fill-current" /> Thi thử
        </Button>
        {practice ? (
          <Link to={`/attempts/${practice.attempt.id}/play`} className={buttonClasses('navy', 'w-full')}>
            Tiếp tục luyện tập
          </Link>
        ) : (
          <Button variant="navy" className="w-full" disabled={busy} onClick={() => onStart('PRACTICE')}>
            Luyện tập
          </Button>
        )}
        {review ? (
          <Link
            to={`/attempts/${review.attempt.id}/review`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-gold/45 bg-paper px-4 py-1.5 text-sm font-semibold text-navy transition hover:border-button/50 hover:bg-teal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
          >
            Chữa đề
          </Link>
        ) : null}
      </div>
    </Card>
  )
}
