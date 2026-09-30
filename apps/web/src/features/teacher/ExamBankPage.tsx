import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { partName, useArchiveExam, useExams, usePublishExam } from '@/features/exams/exams.queries'
import { ApiError } from '@/lib/api'
import type { ExamStatus } from '@toeic/shared'
import { FileUp } from 'lucide-react'
import { useState } from 'react'

export function ExamBankPage() {
  const [job, setJob] = useState<'idle' | 'extracting' | 'ai' | 'review'>('idle')
  const [fileName, setFileName] = useState<string | null>(null)

  function startImport(name: string) {
    setFileName(name)
    setJob('extracting')
    window.setTimeout(() => setJob('ai'), 900)
    window.setTimeout(() => setJob('review'), 1800)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Kho đề & ngân hàng câu hỏi</p>
          <h1 className="serif mt-2 text-4xl">Import đề ETS / PDF và duyệt trước khi publish</h1>
          <p className="mt-2 text-sm text-ink/60">Mọi import đi qua PENDING_REVIEW. AI chỉ giải thích đáp án có sẵn, không tự publish.</p>
        </div>
        <Button variant="paper">Tải mẫu đề chuẩn (.xlsx)</Button>
      </div>

      <Card className="border-dashed border-gold/30  p-8">
        <div className="flex flex-col items-center text-center">
          <FileUp className="size-10 text-gold-deep" />
          <h2 className="serif mt-3 text-2xl">Kéo thả PDF đề + audio (mô phỏng)</h2>
          <p className="mt-2 max-w-xl text-sm text-ink/60">Hệ thống bóc tách 200 câu, gắn thẻ dạng bẫy rồi chờ Thầy Minh rà soát đáp án trước khi mở cho học viên.</p>
          <label className="mt-5">
            <input
              className="hidden"
              type="file"
              accept=".pdf,.xlsx,.json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) startImport(file.name)
              }}
            />
            <span className="inline-flex cursor-pointer rounded-full bg-gold-deep px-4 py-2 text-sm font-semibold text-white">Chọn file đề thi từ máy</span>
          </label>
        </div>
        {job !== 'idle' ? (
          <div className="mt-6 rounded-2xl bg-paper p-4 text-left">
            <p className="text-sm font-semibold">{fileName}</p>
            <p className="mt-2 text-sm text-gold-deep">
              {job === 'extracting' && 'EXTRACTING • Đang tách câu hỏi / options / answer key'}
              {job === 'ai' && 'AI_PROCESSING • Đang sinh explanation (DRAFT)'}
              {job === 'review' && 'WAITING_REVIEW • Sẵn sàng để giáo viên duyệt'}
            </p>
            {job === 'review' ? (
              <div className="mt-4 flex gap-3">
                <Button>Duyệt & publish</Button>
                <Button variant="paper">Mở preview 200 câu</Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <ExamList />
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

  return (
    <section>
      <h2 className="serif text-2xl">Kho đề ({exams.data?.length ?? 0})</h2>
      {error ? (
        <div className="mt-3 rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">
          <p>{error instanceof ApiError ? error.message : 'Thao tác thất bại.'}</p>
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
          <Card key={exam.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <Badge tone={STATUS_TONE[exam.status]}>{exam.status}</Badge>
              <h3 className="mt-2 font-semibold">{exam.title}</h3>
              <p className="text-sm text-ink/55">
                {exam.code} • {Math.round(exam.durationSeconds / 60)} phút • {exam.totalQuestions} câu • {exam.parts.map((p) => partName(p.code).split(' — ')[0]).join(', ')}
              </p>
            </div>
            <div className="flex gap-2">
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
          </Card>
        ))}
      </div>
    </section>
  )
}
