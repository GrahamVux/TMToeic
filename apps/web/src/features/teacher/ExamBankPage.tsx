import { useImportAuthoredExam } from '@/features/assignments/assignments.queries'
import { Button } from '@/components/ui/Button'
import { Badge, Card, Input } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { partName, useArchiveExam, useExams, usePublishExam } from '@/features/exams/exams.queries'
import { ApiError } from '@/lib/api'
import { ERROR_CODES, OPTION_KEYS, PART_SEED, type ExamStatus, type ImportAuthoredExamInput } from '@toeic/shared'
import { FileUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export function ExamBankPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Kho đề & ngân hàng câu hỏi</p>
        <h1 className="serif mt-2 text-3xl sm:text-4xl">Ngân hàng đề — mỗi part là một nhóm giao bài</h1>
        <p className="mt-2 text-sm text-ink/60">
          Import đề ETS hoặc đề tự soạn. Hệ thống tách theo part; giáo viên chọn part để tạo bài tập.
        </p>
      </div>
      <AuthoredImport />
      <ExamList />
    </div>
  )
}

function newExamCode() {
  return `GV-${Date.now().toString(36).toUpperCase()}`
}

function AuthoredImport() {
  const importExam = useImportAuthoredExam()
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(20)
  const [partCode, setPartCode] = useState('PART_5')
  const [rows, setRows] = useState([{ prompt: '', a: '', b: '', c: '', d: '', correct: 'A' }])
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  function addRow() {
    setRows((r) => [...r, { prompt: '', a: '', b: '', c: '', d: '', correct: 'A' }])
  }

  async function submitBuilder() {
    setJsonError(null)
    setOk(null)
    const filled = rows.map((r) => ({ ...r, prompt: r.prompt.trim() })).filter((r) => r.prompt.length > 0)
    if (title.trim().length < 3) {
      setJsonError('Nhập tên đề.')
      return
    }
    if (filled.length === 0) {
      setJsonError('Thêm ít nhất một câu hỏi.')
      return
    }
    const payload: ImportAuthoredExamInput = {
      code: newExamCode(),
      title: title.trim(),
      durationSeconds: Math.max(60, minutes * 60),
      difficulty: 'MEDIUM',
      parts: [{ partCode, questionStart: 1, questionEnd: filled.length }],
      publish: true,
      groups: [],
      questions: filled.map((r, i) => ({
        partCode,
        number: i + 1,
        prompt: r.prompt,
        options: [
          { key: 'A' as const, text: r.a, correct: r.correct === 'A' },
          { key: 'B' as const, text: r.b, correct: r.correct === 'B' },
          { key: 'C' as const, text: r.c, correct: r.correct === 'C' },
          { key: 'D' as const, text: r.d, correct: r.correct === 'D' },
        ],
      })),
    }
    try {
      const exam = await importExam.mutateAsync(payload)
      setOk(`Đã thêm “${exam.title}” vào ngân hàng (${exam.parts.map((p) => partName(p.code).split(' — ')[0]).join(', ')}).`)
      setTitle('')
      setRows([{ prompt: '', a: '', b: '', c: '', d: '', correct: 'A' }])
    } catch {
      setJsonError('Không import được đề. Kiểm tra mỗi câu có 4 lựa chọn và đúng 1 đáp án.')
    }
  }

  async function onJsonFile(file: File) {
    setJsonError(null)
    setOk(null)
    try {
      const raw = JSON.parse(await file.text()) as ImportAuthoredExamInput
      const exam = await importExam.mutateAsync({ ...raw, publish: raw.publish !== false })
      setOk(`Đã cập nhật ngân hàng: “${exam.title}”.`)
    } catch {
      setJsonError('File JSON không hợp lệ hoặc mã đề đã tồn tại.')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-dashed border-gold/30 p-6">
        <FileUp className="size-8 text-gold-deep" />
        <h2 className="serif mt-2 text-2xl">Import JSON đề tự soạn</h2>
        <p className="mt-2 text-sm text-ink/60">
          File gồm mã đề, tiêu đề, thời gian, danh sách part và câu hỏi. Sau khi import, các part xuất hiện trong ngân hàng để giao bài.
        </p>
        <label className="mt-4 inline-flex">
          <input
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onJsonFile(file)
              e.target.value = ''
            }}
          />
          <span className="inline-flex cursor-pointer rounded-full bg-gold-deep px-4 py-2 text-sm font-semibold text-white">Chọn file JSON</span>
        </label>
      </Card>

      <Card className="p-6">
        <h2 className="serif text-2xl">Soạn nhanh một part</h2>
        <label className="mt-3 block text-sm font-medium" htmlFor="au-title">
          Tên đề
        </label>
        <Input id="au-title" className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Part 5 — mệnh đề quan hệ" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium" htmlFor="au-part">
              Part
            </label>
            <select
              id="au-part"
              className="mt-1 h-10 w-full rounded-xl border border-ink/12 bg-white px-3 text-sm"
              value={partCode}
              onChange={(e) => setPartCode(e.target.value)}
            >
              {PART_SEED.filter((p) => p.skill === 'LISTENING' || p.skill === 'READING').map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="au-min">
              Thời gian (phút)
            </label>
            <Input id="au-min" className="mt-1" type="number" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} />
          </div>
        </div>
        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl bg-paper p-3">
              <p className="text-xs text-ink/45">Câu {i + 1}</p>
              <Input className="mt-1" placeholder="Đề bài" value={r.prompt} onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['a', 'b', 'c', 'd'] as const).map((k) => (
                  <Input
                    key={k}
                    placeholder={k.toUpperCase()}
                    value={r[k]}
                    onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                  />
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs">
                Đáp án đúng
                <select
                  className="h-8 rounded-lg border border-ink/12 bg-white px-2"
                  value={r.correct}
                  onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, correct: e.target.value } : x)))}
                >
                  {OPTION_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="paper" type="button" onClick={addRow}>
            + Thêm câu
          </Button>
          <Button type="button" disabled={importExam.isPending} onClick={() => void submitBuilder()}>
            {importExam.isPending ? 'Đang lưu…' : 'Thêm vào ngân hàng'}
          </Button>
        </div>
      </Card>

      {jsonError ? (
        <p className="rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral lg:col-span-2" role="alert">
          {jsonError}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-xl bg-[#e4efd8] p-3 text-sm text-olive lg:col-span-2" role="status">
          {ok}
        </p>
      ) : null}
    </div>
  )
}

