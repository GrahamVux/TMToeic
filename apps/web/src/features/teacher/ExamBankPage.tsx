import { useAuth } from '@/app/AuthContext'
import { useImportAuthoredExam } from '@/features/assignments/assignments.queries'
import { Button, buttonClasses } from '@/components/ui/Button'
import { CornerNotice, flashError, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { FilePick } from '@/components/ui/FilePick'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Input } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { packListeningScan, partName, useArchiveExam, useDeleteExam, useExams, useImportListeningScan, usePreviewListeningScan, usePublishExam, useUploadExamAudio } from '@/features/exams/exams.queries'
import { ApiError } from '@/lib/api'
import { ERROR_CODES, EXAM_STATUS_LABEL, importAuthoredExamSchema, listeningScanSchema, OPTION_KEYS, PART_SEED, type ExamStatus, type ExamSummaryDto, type ImportAuthoredExamInput, type ListeningScanInput, type Skill } from '@toeic/shared'
import { ExamBundlePanel } from './ExamBundlePanel'
import { ImportReview } from './ImportReview'
import { ListeningScanReview } from './ListeningScanReview'
import { FileUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const MAX_AUDIO_BYTES = 80 * 1024 * 1024

export function ExamBankPage() {
  const [skill, setSkill] = useState<Skill>('LISTENING')
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">Kho đề & ngân hàng câu hỏi</p>
        <h1 className="serif mt-2 text-3xl sm:text-4xl">Ngân hàng đề — mỗi part là một nhóm giao bài</h1>
        <p className="mt-2 text-sm text-ink-soft">Import đề Listening và đề Reading riêng. Đề Listening có thể gắn file nghe sau khi vào ngân hàng.</p>
      </div>
      <ExamBundlePanel />
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={skill === 'LISTENING'} className={tabClass(skill === 'LISTENING')} onClick={() => setSkill('LISTENING')}>
          Import đề Listening
        </button>
        <button type="button" aria-pressed={skill === 'READING'} className={tabClass(skill === 'READING')} onClick={() => setSkill('READING')}>
          Import đề Reading
        </button>
      </div>
      <AuthoredImport key={skill} skill={skill} />
      <ExamList />
    </div>
  )
}

function tabClass(active: boolean) {
  return active
    ? 'min-h-10 rounded-full bg-button px-4 py-2 text-sm font-semibold text-button-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50'
    : 'min-h-10 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink-soft ring-1 ring-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50'
}

function newExamCode() {
  return `GV-${Date.now().toString(36).toUpperCase()}`
}

function foreignPartCodes(raw: ImportAuthoredExamInput, skill: Skill) {
  const codes = [
    ...(raw.parts ?? []).map((p) => p.partCode),
    ...(raw.groups ?? []).map((g) => g.partCode),
    ...(raw.questions ?? []).map((q) => q.partCode),
  ]
  return [...new Set(codes.filter((code) => PART_SEED.find((p) => p.code === code)?.skill !== skill))]
}

