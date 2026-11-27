import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { partName, useExams, useStartAttempt } from '@/features/exams/exams.queries'
import { fold } from '@/features/practice/catalog'
import { FilterChip, PracticeTabs } from '@/features/practice/PracticeTabs'
import type { Skill } from '@toeic/shared'
import { Play, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/** Part-by-part drills over published exams (PART_DRILL attempts). Parts come from the data, not from the UI. */
export function PartDrills({ skill, title, subtitle }: { skill: Skill; title: string; subtitle: string }) {
  const exams = useExams()
  const start = useStartAttempt()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [part, setPart] = useState('all')
  const [startingKey, setStartingKey] = useState<string | null>(null)

  const cards = useMemo(
    () => (exams.data ?? []).flatMap((exam) => exam.parts.filter((item) => item.skill === skill).map((item) => ({ exam, part: item }))),
    [exams.data, skill],
  )
  const partOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const card of cards) seen.set(card.part.code, partName(card.part.code).split(' — ')[0] ?? card.part.code)
    return [...seen.entries()].map(([code, label]) => ({ code, label }))
  }, [cards])
  const needle = fold(query.trim())
  const visible = cards.filter((card) => {
    if (part !== 'all' && card.part.code !== part) return false
    if (!needle) return true
    return fold(card.exam.title).includes(needle) || fold(card.exam.code).includes(needle) || fold(partName(card.part.code)).includes(needle)
  })

  if (exams.error) return <QueryErrorRedirect error={exams.error} />

  async function begin(examId: string, partCode: string) {
    setStartingKey(`${examId}:${partCode}`)
    try {
      const created = await start.mutateAsync({ examId, mode: 'PART_DRILL', partCodes: [partCode] })
      navigate(`/attempts/${created.id}/play`)
    } catch {
      // shown below
    } finally {
      setStartingKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <PracticeTabs />
      <section className="flex flex-col gap-4 rounded-2xl bg-banner px-5 py-4 text-banner-ink lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <p className="mt-1 text-sm text-banner-ink/80">{subtitle}</p>
        </div>
        <label className="relative w-full lg:max-w-md">
          <span className="sr-only">Tìm đề theo tên</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            className="h-11 w-full rounded-full border border-ink/10 bg-cream pr-4 pl-9 text-sm text-ink outline-none placeholder:text-ink/60 focus:ring-2 focus:ring-button/40"
            value={query}
            placeholder="Tìm đề theo tên..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tracking-[0.06em] text-ink-soft uppercase">Bộ lọc nhanh</span>
        <FilterChip active={part === 'all'} onClick={() => setPart('all')}>
          Tất cả
        </FilterChip>
        {partOptions.map((item) => (
          <FilterChip key={item.code} active={part === item.code} onClick={() => setPart(item.code)}>
            {item.label}
          </FilterChip>
        ))}
      </div>

      {start.error ? (
        <p className="rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger" role="alert">
          Không bắt đầu được bài luyện.
        </p>
      ) : null}
      {exams.isPending ? <p className="text-sm text-ink-soft">Đang tải…</p> : null}
      {exams.data && cards.length === 0 ? <Card className="p-6 text-sm text-ink-soft">Chưa có đề nào có phần này.</Card> : null}
      {exams.data && cards.length > 0 && visible.length === 0 ? <Card className="p-6 text-sm text-ink-soft">Không có bài khớp tên hoặc part này.</Card> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(({ exam, part: item }) => {
          const busy = startingKey === `${exam.id}:${item.code}`
          return (
            <Card key={`${exam.id}-${item.code}`} className="flex h-full flex-col p-5">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={skill === 'LISTENING' ? 'teal' : 'gold'}>{item.code.replace('PART_', 'Part ')}</Badge>
                <span className="text-sm text-ink-soft tabular-nums">{item.questionCount} câu</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold">{partName(item.code).split(' — ')[0]}</h2>
              <p className="mt-1 text-sm text-ink-soft">{exam.title}</p>
              <div className="mt-auto pt-4">
                <Button className="w-full" disabled={start.isPending} onClick={() => void begin(exam.id, item.code)}>
                  <Play className="size-4" /> {busy ? 'Đang mở…' : 'Bắt đầu luyện'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