const STATUS_TONE: Record<ExamStatus, 'olive' | 'warn' | 'paper' | 'danger' | 'teal'> = {
  DRAFT: 'paper',
  PROCESSING: 'teal',
  PENDING_REVIEW: 'warn',
  PUBLISHED: 'olive',
  ARCHIVED: 'paper',
  REJECTED: 'danger',
}

function ExamList() {
  const exams = useExams()
  const publish = usePublishExam()
  const archive = useArchiveExam()
  const error = publish.error ?? archive.error
  const problems = error instanceof ApiError ? ((error.details as { problems?: string[] } | undefined)?.problems ?? []) : []

  if (exams.error) return <QueryErrorRedirect error={exams.error} />

  return (
    <section>
      <h2 className="serif text-2xl">Kho đề ({exams.data?.length ?? 0})</h2>
      {error ? (
        <div className="mt-3 rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">
          <p>
            {error instanceof ApiError && error.code === ERROR_CODES.EXAM_NOT_READY
              ? 'Đề chưa sẵn sàng để xuất bản.'
              : 'Thao tác thất bại.'}
          </p>
          {problems.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {problems.slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {exams.isPending ? <p className="mt-3 text-sm text-ink/55">Đang tải…</p> : null}
      <div className="mt-3 grid gap-3">
        {exams.data?.map((exam) => (
          <Card key={exam.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge tone={STATUS_TONE[exam.status]}>{exam.status}</Badge>
                <h3 className="mt-2 font-semibold">{exam.title}</h3>
                <p className="text-sm text-ink/55">
                  {exam.code} • {Math.round(exam.durationSeconds / 60)} phút • {exam.totalQuestions} câu
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {exam.parts.map((p) => (
                    <span key={p.code} className="rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-semibold text-ink/70">
                      {partName(p.code).split(' — ')[0]} · {p.questionCount} câu
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {exam.status === 'PUBLISHED' ? (
                  <Link to={`/admin/assignments?examId=${exam.id}`}>
                    <Button>Giao bài từ part</Button>
                  </Link>
                ) : null}
                {exam.status === 'DRAFT' || exam.status === 'PENDING_REVIEW' || exam.status === 'REJECTED' || exam.status === 'ARCHIVED' ? (
                  <Button disabled={publish.isPending} onClick={() => publish.mutate(exam.id)}>
                    Publish
                  </Button>
                ) : null}
                {exam.status === 'PUBLISHED' ? (
                  <Button variant="paper" disabled={archive.isPending} onClick={() => archive.mutate(exam.id)}>
                    Lưu trữ
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
