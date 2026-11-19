import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { CornerNotice, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { FilePick } from '@/components/ui/FilePick'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Input } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { partName, useExams } from '@/features/exams/exams.queries'
import { useStudents } from '@/features/teacher/users.queries'
import { ASSIGNMENT_LIFECYCLE_LABEL, type AssignmentDetailDto, type AssignmentDto, type ExamSummaryDto, type StudentAssignmentStatus } from '@toeic/shared'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError, apiGetFile } from '@/lib/api'
import { useAssignment, useAssignments, useCloseAssignment, useCreateAssignment, useSaveAssignmentToBank, useUploadAssignmentAudio, useUploadAssignmentImages } from '@/features/assignments/assignments.queries'
import { FillAssignForm } from './FillAssignForm'

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_LABEL: Record<StudentAssignmentStatus, string> = {
  ASSIGNED: 'Chưa làm',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Đã nộp',
  OVERDUE: 'Quá hạn',
}

const STATUS_TONE: Record<StudentAssignmentStatus, 'paper' | 'warn' | 'olive' | 'danger'> = {
  ASSIGNED: 'paper',
  IN_PROGRESS: 'warn',
  COMPLETED: 'olive',
  OVERDUE: 'danger',
}

export function TeacherAssignmentsPage() {
  const { user } = useAuth()
  const canManage = user?.role === 'ADMIN' || !!user?.permissions.manageAssignments
  const exams = useExams(canManage)
  const assignments = useAssignments()
  const create = useCreateAssignment()
  const uploadAudio = useUploadAssignmentAudio()
  const uploadImages = useUploadAssignmentImages()
  const close = useCloseAssignment()
  const students = useStudents({ q: '', status: 'ACTIVE', classId: '', page: 1, pageSize: 100 })
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
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [composer, setComposer] = useState<'bank' | 'fill'>('bank')

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
  const listening = selectedParts.some((p) => p.skill === 'LISTENING')
  const wholeExam = !!exam && exam.parts.length > 0 && exam.parts.every((p) => partCodes.includes(p.code))

  function assignWhole(target: ExamSummaryDto) {
    setExamId(target.id)
    setPartCodes(target.parts.map((p) => p.code))
    setMinutes(Math.min(240, Math.max(1, Math.round(target.durationSeconds / 60))))
    setTitle((current) => (current.trim().length >= 3 ? current : target.title))
  }
  const saving = create.isPending || uploadAudio.isPending || uploadImages.isPending

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
      const created = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        examId: exam.id,
        partCodes,
        durationSeconds: Math.max(60, minutes * 60),
        dueAt: new Date(dueAt).toISOString(),
        studentIds: allStudents ? undefined : picked,
        publish: true,
      })
      if (listening && audioFile) await uploadAudio.mutateAsync({ id: created.id, file: audioFile })
      if (imageFiles.length > 0) await uploadImages.mutateAsync({ id: created.id, files: imageFiles })
      setTitle('')
      setDescription('')
      setPartCodes([])
      setAudioFile(null)
      setImageFiles([])
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Không giao được bài. Kiểm tra đề đã xuất bản và danh sách học viên.')
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
          {canManage
            ? 'Giao part hoặc cả bộ đề từ ngân hàng, hoặc soạn bài điền từ. Bài điền từ có thể lưu vào bộ đề sau khi giao.'
            : 'Danh sách bài đã giao và tiến độ nộp bài của học viên.'}
        </p>
      </header>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={composer === 'bank' ? 'rounded-full bg-gold-deep px-4 py-2 text-sm font-semibold text-white' : 'rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink/70 ring-1 ring-ink/10'} onClick={() => setComposer('bank')}>
            Từ bộ đề
          </button>
          <button type="button" className={composer === 'fill' ? 'rounded-full bg-gold-deep px-4 py-2 text-sm font-semibold text-white' : 'rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink/70 ring-1 ring-ink/10'} onClick={() => setComposer('fill')}>
            Điền từ
          </button>
        </div>
      ) : null}

      {canManage && composer === 'fill' ? <FillAssignForm roster={roster} /> : null}

      {canManage && composer === 'bank' ? <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
              <ExamPick
                key={e.id}
                exam={e}
                selected={examId === e.id}
                partCodes={examId === e.id ? partCodes : []}
                onSelect={setExamId}
                onParts={setPartCodes}
                onWhole={() => assignWhole(e)}
              />
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
            {wholeExam ? ' • cả bộ đề' : ''}
          </p>
          {wholeExam ? (
            <p className="mt-1 text-sm text-ink/55">Khi mọi học viên nộp xong hoặc hết giờ, mở Kiểm tra bài làm để tải báo cáo Excel.</p>
          ) : null}
          {listening ? (
            <div className="mt-4">
              <FilePick
                label="Chọn file nghe"
                accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
                chosen={audioFile?.name ?? null}
                hint="mp3, m4a hoặc wav, tối đa 80MB. Học viên nghe file này khi làm bài."
                onFiles={(files) => setAudioFile(files[0] ?? null)}
              />
            </div>
          ) : null}
          <div className="mt-3">
            <FilePick
              label={listening ? 'Chọn ảnh đề Listening' : 'Chọn ảnh đoạn Reading'}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              chosen={imageFiles.length > 0 ? imageFiles.map((file) => file.name).join(', ') : null}
              hint={
                listening
                  ? 'Ảnh hiện trong khung câu hỏi, rộng tối đa bằng khung để xem hết hình. Mỗi ảnh tối đa 8MB.'
                  : 'Ảnh hoặc bảng biểu hiện cùng đoạn đọc, vừa khung đề. Mỗi ảnh tối đa 8MB.'
              }
              onFiles={setImageFiles}
            />
          </div>
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
          <Button className="mt-4 w-full" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Đang giao…' : 'Giao bài tập'}
          </Button>
        </Card>
      </div> : null}

      <section>
        <h2 className="serif text-2xl">Bài đã giao ({assignments.data?.length ?? 0})</h2>
        {assignments.isPending ? <p className="mt-3 text-sm text-ink/55">Đang tải…</p> : null}
        <div className="mt-3 grid gap-3">
          {(assignments.data ?? []).map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={a.status === 'PUBLISHED' ? 'olive' : a.status === 'CLOSED' ? 'paper' : 'warn'}>{ASSIGNMENT_LIFECYCLE_LABEL[a.status]}</Badge>
                  {a.wholeExam ? <Badge tone="gold">Cả bộ đề</Badge> : null}
                  {a.fillBlank ? <Badge tone="gold">Điền từ</Badge> : null}
                  {a.fillBlank && a.inBank ? <Badge tone="olive">Đã vào bộ đề</Badge> : null}
                  <h3 className="mt-2 font-semibold">{a.title}</h3>
                  <p className="text-sm text-ink/55">
                    {a.examTitle} • {a.parts.map((p) => partName(p.code).split(' — ')[0]).join(', ')} • {a.submittedCount}/{a.studentCount} đã nộp
                    {a.dueAt ? ` • hạn ${new Date(a.dueAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="navy" onClick={() => setCheckingId(a.id)}>
                    Kiểm tra bài làm
                  </Button>
                  {canManage && a.fillBlank && !a.inBank ? <SaveToBankButton id={a.id} /> : null}
                  {canManage && a.status === 'PUBLISHED' ? (
                    <Button variant="paper" disabled={close.isPending} onClick={() => void close.mutateAsync(a.id).catch(() => undefined)}>
                      Đóng bài
                    </Button>
                  ) : null}
                </div>
              </div>
              <AssignmentFiles assignment={a} canManage={canManage} />
            </Card>
          ))}
        </div>
      </section>

      {checkingId ? <AssignmentCheckModal assignmentId={checkingId} onClose={() => setCheckingId(null)} /> : null}
    </div>
  )
}

function scoreLabel(s: AssignmentDetailDto['students'][number]) {
  if (s.correctCount === null) return '—'
  const raw = `${s.correctCount}/${s.totalQuestions} câu đúng`
  return s.totalScore !== null ? `${s.totalScore}/990 · ${raw}` : raw
}

function AssignmentCheckModal({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
  const q = useAssignment(assignmentId)
  const students = q.data?.students ?? []
  const done = students.filter((s) => s.status === 'COMPLETED').length
  const pending = students.length - done
  const ready = !!q.data?.wholeExam && students.length > 0 && pending === 0
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function downloadReport() {
    setExporting(true)
    setExportError(null)
    try {
      const file = await apiGetFile(`/assignments/${assignmentId}/report`)
      const url = URL.createObjectURL(file.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(e instanceof ApiError ? e.message : 'Không tải được báo cáo.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal wide title={q.data?.title ?? 'Bài làm học viên'} onClose={onClose}>
      {q.isPending ? <p className="text-sm text-ink/55">Đang tải danh sách…</p> : null}
      {q.error ? <p className="text-sm text-coral">Không tải được danh sách bài làm.</p> : null}
      {q.data ? (
        <>
          <p className="text-sm text-ink/60">
            {q.data.examTitle} · {done}/{students.length} học viên đã nộp
          </p>
          {students.length === 0 ? (
            <p className="mt-3 text-sm text-ink/55">Chưa giao cho học viên nào.</p>
          ) : (
            <ul className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
              {students.map((s) => (
                <li key={s.studentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold/25 bg-white px-3 py-2.5">
                  <div>
                    <p className="font-medium">
                      {s.fullName} <span className="text-xs font-normal text-ink/45">{s.studentCode}</span>
                    </p>
                    <p className="text-sm text-ink/60">{scoreLabel(s)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                    {s.focusLeaveCount ? <Badge tone="warn">Rời tab {s.focusLeaveCount}</Badge> : null}
                    {s.attemptId && s.status === 'COMPLETED' ? (
                      <Link to={`/admin/students/${s.studentId}/attempts/${s.attemptId}`} className="text-sm font-semibold text-gold-deep">
                        Xem điểm
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {q.data?.wholeExam ? (
            <div className="mt-4">
              <Button type="button" variant="navy" disabled={!ready || exporting} onClick={() => void downloadReport()}>
                {exporting ? 'Đang xuất…' : ready ? 'Tải báo cáo Excel' : `Còn ${pending} học viên chưa nộp`}
              </Button>
              {exportError ? (
                <p className="mt-2 text-sm text-coral" role="alert">
                  {exportError}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-5 flex justify-end">
            <Button type="button" variant="paper" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </>
      ) : null}
    </Modal>
  )
}

function SaveToBankButton({ id }: { id: string }) {
  const save = useSaveAssignmentToBank()
  const [note, setNote] = useState<string | null>(null)
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)
  return (
    <div>
      <Button
        variant="navy"
        disabled={save.isPending}
        onClick={() => {
          setNote(null)
          void save.mutateAsync(id).then(() => setNotice(flashNotice('Đã thay đổi thành công: đã lưu vào bộ đề.'))).catch((e: unknown) => setNote(e instanceof ApiError ? e.message : 'Không lưu được vào bộ đề.'))
        }}
      >
        {save.isPending ? 'Đang lưu…' : 'Lưu vào bộ đề'}
      </Button>
      {note ? <p className="mt-1 text-xs text-coral">{note}</p> : null}
      <CornerNotice notice={notice} />
    </div>
  )
}

function AssignmentFiles({ assignment, canManage }: { assignment: AssignmentDto; canManage: boolean }) {
  const uploadAudio = useUploadAssignmentAudio()
  const uploadImages = useUploadAssignmentImages()
  const listening = assignment.parts.some((p) => p.skill === 'LISTENING')
  const [note, setNote] = useState<string | null>(null)
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)
  const busy = uploadAudio.isPending || uploadImages.isPending

  async function onAudio(file: File) {
    setNote(null)
    try {
      await uploadAudio.mutateAsync({ id: assignment.id, file })
      setNotice(flashNotice('Đã gắn file nghe cho bài tập này.'))
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Không tải được file nghe.')
    }
  }

  async function onImages(files: File[]) {
    setNote(null)
    try {
      await uploadImages.mutateAsync({ id: assignment.id, files })
      setNotice(flashNotice(`Đã thêm ${files.length} ảnh đề.`))
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Không tải được ảnh đề.')
    }
  }

  return (
    <div className="mt-4 border-t border-ink/8 pt-3">
      <p className="text-xs text-ink/55">
        {listening ? (assignment.hasAudio ? 'Đã có file nghe. ' : 'Chưa có file nghe. ') : ''}
        {assignment.imageCount > 0 ? `${assignment.imageCount} ảnh đề.` : 'Chưa có ảnh đề.'} Học viên thấy các file này khi làm bài.
      </p>
      {canManage ? <div className="mt-2 flex flex-wrap gap-2">
        {listening ? (
          <FilePick
            label={busy && uploadAudio.isPending ? 'Đang tải file nghe…' : assignment.hasAudio ? 'Đổi file nghe' : 'Thêm file nghe'}
            accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
            disabled={busy}
            onFiles={(files) => {
              const file = files[0]
              if (file) void onAudio(file)
            }}
          />
        ) : null}
        <FilePick
          label={busy && uploadImages.isPending ? 'Đang tải ảnh…' : listening ? 'Thêm ảnh Listening' : 'Thêm ảnh Reading'}
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          disabled={busy}
          onFiles={(files) => {
            if (files.length) void onImages(files)
          }}
        />
      </div> : null}
      {note ? (
        <p className="mt-2 text-sm text-coral" role="alert">
          {note}
        </p>
      ) : null}
      <CornerNotice notice={notice} />
    </div>
  )
}

function ExamPick({
  exam,
  selected,
  partCodes,
  onSelect,
  onParts,
  onWhole,
}: {
  exam: ExamSummaryDto
  selected: boolean
  partCodes: string[]
  onSelect: (id: string) => void
  onParts: (codes: string[]) => void
  onWhole: () => void
}) {
  return (
    <div className={`rounded-2xl border p-4 ${selected ? 'border-gold-deep bg-teal-soft/40' : 'border-gold/30 bg-white'}`}>
      <button type="button" className="w-full text-left" onClick={() => onSelect(exam.id)}>
        <p className="font-semibold">{exam.title}</p>
        <p className="text-xs text-ink/50">
          {exam.code} • {exam.totalQuestions} câu
        </p>
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white" onClick={onWhole}>
          Giao cả bộ đề
        </button>
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
