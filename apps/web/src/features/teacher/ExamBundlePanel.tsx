import { Button } from '@/components/ui/Button'
import { CornerNotice, flashError, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { Card, Input } from '@/components/ui/Primitives'
import { partName, useCreateExamBundle, useExamBundles, useExams } from '@/features/exams/exams.queries'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { isFullSkillExam, type ExamSummaryDto } from '@toeic/shared'
import { useMemo, useState } from 'react'

function matches(exam: ExamSummaryDto, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return exam.code.toLowerCase().includes(needle) || exam.title.toLowerCase().includes(needle)
}

function ExamColumn({
  title,
  query,
  onQuery,
  exams,
  selectedId,
  onSelect,
}: {
  title: string
  query: string
  onQuery: (value: string) => void
  exams: ExamSummaryDto[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const visible = exams.filter((exam) => matches(exam, query))
  return (
    <div className="min-w-0">
      <h3 className="font-semibold">{title}</h3>
      <Input className="mt-2" value={query} placeholder="Tìm mã hoặc tên đề" onChange={(e) => onQuery(e.target.value)} />
      <div className="mt-2 max-h-[calc(4.875rem*3+0.5rem*2)] space-y-2 overflow-y-auto pr-1">
        {visible.length === 0 ? <p className="rounded-xl bg-paper px-3 py-4 text-sm text-ink-soft">Không có đề phù hợp.</p> : null}
        {visible.map((exam) => (
          <button
            key={exam.id}
            type="button"
            className={cn(
              'h-[4.875rem] w-full overflow-hidden rounded-xl border px-3 py-2 text-left',
              selectedId === exam.id ? 'border-gold-deep bg-gold/20' : 'border-ink/10 bg-cream hover:border-gold/60',
            )}
            onClick={() => onSelect(exam.id)}
          >
            <p className="truncate text-sm font-semibold">{exam.code}</p>
            <p className="truncate text-sm text-ink-soft">{exam.title}</p>
            <p className="mt-1 truncate text-xs text-ink-soft">{exam.parts.map((part) => partName(part.code).split(' — ')[0]).join(' · ')} · {exam.totalQuestions} câu</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ExamBundlePanel() {
  const exams = useExams()
  const bundles = useExamBundles()
  const create = useCreateExamBundle()
  const [listeningQuery, setListeningQuery] = useState('')
  const [readingQuery, setReadingQuery] = useState('')
  const [listeningId, setListeningId] = useState<string | null>(null)
  const [readingId, setReadingId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)

  const bank = useMemo(() => (exams.data ?? []).filter((exam) => exam.status !== 'ARCHIVED'), [exams.data])
  const listening = bank.filter((exam) => isFullSkillExam(exam.parts, 'LISTENING'))
  const reading = bank.filter((exam) => isFullSkillExam(exam.parts, 'READING'))
  const used = new Set((bundles.data ?? []).map((bundle) => `${bundle.listeningExamId}|${bundle.readingExamId}`))
  const pairTaken = listeningId && readingId ? used.has(`${listeningId}|${readingId}`) : false
  const noFreePair = listening.length > 0 && reading.length > 0 && listening.every((left) => reading.every((right) => used.has(`${left.id}|${right.id}`)))
  const trimmedCode = code.trim()
  const trimmedTitle = title.trim()
  const codeOk = /^[A-Za-z0-9._-]{3,40}$/.test(trimmedCode)
  const titleOk = trimmedTitle.length >= 3 && trimmedTitle.length <= 200
  const identityOk = codeOk && titleOk

  function report(error: unknown) {
    setNotice(flashError(error instanceof ApiError ? error.message : 'Không tạo được bộ đề.'))
  }

  function identity() {
    return { code: trimmedCode, title: trimmedTitle }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="serif text-2xl">Bộ đề tổng hợp</h2>
          <p className="mt-1 text-sm text-ink-soft">Ghép một đề Listening đủ Part 1–4 với một đề Reading đủ Part 5–7. Mỗi cặp chỉ tạo một lần. Mã và tên bộ đề do bạn đặt.</p>
        </div>
        <Button
          variant="teal"
          disabled={create.isPending || !identityOk || noFreePair || listening.length === 0 || reading.length === 0}
          onClick={() => {
            setNotice(null)
            void create.mutateAsync({ random: true, ...identity() }).then(
              (bundle) => {
                setCode('')
                setTitle('')
                setNotice(flashNotice(`Đã tạo nhanh bộ đề ${bundle.code}.`))
              },
              report,
            )
          }}
        >
          Tạo nhanh
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold">Mã bộ đề</span>
          <Input className="mt-1" value={code} maxLength={40} placeholder="VD: ETS-2024-01" autoComplete="off" onChange={(e) => setCode(e.target.value)} />
          {trimmedCode && !codeOk ? <span className="mt-1 block text-xs text-coral">3–40 ký tự: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.</span> : null}
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Tên bộ đề</span>
          <Input className="mt-1" value={title} maxLength={200} placeholder="VD: ETS 2024 Test 1" onChange={(e) => setTitle(e.target.value)} />
          {trimmedTitle && !titleOk ? <span className="mt-1 block text-xs text-coral">Tên cần từ 3 đến 200 ký tự.</span> : null}
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <ExamColumn title="Listening" query={listeningQuery} onQuery={setListeningQuery} exams={listening} selectedId={listeningId} onSelect={setListeningId} />
        <ExamColumn title="Reading" query={readingQuery} onQuery={setReadingQuery} exams={reading} selectedId={readingId} onSelect={setReadingId} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {pairTaken ? <p className="text-sm text-coral">Cặp này đã có bộ đề tổng hợp.</p> : null}
        <Button
          disabled={create.isPending || !identityOk || !listeningId || !readingId || pairTaken}
          onClick={() => {
            if (!listeningId || !readingId) return
            setNotice(null)
            void create.mutateAsync({ listeningExamId: listeningId, readingExamId: readingId, ...identity() }).then(
              (bundle) => {
                setListeningId(null)
                setReadingId(null)
                setCode('')
                setTitle('')
                setNotice(flashNotice(`Đã tạo bộ đề ${bundle.code}.`))
              },
              report,
            )
          }}
        >
          {create.isPending ? 'Đang tạo…' : 'Tạo bộ đề'}
        </Button>
      </div>
      {(bundles.data ?? []).length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-ink/10 pt-4">
          {bundles.data?.map((bundle) => (
            <li key={bundle.id} className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">{bundle.code}</span>
              <span> · {bundle.title}</span>
              <span> · {bundle.listeningCode} + {bundle.readingCode}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <CornerNotice notice={notice} />
    </Card>
  )
}
