import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Badge, Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { cn } from '@/lib/cn'
import { FILL_QUESTION_TYPE, type AttemptPlayerDto } from '@toeic/shared'
import { AlertTriangle, Headphones } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { trackForPart } from './audio'
import { AudioPlayer } from './AudioPlayer'
import { AutosaveStore, type SaveStatus } from './autosave'
import { useFocusGuard } from './focus-guard'
import { formatClock, isListeningPart, partName, useAttemptPlayer, useSubmitAttempt } from './exams.queries'
import { SelectableText } from '@/features/study/SelectableText'
import { PassageView } from './PassageView'
import { SheetGallery } from './SheetGallery'
import { examTextStyle, TextZoomBar, ZoomableImage } from './ZoomableImage'

const MODE_LABEL: Record<string, string> = {
  PRACTICE: 'Luyện tập',
  TIMED: 'Tính giờ',
  FULL_TEST: 'Thi thử',
  PART_DRILL: 'Luyện theo part',
}

export function ExamPlayerPage() {
  const { attemptId } = useParams()
  const { data, isPending, error } = useAttemptPlayer(attemptId)

  if (isPending) return <PageLoading message="Đang tải đề…" />
  if (error || !data) return <QueryErrorRedirect error={error} />
  if (data.attempt.status !== 'IN_PROGRESS') return <Navigate to={`/attempts/${data.attempt.id}/result`} replace />
  return <Player key={data.attempt.id} data={data} />
}