function AuthoredImport({ skill }: { skill: Skill }) {
  const { user } = useAuth()
  const importExam = useImportAuthoredExam()
  const importScan = useImportListeningScan()
  const previewScan = usePreviewListeningScan()
  const uploadAudio = useUploadExamAudio()
  const parts = PART_SEED.filter((p) => p.skill === skill && p.code.startsWith('PART_'))
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(20)
  const [partCode, setPartCode] = useState(skill === 'LISTENING' ? 'PART_2' : 'PART_5')
  const [rows, setRows] = useState([{ prompt: '', a: '', b: '', c: '', d: '', correct: 'A', explanation: '' }])
  const [preview, setPreview] = useState<ImportAuthoredExamInput | null>(null)
  const [audio, setAudio] = useState<File | null>(null)
  const [scan, setScan] = useState<{ name: string; draft: ListeningScanInput } | null>(null)
  const [scanPdf, setScanPdf] = useState<File | null>(null)
  const [scanReview, setScanReview] = useState<{ draft: ListeningScanInput; images: Record<string, string>; pages: string[] } | null>(null)
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)

  function reportError(message: string) {
    setNotice(flashError(message))
  }
  const busy = importExam.isPending || uploadAudio.isPending || importScan.isPending || previewScan.isPending

  function addRow() {
    setRows((r) => [...r, { prompt: '', a: '', b: '', c: '', d: '', correct: 'A', explanation: '' }])
  }

  async function attachAudio(examId: string) {
    if (skill !== 'LISTENING' || !audio) return null
    if (audio.size > MAX_AUDIO_BYTES) return 'File nghe quá lớn (tối đa 80MB). Đề đã vào ngân hàng; hãy gắn lại bằng nút Thêm file nghe.'
    try {
      await uploadAudio.mutateAsync({ examId, file: audio })
      return null
    } catch (e) {
      const detail = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Không tải được file nghe.'
      return `Đề đã vào ngân hàng nhưng chưa gắn được file nghe. ${detail}`
    }
  }

  async function submitBuilder() {
    setNotice(null)
    const filled = rows.map((r) => ({ ...r, prompt: r.prompt.trim() })).filter((r) => r.prompt.length > 0)
    if (title.trim().length < 3) {
      reportError('Nhập tên đề.')
      return
    }
    if (filled.length === 0) {
      reportError('Thêm ít nhất một câu hỏi.')
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
        explanation: r.explanation.trim() || undefined,
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
      const audioError = await attachAudio(exam.id)
      if (audioError) {
        reportError(audioError)
        return
      }
      setNotice(flashNotice(`Đã thêm “${exam.title}” vào ngân hàng (${exam.parts.map((p) => partName(p.code).split(' — ')[0]).join(', ')})${audio ? ' và đã gắn file nghe.' : '.'}`))
      setTitle('')
      setAudio(null)
      setRows([{ prompt: '', a: '', b: '', c: '', d: '', correct: 'A', explanation: '' }])
    } catch (e) {
      reportError(e instanceof ApiError ? e.message : 'Không import được đề. Kiểm tra mỗi câu có 4 lựa chọn và đúng 1 đáp án.')
    }
  }

  async function openScanReview() {
    if (!scan || !scanPdf) return
    setNotice(null)
    try {
      const result = await previewScan.mutateAsync(packListeningScan(JSON.stringify(scan.draft), scanPdf))
      setScanReview({ draft: scan.draft, images: result.images, pages: result.pages })
    } catch (e) {
      reportError(e instanceof ApiError ? e.message : 'Không cắt được ảnh từ PDF.')
    }
  }

  async function recutScan(next: ListeningScanInput) {
    if (!scanPdf) return null
    setNotice(null)
    try {
      const result = await previewScan.mutateAsync(packListeningScan(JSON.stringify(next), scanPdf))
      return result.images
    } catch (e) {
      reportError(e instanceof ApiError ? e.message : 'Không cắt lại được ảnh.')
      return null
    }
  }

  async function saveScan(next: ListeningScanInput) {
    if (!scanPdf) return
    setNotice(null)
    try {
      const exam = await importScan.mutateAsync(packListeningScan(JSON.stringify(next), scanPdf))
      setScan(null)
      setScanPdf(null)
      setScanReview(null)
      setNotice(
        flashNotice(
          exam.status === 'PUBLISHED'
            ? `Đã thêm “${exam.title}” và cắt ảnh từ PDF.`
            : `Đã thêm “${exam.title}” ở dạng bản nháp. Hãy kiểm tra đáp án trước khi xuất bản.`,
        ),
      )
    } catch (e) {
      reportError(e instanceof ApiError ? e.message : 'Không lưu được đề Listening.')
    }
  }

  async function onJsonFile(file: File) {
    setNotice(null)
    try {
      const text = await file.text()
      const raw = JSON.parse(text) as unknown
      if (raw && typeof raw === 'object' && 'crops' in raw) {
        const scanParsed = listeningScanSchema.safeParse(raw)
        if (!scanParsed.success) {
          reportError(scanParsed.error.issues.map((issue) => issue.message).join(' '))
          return
        }
        setPreview(null)
        setScanReview(null)
        setScan({ name: file.name, draft: scanParsed.data })
        return
      }
      setScan(null)
      const parsed = importAuthoredExamSchema.safeParse(raw)
      if (!parsed.success) {
        reportError(parsed.error.issues.map((issue) => issue.message).join(' '))
        return
      }
      const foreign = foreignPartCodes(parsed.data, skill)
      if (foreign.length > 0) {
        reportError(
          skill === 'LISTENING'
            ? 'File này có part Reading. Hãy mở tab Import đề Reading.'
            : 'File này có part Listening. Hãy mở tab Import đề Listening.',
        )
        return
      }
      setPreview(parsed.data)
    } catch (e) {
      reportError(e instanceof ApiError ? e.message : 'File JSON không hợp lệ hoặc mã đề đã tồn tại.')
    }
  }

  async function savePreview(next: ImportAuthoredExamInput) {
    setNotice(null)
    try {
      const exam = await importExam.mutateAsync({ ...next, publish: next.publish !== false })
      const audioError = await attachAudio(exam.id)
      if (audioError) {
        reportError(audioError)
        return
      }
      setPreview(null)
      setNotice(flashNotice(`Đã thay đổi thành công: “${exam.title}”${audio ? ' và đã gắn file nghe.' : '.'}`))
      setAudio(null)
    } catch (e) {
      reportError(e instanceof ApiError ? e.message : 'Không import được đề. Kiểm tra mỗi câu có đúng 1 đáp án.')
    }
  }

  if (scanReview && scanPdf) {
    return (
      <>
        <CornerNotice notice={notice} />
        <ListeningScanReview
          draft={scanReview.draft}
          images={scanReview.images}
          pages={scanReview.pages}
          busy={busy}
          onCancel={() => setScanReview(null)}
          onRecut={recutScan}
          onSave={(next) => void saveScan(next)}
        />
      </>
    )
  }

  if (preview) {
    return (
      <>
        <CornerNotice notice={notice} />
        <ImportReview
          draft={preview}
          busy={busy}
          audioName={skill === 'LISTENING' ? audio?.name ?? null : undefined}
          onAudio={skill === 'LISTENING' ? (file) => setAudio(file) : undefined}
          onCancel={() => setPreview(null)}
          onSave={(next) => void savePreview(next)}
        />
      </>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-dashed border-gold/30 p-6">
        <FileUp className="size-8 text-gold-deep" />
        <h2 className="serif mt-2 text-2xl">{skill === 'LISTENING' ? 'Import JSON đề Listening' : 'Import JSON đề Reading'}</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {skill === 'LISTENING'
            ? 'File gồm Part 1–4. JSON có khung cắt thì chọn thêm PDF, xem ảnh và sửa câu trước khi lưu. File nghe chọn riêng bên dưới.'
            : 'File gồm Part 5–7. Mỗi đề chỉ thuộc một kỹ năng. Chọn file để xem lại câu hỏi, đáp án và lời giải trước khi lưu.'}
        </p>
        {skill === 'READING' ? (
          <a className="mt-2 inline-block text-sm font-semibold text-gold-deep underline" href="/mau-import-reading.json" download="mau-de-reading.json">
            Tải file mẫu Reading
          </a>
        ) : null}
        {skill === 'LISTENING' && user?.role === 'ADMIN' ? (
          <a className="mt-2 block text-sm font-semibold text-gold-deep underline" href="/ybm-lc-gemini-chat.json" download="ybm-lc-gemini-chat.json">
            Tải hướng dẫn Gemini cho đề Listening PDF
          </a>
        ) : null}
        <div className="mt-4 space-y-3">
          <FilePick
            label="Chọn file JSON"
            accept="application/json,.json"
            chosen={scan?.name ?? null}
            onFiles={(files) => {
              const file = files[0]
              if (file) void onJsonFile(file)
            }}
          />
          {skill === 'LISTENING' ? (
            <FilePick
              label="Chọn file PDF đề"
              accept="application/pdf,.pdf"
              chosen={scanPdf?.name ?? null}
              hint={scan ? 'JSON này có khung cắt. Chọn đúng PDF đã gửi cho Gemini.' : 'Dùng khi JSON do Gemini trả về có khung cắt ảnh.'}
              onFiles={(files) => {
                const file = files[0]
                if (file) setScanPdf(file)
              }}
            />
          ) : null}
          {scan && scanPdf ? (
            <Button disabled={busy} onClick={() => void openScanReview()}>
              {previewScan.isPending ? 'Đang cắt ảnh…' : 'Xem và chỉnh sửa trước khi lưu'}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="serif text-2xl">{skill === 'LISTENING' ? 'Soạn nhanh một part Listening' : 'Soạn nhanh một part Reading'}</h2>
        <label className="mt-3 block text-sm font-medium" htmlFor="au-title">
          Tên đề
        </label>
        <Input id="au-title" className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={skill === 'LISTENING' ? 'VD: Part 2 — hỏi đáp' : 'VD: Part 5 — mệnh đề quan hệ'} />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" htmlFor="au-part">
              Part
            </label>
            <select
              id="au-part"
              className="mt-1 h-10 w-full rounded-xl border border-ink/12 bg-cream px-3 text-sm"
              value={partCode}
              onChange={(e) => setPartCode(e.target.value)}
            >
              {parts.map((p) => (
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
              <p className="text-xs text-ink-soft">Câu {i + 1}</p>
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
              <textarea
                aria-label="Lời giải thích"
                className="mt-2 w-full rounded-xl border border-ink/10 bg-cream px-3 py-2 text-sm outline-none focus:border-button focus:ring-2 focus:ring-button/30"
                rows={2}
                placeholder="Lời giải thích"
                value={r.explanation}
                onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, explanation: e.target.value } : x)))}
              />
              <label className="mt-2 flex items-center gap-2 text-xs">
                Đáp án đúng
                <select
                  className="h-10 rounded-lg border border-ink/12 bg-cream px-2 outline-none focus:border-button focus:ring-2 focus:ring-button/30"
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
          <Button type="button" disabled={busy} onClick={() => void submitBuilder()}>
            {busy ? 'Đang lưu…' : 'Thêm vào ngân hàng'}
          </Button>
        </div>
      </Card>

      {skill === 'LISTENING' ? (
        <Card className="p-6 lg:col-span-2">
          <h2 className="serif text-2xl">File nghe cho lần import này</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Chọn mp3, m4a hoặc wav trước khi import. File gắn cho cả phần nghe, và phát khi bài làm gồm mọi part Listening của đề. Muốn giao từng part, hãy gắn file theo part trên thẻ đề bên dưới.
          </p>
          <div className="mt-4">
            <FilePick
              label="Chọn file nghe"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
              chosen={audio?.name ?? null}
              hint="Gắn cho cả phần nghe của đề đang import."
              onFiles={(files) => setAudio(files[0] ?? null)}
            />
          </div>
        </Card>
      ) : null}

      <CornerNotice notice={notice} />
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
  const remove = useDeleteExam()
  const [actingId, setActingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ExamSummaryDto | null>(null)
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)
  const error = publish.error ?? archive.error
  const problems = error instanceof ApiError ? ((error.details as { problems?: string[] } | undefined)?.problems ?? []) : []

  if (exams.error) return <QueryErrorRedirect error={exams.error} />

  return (
    <section>
      <h2 className="serif text-2xl">Kho đề ({exams.data?.length ?? 0})</h2>
      {error ? (
        <div className="mt-3 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger" role="alert">
          <p>{error instanceof ApiError && error.code === ERROR_CODES.EXAM_NOT_READY ? 'Đề chưa sẵn sàng để xuất bản.' : 'Thao tác thất bại.'}</p>
          {problems.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {problems.slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {exams.isPending ? (
        <div className="mt-3 grid gap-3 animate-pulse" aria-busy="true" aria-label="Đang tải kho đề">
          <div className="h-32 rounded-2xl bg-paper-2" />
          <div className="h-32 rounded-2xl bg-paper-2" />
        </div>
      ) : null}
      {!exams.isPending && (exams.data?.length ?? 0) === 0 ? (
        <Card className="mt-3 p-6 text-center text-sm text-ink-soft">
          Chưa có đề nào trong ngân hàng. Hãy import hoặc soạn nhanh ở phía trên.
        </Card>
      ) : null}
      <div className="mt-3 grid gap-3">
        {exams.data?.map((exam) => (
          <Card key={exam.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[exam.status]}>{EXAM_STATUS_LABEL[exam.status]}</Badge>
                  {exam.parts.some((p) => p.skill === 'LISTENING') && exam.hasAudio ? <Badge tone="teal">Có file nghe</Badge> : null}
                </div>
                <h3 className="mt-2 font-semibold">{exam.title}</h3>
                <p className="text-sm text-ink-soft">
                  {exam.code} • {Math.round(exam.durationSeconds / 60)} phút • {exam.totalQuestions} câu
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {exam.parts.map((p) => (
                    <span key={p.code} className="rounded-full bg-paper-2 px-2.5 py-1 text-[13px] font-semibold text-ink-soft">
                      {partName(p.code).split(' — ')[0]} · {p.questionCount} câu
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {exam.status === 'PUBLISHED' ? (
                  <Link to={`/admin/assignments?examId=${exam.id}`} className={buttonClasses('gold')}>
                    Giao bài từ part
                  </Link>
                ) : null}
                {exam.status === 'DRAFT' || exam.status === 'PENDING_REVIEW' || exam.status === 'REJECTED' || exam.status === 'ARCHIVED' ? (
                  <Button
                    disabled={publish.isPending}
                    onClick={() => {
                      setActingId(exam.id)
                      void publish.mutateAsync(exam.id).finally(() => setActingId(null))
                    }}
                  >
                    {actingId === exam.id && publish.isPending ? 'Đang xuất bản…' : 'Xuất bản'}
                  </Button>
                ) : null}
                {exam.status === 'PUBLISHED' ? (
                  <Button
                    variant="paper"
                    disabled={archive.isPending}
                    onClick={() => {
                      setActingId(exam.id)
                      void archive.mutateAsync(exam.id).finally(() => setActingId(null))
                    }}
                  >
                    {actingId === exam.id && archive.isPending ? 'Đang lưu trữ…' : 'Lưu trữ'}
                  </Button>
                ) : null}
                <Button variant="danger" disabled={remove.isPending} onClick={() => setPendingDelete(exam)}>
                  Xóa hẳn
                </Button>
              </div>
            </div>
            <ListeningAudioControl exam={exam} />
          </Card>
        ))}
      </div>
      <CornerNotice notice={notice} />
      {pendingDelete ? (
        <Modal title="Xóa hẳn đề này?" onClose={() => (remove.isPending ? undefined : setPendingDelete(null))}>
          <p className="text-sm text-ink-soft">
            Đề <span className="font-semibold">{pendingDelete.title}</span> sẽ biến khỏi hệ thống, cùng bài đã giao từ đề này và kết quả làm bài của học sinh. Không khôi phục được.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="paper" disabled={remove.isPending} onClick={() => setPendingDelete(null)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                const target = pendingDelete
                void remove.mutateAsync(target.id).then(
                  () => {
                    setPendingDelete(null)
                    setNotice(flashNotice(`Đã xóa đề “${target.title}”.`))
                  },
                  (e: unknown) => {
                    setPendingDelete(null)
                    setNotice(flashError(e instanceof ApiError ? e.message : 'Không xóa được đề.'))
                  },
                )
              }}
            >
              {remove.isPending ? 'Đang xóa…' : 'Xóa hẳn'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

function ListeningAudioControl({ exam }: { exam: ExamSummaryDto }) {
  const upload = useUploadExamAudio()
  const listening = exam.parts.filter((p) => p.skill === 'LISTENING')
  const [partCode, setPartCode] = useState('')
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)
  if (listening.length === 0) return null

  async function onFile(file: File) {
    setNotice(null)
    if (file.size > MAX_AUDIO_BYTES) {
      setNotice(flashError('File nghe quá lớn (tối đa 80MB).'))
      return
    }
    try {
      await upload.mutateAsync({ examId: exam.id, file, partCode: partCode || undefined })
      setNotice(flashNotice(partCode ? `Đã gắn file nghe cho ${partName(partCode).split(' — ')[0]}.` : 'Đã gắn file nghe cho cả phần Listening.'))
    } catch (e) {
      setNotice(flashError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Không tải được file nghe.'))
    }
  }

  return (
    <div className="mt-4 border-t border-ink/8 pt-3">
      <p className="text-xs text-ink-soft">
        Gắn file cho cả phần nghe khi bài làm gồm mọi part Listening. Gắn theo từng part khi giao bài một part.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="h-10 rounded-xl border border-ink/12 bg-cream px-3 text-sm outline-none focus:border-button focus:ring-2 focus:ring-button/30"
          value={partCode}
          aria-label="Chỗ gắn file nghe"
          onChange={(e) => setPartCode(e.target.value)}
        >
          <option value="">Cả phần nghe</option>
          {listening.map((p) => (
            <option key={p.code} value={p.code}>
              {partName(p.code).split(' — ')[0]}
            </option>
          ))}
        </select>
        <FilePick
          label={upload.isPending ? 'Đang tải file nghe…' : exam.hasAudio ? 'Đổi file nghe' : 'Thêm file nghe'}
          accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
          disabled={upload.isPending}
          onFiles={(files) => {
            const file = files[0]
            if (file) void onFile(file)
          }}
        />
      </div>
      <CornerNotice notice={notice} />
    </div>
  )
}
