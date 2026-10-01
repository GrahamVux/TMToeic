import { Button } from '@/components/ui/Button'
import { Badge, Card, Input } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { partName, useExams } from '@/features/exams/exams.queries'
import { useStudents } from '@/features/teacher/users.queries'
import type { ExamSummaryDto } from '@toeic/shared'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAssignments, useCloseAssignment, useCreateAssignment } from '@/features/assignments/assignments.queries'

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TeacherAssignmentsPage() {
  const exams = useExams()
  const assignments = useAssignments()
  const create = useCreateAssignment()
  const close = useCloseAssignment()
  const students = useStudents({ q: '', status: 'ACTIVE', page: 1, pageSize: 100 })
  const [params] = useSearchParams()

  const published = (exams.data ?? []).filter((e) => e.status === 'PUBLISHED')
  const [examId, setExamId] = useState(params.get('examId') ?? '')
  const [partCodes, setPartCodes] = useState<string[]>(params.get('parts')?.split(',').filter(Boolean) ?? [])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [minutes, setMinutes] = useState(20)
  const [dueAt, setDueAt] = useState(() => toLocalInput(new Date(Date.now() + 3 * 86_400_000)))
  const [allStudents, setAllStudents] = useState(true)
  const [picked, setPicked] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const exam = published.find((e) => e.id === examId) ?? null

  useEffect(() => {
    const fromQuery = params.get('examId')
    if (fromQuery) setExamId(fromQuery)
    const parts = params.get('parts')
    if (parts) setPartCodes(parts.split(',').filter(Boolean))
  }, [params])

  useEffect(() => {
    if (!exam) return
    setPartCodes((prev) => prev.filter((c) => exam.parts.some((p) => p.code === c)))
  }, [exam])

  const selectedParts = exam?.parts.filter((p) => partCodes.includes(p.code)) ?? []
  const questionCount = selectedParts.reduce((s, p) => s + p.questionCount, 0)

  const roster = students.data?.items ?? []

  async function submit() {
    setFormError(null)
    if (!exam) {
      setFormError('Chọn một đề từ ngân hàng.')
      return
    }
    if (partCodes.length === 0) {
      setFormError('Chọn ít nhất một part.')
      return
    }
    if (title.trim().length < 3) {
      setFormError('Nhập tiêu đề bài tập.')
      return
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        examId: exam.id,
        partCodes,
        durationSeconds: Math.max(60, minutes * 60),
        dueAt: new Date(dueAt).toISOString(),
        studentIds: allStudents ? undefined : picked,
        publish: true,
      })
      setTitle('')
      setDescription('')
      setPartCodes([])
    } catch {
      setFormError('Không giao được bài. Kiểm tra đề đã xuất bản và danh sách học viên.')
    }
  }

  if (exams.error) return <QueryErrorRedirect error={exams.error} />
  if (assignments.error) return <QueryErrorRedirect error={assignments.error} />

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Giao bài từ ngân hàng đề</p>
        <h1 className="serif mt-2 text-3xl sm:text-4xl">Bài tập về nhà</h1>
        <p className="mt-2 text-sm text-ink/60">
          Mỗi đề trong ngân hàng đã tách theo part. Chọn các part cần giao, hoặc{' '}
          <Link to="/admin/exams" className="text-gold-deep">
            import đề tự soạn
          </Link>{' '}
          để cập nhật ngân hàng rồi giao.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <h2 className="serif text-2xl">1. Chọn đề & part</h2>
          {exams.isPending ? <p className="mt-3 text-sm text-ink/55">Đang tải ngân hàng…</p> : null}
          {published.length === 0 && !exams.isPending ? (
            <p className="mt-3 text-sm text-ink/60">
              Chưa có đề xuất bản.{' '}
              <Link to="/admin/exams" className="text-gold-deep">
                Vào kho đề để import
              </Link>
              .
            </p>
          ) : null}
          <div className="mt-4 space-y-3">
            {published.map((e) => (
              <ExamPick key={e.id} exam={e} selected={examId === e.id} partCodes={examId === e.id ? partCodes : []} onSelect={setExamId} onParts={setPartCodes} />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="serif text-2xl">2. Thông tin giao bài</h2>
          <label className="mt-4 block text-sm font-medium" htmlFor="asg-title">
            Tiêu đề
          </label>
          <Input id="asg-title" className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Part 5 + 6 tuần 12" />
          <label className="mt-3 block text-sm font-medium" htmlFor="asg-desc">
            Ghi chú cho học viên
          </label>
          <Input id="asg-desc" className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Không bắt buộc" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium" htmlFor="asg-min">
                Thời gian làm (phút)
              </label>
              <Input id="asg-min" className="mt-1" type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="asg-due">
                Hạn nộp
              </label>
              <Input id="asg-due" className="mt-1" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
          <p className="mt-3 text-sm text-ink/55">
            {exam ? `${exam.title} • ${selectedParts.length} part • ${questionCount} câu` : 'Chưa chọn đề'}
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allStudents} onChange={(e) => setAllStudents(e.target.checked)} />
            Giao cả lớp (học viên đang hoạt động)
          </label>
          {!allStudents ? (
            <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-gold/30 p-2">
              {roster.map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper">
                  <input
                    type="checkbox"
                    checked={picked.includes(u.id)}
                    onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))}
                  />
                  {u.fullName} <span className="text-ink/45">{u.studentCode}</span>
                </label>
              ))}
            </div>
          ) : null}
          {formError ? (
            <p className="mt-3 rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral" role="alert">
              {formError}
            </p>
          ) : null}
          <Button className="mt-4 w-full" disabled={create.isPending} onClick={() => void submit()}>
            {create.isPending ? 'Đang giao…' : 'Giao bài tập'}
          </Button>
        </Card>
      </div>

      <section>
        <h2 className="serif text-2xl">Bài đã giao ({assignments.data?.length ?? 0})</h2>
        {assignments.isPending ? <p className="mt-3 text-sm text-ink/55">Đang tải…</p> : null}
        <div className="mt-3 grid gap-3">
          {(assignments.data ?? []).map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={a.status === 'PUBLISHED' ? 'olive' : a.status === 'CLOSED' ? 'paper' : 'warn'}>{a.status}</Badge>
                  <h3 className="mt-2 font-semibold">{a.title}</h3>
                  <p className="text-sm text-ink/55">
                    {a.examTitle} • {a.parts.map((p) => partName(p.code).split(' — ')[0]).join(', ')} • {a.submittedCount}/{a.studentCount} đã nộp
                    {a.dueAt ? ` • hạn ${new Date(a.dueAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                  </p>
                </div>
                {a.status === 'PUBLISHED' ? (
                  <Button variant="paper" disabled={close.isPending} onClick={() => void close.mutateAsync(a.id).catch(() => undefined)}>
                    Đóng bài
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function ExamPick({
  exam,
  selected,
  partCodes,
  onSelect,
  onParts,
}: {
  exam: ExamSummaryDto
  selected: boolean
  partCodes: string[]
  onSelect: (id: string) => void
  onParts: (codes: string[]) => void
}) {
  return (
    <div className={`rounded-2xl border p-4 ${selected ? 'border-gold-deep bg-teal-soft/40' : 'border-gold/30 bg-white'}`}>
      <button type="button" className="w-full text-left" onClick={() => onSelect(exam.id)}>
        <p className="font-semibold">{exam.title}</p>
        <p className="text-xs text-ink/50">
          {exam.code} • {exam.totalQuestions} câu
        </p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        {exam.parts.map((p) => {
          const on = selected && partCodes.includes(p.code)
          return (
            <button
              key={p.code}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${on ? 'bg-gold-deep text-white' : 'bg-paper-2 text-ink/70'}`}
              onClick={() => {
                if (!selected) {
                  onSelect(exam.id)
                  onParts([p.code])
                  return
                }
                onParts(partCodes.includes(p.code) ? partCodes.filter((c) => c !== p.code) : [...partCodes, p.code])
              }}
            >
              {partName(p.code).split(' — ')[0]} · {p.questionCount} câu
            </button>
          )
        })}
      </div>
    </div>
  )
}