function Player({ data }: { data: AttemptPlayerDto }) {
  const { attempt, groups, questions, audio } = data
  const navigate = useNavigate()
  const submit = useSubmitAttempt()

  const [store] = useState(() => {
    const initial = Object.fromEntries(questions.map((q) => [q.id, q.type === FILL_QUESTION_TYPE ? q.answerText : q.selectedKey]))
    const textIds = new Set(questions.filter((q) => q.type === FILL_QUESTION_TYPE).map((q) => q.id))
    return new AutosaveStore(attempt.id, initial, () => navigate(`/attempts/${attempt.id}/result`, { replace: true }), textIds)
  })
  useEffect(() => {
    store.activate() // StrictMode mounts effects twice; a disposed store must be revivable
    return () => store.dispose()
  }, [store])
  const save = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const focus = useFocusGuard(attempt.id, attempt.focusWatch)

  const [index, setIndex] = useState(() => {
    const firstOpen = questions.findIndex((q) => (q.type === FILL_QUESTION_TYPE ? !q.answerText : q.selectedKey === null))
    return firstOpen === -1 ? 0 : firstOpen
  })
  const [confirm, setConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [scoring, setScoring] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [textZoom, setTextZoom] = useState(1)

  const question = questions[index]
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const group = question.groupId ? groupById.get(question.groupId) : undefined
  const answered = questions.filter((q) => save.answers[q.id] != null).length

  // Time spent per question (sent with the answer, used later for analytics).
  useEffect(() => {
    store.enter(question.id)
  }, [store, question.id])

  function choose(key: string) {
    store.select(question.id, save.answers[question.id] === key ? null : key)
  }

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    if (save.pending === 0) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [save.pending])

  async function finish(reason: 'manual' | 'time') {
    if (finishing) return
    setFinishing(true)
    setSubmitError(null)
    if (reason === 'time') setScoring(true)
    // Give the autosave queue a chance to drain so the last picks are counted. After the deadline the server refuses late writes anyway.
    if (reason === 'manual') {
      const ok = await store.flush()
      if (!ok) {
        setFinishing(false)
        setSubmitError('Chưa lưu được một số câu trả lời (mất kết nối?). Hãy kiểm tra mạng rồi nộp lại — đáp án của bạn vẫn còn trên màn hình.')
        return
      }
    } else {
      await store.flush(3000)
    }
    const tries = reason === 'time' ? 4 : 1
    for (let i = 0; i < tries; i++) {
      try {
        await submit.mutateAsync(attempt.id)
        navigate(`/attempts/${attempt.id}/result`, { replace: true })
        return
      } catch {
        if (i < tries - 1) await new Promise((resolve) => setTimeout(resolve, 700))
      }
    }
    if (reason === 'time') {
      navigate(`/attempts/${attempt.id}/result`, { replace: true })
      return
    }
    setFinishing(false)
    setSubmitError('Không nộp được bài. Vui lòng thử lại.')
  }

  const listening = isListeningPart(question.partCode)
  const passageOpen = Boolean(group && (group.passages.length > 0 || group.instructions))
  const listeningFigure = listening && (data.sheetImages.length > 0 || !!group?.imageUrl || !!question.imageUrl)
  const partsInOrder = useMemo(() => {
    const seen = new Map<string, number>()
    questions.forEach((q, i) => {
      if (!seen.has(q.partCode)) seen.set(q.partCode, i)
    })
    return [...seen.entries()]
  }, [questions])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-cream px-5 py-4">
        <div>
          <p className="text-xs text-gold-deep">{MODE_LABEL[attempt.mode] ?? attempt.mode} • {attempt.totalQuestions} câu</p>
          <h1 className="serif text-2xl">{attempt.examTitle}</h1>
          {attempt.focusWatch ? (
            <p className="mt-1 max-w-md text-xs text-ink/55">Rời tab hoặc chuyển sang cửa sổ khác sẽ được ghi lại cho giáo viên.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TextZoomBar scale={textZoom} onChange={setTextZoom} />
          <SaveIndicator status={save.status} pending={save.pending} />
          <Badge tone="gold">{answered}/{questions.length} đã chọn</Badge>
          {attempt.remainingSeconds !== null ? (
            <Countdown remainingSeconds={attempt.remainingSeconds} onExpire={() => void finish('time')} />
          ) : (
            <span className="rounded-full bg-paper px-3 py-1 text-sm text-ink/55">Không giới hạn thời gian</span>
          )}
          <Button variant="danger" disabled={finishing} onClick={() => setConfirm(true)}>Nộp bài</Button>
        </div>
      </div>

      {scoring ? (
        <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm font-semibold text-teal" role="status">
          Hết giờ. Đang chấm điểm…
        </p>
      ) : null}

      {focus.notice ? (
        <Modal title="Cảnh báo rời màn hình" onClose={focus.dismiss} dismissible={false}>
          <p className="flex gap-2 text-sm text-ink/80">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" />
            <span>{focus.notice}</span>
          </p>
          <div className="mt-5 flex justify-end">
            <Button variant="danger" onClick={focus.dismiss}>Tôi đã hiểu</Button>
          </div>
        </Modal>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <AudioPlayer attemptId={attempt.id} tracks={audio} partCode={question.partCode} mode={attempt.mode} />
          {listening && !trackForPart(audio, question.partCode) ? (
            <div className="flex items-center gap-3 rounded-2xl bg-teal-soft px-4 py-3">
              <Headphones className="size-5 text-teal" />
              <div>
                <p className="text-xs font-semibold text-teal uppercase">Listening</p>
                <p className="text-sm text-ink/70">
                  Phần này chưa có audio. Nếu bạn đang luyện riêng một part, hãy làm cả bài nghe (Part 1–4) để có audio đầy đủ, hoặc nhờ giáo viên gắn audio cho part này.
                </p>
              </div>
            </div>
          ) : null}

          {passageOpen && group ? (
            <Card className="min-w-0 p-5">
              {!listening ? <SheetGallery images={data.sheetImages} embedded /> : null}
              {!listening && group.imageUrl ? <ZoomableImage src={group.imageUrl} alt="Hình hoặc bảng biểu của đoạn đọc" /> : null}
              <div className="exam-scale" style={examTextStyle(textZoom)}>
                <PassageView group={group} showImage={false} />
              </div>
            </Card>
          ) : null}

          <Card className="min-w-0 p-6">
            <div className={listeningFigure ? 'grid items-start gap-5 lg:grid-cols-2' : undefined}>
            {listeningFigure ? (
              <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto">
                <SheetGallery images={data.sheetImages} embedded fit="listening" />
                {group?.imageUrl ? (
                  <div className="mb-4">
                    <ZoomableImage src={group.imageUrl} alt="Hình của phần nghe" fit="listening" />
                  </div>
                ) : null}
                {question.imageUrl ? (
                  <div className="mb-4">
                    <ZoomableImage src={question.imageUrl} alt={`Hình minh họa câu ${question.number}`} fit="listening" />
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {(listening || !passageOpen) ? <SheetGallery images={data.sheetImages} embedded /> : null}
                {(listening || !passageOpen) && group?.imageUrl ? (
                  <div className="mb-4">
                    <ZoomableImage src={group.imageUrl} alt="Hình hoặc bảng biểu của đoạn đọc" />
                  </div>
                ) : null}
                {question.imageUrl ? (
                  <div className="mb-4">
                    <ZoomableImage src={question.imageUrl} alt={`Hình minh họa câu ${question.number}`} />
                  </div>
                ) : null}
              </>
            )}
            <div className="exam-scale" style={examTextStyle(textZoom)}>
            <p className="text-sm text-ink/50">{partName(question.partCode)} • Câu {question.number}</p>
            {question.type === FILL_QUESTION_TYPE ? (
              <FillBlank
                prompt={question.prompt}
                blankIndex={question.blankIndex ?? 0}
                value={save.answers[question.id] ?? ''}
                onChange={(value) => store.typeText(question.id, value)}
              />
            ) : (
              <>
                {question.prompt ? <SelectableText as="h2" className="mt-3 text-xl leading-8 font-medium" text={question.prompt} /> : null}
                <div className="mt-6 grid gap-3" role="radiogroup" aria-label={`Đáp án câu ${question.number}`}>
                  {question.options.map((option) => {
                    const selected = save.answers[question.id] === option.key
                    return (
                      <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => choose(option.key)}
                        className={cn('rounded-2xl border px-4 py-3 text-left transition', selected ? 'border-gold-deep bg-teal-soft' : 'border-ink/10 hover:bg-paper')}
                      >
                        <span className="mr-3 font-bold">{option.key}.</span>
                        {option.text}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 text-xs text-ink/40">Bấm lại đáp án đã chọn để bỏ chọn.</p>
              </>
            )}
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>Câu trước</Button>
              <Button variant="navy" disabled={index === questions.length - 1} onClick={() => setIndex((i) => i + 1)}>Câu tiếp</Button>
            </div>
            </div>
            </div>
          </Card>
        </div>

        <Card className="h-fit p-4 lg:sticky lg:top-4">
          <p className="text-sm font-semibold">Phiếu trả lời</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {partsInOrder.map(([code, firstIndex]) => (
              <button
                key={code}
                type="button"
                onClick={() => setIndex(firstIndex)}
                className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', question.partCode === code ? 'bg-gold-deep text-white' : 'bg-paper')}
              >
                {code.startsWith('FILL_') ? 'Điền từ' : code.replace('PART_', 'Part ')}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {questions.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Câu ${item.number}${save.answers[item.id] ? ' đã chọn' : ''}`}
                className={cn(
                  'h-9 rounded-lg text-sm font-semibold',
                  i === index ? 'bg-gold-deep text-white' : save.answers[item.id] ? 'bg-gold text-ink' : 'bg-paper',
                )}
              >
                {item.number}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/30 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <Card className="w-full max-w-md p-6">
            <h2 id="submit-title" className="serif text-2xl">Nộp bài?</h2>
            <p className="mt-2 text-sm text-ink/65">
              Bạn đã trả lời {answered}/{questions.length} câu. Câu chưa làm sẽ tính là bỏ trống. Sau khi nộp sẽ không sửa được đáp án.
            </p>
            {submitError ? (
              <p className="mt-3 flex gap-2 rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {submitError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" disabled={finishing} onClick={() => setConfirm(false)}>Tiếp tục làm</Button>
              <Button variant="danger" disabled={finishing} onClick={() => void finish('manual')}>
                {finishing ? 'Đang nộp…' : 'Nộp bài'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {finishing && !confirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 text-white" role="status">
          Hết giờ — đang nộp bài…
        </div>
      ) : null}
    </div>
  )
}

function FillBlank({ prompt, blankIndex, value, onChange }: { prompt: string; blankIndex: number; value: string; onChange: (value: string) => void }) {
  const pieces = prompt.split(/_{3,}/)
  return (
    <div className="mt-3">
      <p className="text-xl leading-8 font-medium">
        {pieces.map((piece, index) => (
          <span key={index}>
            {piece}
            {index < pieces.length - 1 ? (
              index === blankIndex ? (
                <input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  aria-label={`Chỗ trống ${index + 1}`}
                  className="mx-1 inline-block w-[8em] min-w-28 rounded-lg border border-gold-deep bg-white px-2 py-1 text-center text-lg"
                  autoComplete="off"
                />
              ) : (
                <span className="mx-1 text-ink/35">({index + 1})</span>
              )
            ) : null}
          </span>
        ))}
      </p>
      <p className="mt-3 text-xs text-ink/40">Gõ từ vào ô. Xóa hết chữ để bỏ trống chỗ này.</p>
    </div>
  )
}

function SaveIndicator({ status, pending }: { status: SaveStatus; pending: number }) {
  const map: Record<SaveStatus, { text: string; tone: string }> = {
    saved: { text: 'Đã lưu', tone: 'text-olive' },
    saving: { text: `Đang lưu${pending > 1 ? ` (${pending})` : ''}…`, tone: 'text-ink/55' },
    offline: { text: 'Mất kết nối — đang thử lại', tone: 'text-warn' },
    error: { text: 'Lỗi lưu đáp án', tone: 'text-coral' },
  }
  const { text, tone } = map[status]
  return <span className={cn('text-xs font-semibold', tone)} role="status" aria-live="polite">{text}</span>
}

/**
 * Counts down from the server-provided remaining time (not the device clock, so a wrong clock cannot extend the exam).
 * The server remains the authority: late writes are rejected after the deadline.
 */
function Countdown({ remainingSeconds, onExpire }: { remainingSeconds: number; onExpire: () => void }) {
  const [endsAt] = useState(() => Date.now() + remainingSeconds * 1000)
  const [now, setNow] = useState(() => Date.now())
  const fired = useRef(false)
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    onExpireRef.current = onExpire
  })

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true
      onExpireRef.current()
    }
  }, [left])

  return (
    <span
      className={cn('rounded-full px-3 py-1 font-mono text-sm', left <= 300 ? 'bg-[#f8dcd8] text-coral' : 'bg-paper text-gold-deep')}
      role="timer"
      aria-label={`Còn lại ${formatClock(left)}`}
    >
      {formatClock(left)}
    </span>
  )
}
