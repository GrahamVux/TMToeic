import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useExams, useStartAttempt } from '@/features/exams/exams.queries'
import type { Skill } from '@toeic/shared'
import { useNavigate } from 'react-router-dom'

/** Part-by-part drills over published exams (PART_DRILL attempts). Parts come from the data, not from the UI. */
export function PartDrills({ skill, title, subtitle }: { skill: Skill; title: string; subtitle: string }) {
  const exams = useExams()
  const start = useStartAttempt()
  const navigate = useNavigate()

  const cards = (exams.data ?? []).flatMap((exam) => exam.parts.filter((p) => p.skill === skill).map((part) => ({ exam, part })))

  if (exams.error) return <QueryErrorRedirect error={exams.error} />

  async function begin(examId: string, partCode: string) {
    try {
      const a = await start.mutateAsync({ examId, mode: 'PART_DRILL', partCodes: [partCode] })
      navigate(`/attempts/${a.id}/play`)
    } catch {
      // shown below
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs text-ink/50">Luyện tập ETS L&R / {title}</p>
        <h1 className="serif mt-2 text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink/60">{subtitle}</p>
      </header>
      {start.error ? (
        <p className="rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">
          Không bắt đầu được bài luyện.
        </p>
      ) : null}
      {exams.isPending ? <p className="text-sm text-ink/55">Đang tải…</p> : null}
      {exams.data && cards.length === 0 ? <Card className="p-6 text-sm text-ink/60">Chưa có đề nào có phần này.</Card> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(({ exam, part }) => (
          <Card key={`${exam.id}-${part.code}`} className="p-5">
            <div className="flex items-center justify-between">
              <Badge tone={skill === 'LISTENING' ? 'teal' : 'gold'}>{part.code.replace('PART_', 'Part ')}</Badge>
              <span className="text-sm text-ink/50">{part.questionCount} câu</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold">{part.name}</h2>
            <p className="mt-1 text-sm text-ink/55">{exam.title}</p>
            <Button className="mt-4 w-full" variant={skill === 'LISTENING' ? 'teal' : 'gold'} disabled={start.isPending} onClick={() => void begin(exam.id, part.code)}>
              Bắt đầu luyện tập
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
