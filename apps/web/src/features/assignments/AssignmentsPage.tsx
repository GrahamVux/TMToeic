import { Button } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { partName } from '@/features/exams/exams.queries'
import type { AssignmentDto, StudentAssignmentStatus } from '@toeic/shared'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssignments, useStartAssignment } from './assignments.queries'

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'open', label: 'Cần làm' },
  { id: 'done', label: 'Đã nộp' },
] as const

function tone(status: StudentAssignmentStatus): 'olive' | 'warn' | 'danger' | 'gold' {
  if (status === 'COMPLETED') return 'olive'
  if (status === 'OVERDUE') return 'danger'
  if (status === 'IN_PROGRESS') return 'warn'
  return 'gold'
}

function label(status: StudentAssignmentStatus) {
  if (status === 'COMPLETED') return 'Đã nộp'
  if (status === 'OVERDUE') return 'Quá hạn'
  if (status === 'IN_PROGRESS') return 'Đang làm'
  return 'Chưa làm'
}

function dueText(iso: string | null) {
  if (!iso) return 'Không hạn nộp'
  const d = new Date(iso)
  return `Hạn ${d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}`
}

export function AssignmentsPage() {
  const { data, isPending, error } = useAssignments()
  const start = useStartAssignment()
  const navigate = useNavigate()
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('all')

  const items = useMemo(() => {
    const list = data ?? []
    if (tab === 'done') return list.filter((a) => a.myProgress?.status === 'COMPLETED')
    if (tab === 'open') return list.filter((a) => a.myProgress?.status !== 'COMPLETED')
    return list
  }, [data, tab])

  async function begin(a: AssignmentDto) {
    const progress = a.myProgress
    if (progress?.status === 'COMPLETED' && progress.attemptId) {
      navigate(`/attempts/${progress.attemptId}/result`)
      return
    }
    if (progress?.status === 'IN_PROGRESS' && progress.attemptId) {
      navigate(`/attempts/${progress.attemptId}/play`)
      return
    }
    try {
      const attempt = await start.mutateAsync(a.id)
      navigate(`/attempts/${attempt.id}/play`)
    } catch {
      // generic banner below
    }
  }

  if (isPending) return <PageLoading message="Đang tải bài tập…" />
  if (error) return <QueryErrorRedirect error={error} />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="serif text-3xl sm:text-4xl">Bài tập Thầy giao</h1>
        <p className="mt-2 text-sm text-ink/60">Làm đúng part được giao, nộp trước hạn. Kết quả vào tiến độ lớp.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t.id ? 'bg-button text-button-ink' : 'bg-paper-2'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'all' ? ` (${data?.length ?? 0})` : ''}
          </button>
        ))}
      </div>
      {start.error ? (
        <p className="rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger" role="alert">
          Không bắt đầu được bài tập. Kiểm tra hạn nộp hoặc liên hệ Thầy Minh.
        </p>
      ) : null}
      {items.length === 0 ? (
        <Card className="p-6 text-sm text-ink/60">Chưa có bài tập trong mục này.</Card>
      ) : (
        <div className="space-y-4">
          {items.map((a) => {
            const st = a.myProgress?.status ?? 'ASSIGNED'
            const total = a.myProgress?.totalQuestions ?? a.parts.reduce((s, p) => s + p.questionCount, 0)
            const answered = a.myProgress?.answeredCount ?? 0
            const pct = st === 'COMPLETED' ? 100 : total ? Math.round((answered / total) * 100) : 0
            return (
              <Card key={a.id} className="p-6">
                <Badge tone={tone(st)}>{label(st)}</Badge>
                <h2 className="mt-3 text-xl font-semibold">{a.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {a.examTitle} • {a.parts.map((p) => partName(p.code).split(' — ')[0]).join(', ')} • {total} câu • {Math.round(a.durationSeconds / 60)} phút
                </p>
                {a.description ? <p className="mt-2 text-sm leading-6 text-ink/65">{a.description}</p> : null}
                <p className="mt-3 text-sm font-medium">{dueText(a.dueAt)}</p>
                <ProgressBar className="mt-2" value={pct} />
                <Button
                  className="mt-4"
                  variant="navy"
                  disabled={start.isPending || st === 'OVERDUE'}
                  onClick={() => void begin(a)}
                >
                  {st === 'COMPLETED' ? 'Xem kết quả' : st === 'IN_PROGRESS' ? 'Làm tiếp' : st === 'OVERDUE' ? 'Đã hết hạn' : 'Bắt đầu làm'}
                </Button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
