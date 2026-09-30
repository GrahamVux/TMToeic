import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { AttemptPlayerDto } from '@toeic/shared'
import { AlertTriangle, Headphones } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { trackForPart } from './audio'
import { AudioPlayer } from './AudioPlayer'
import { AutosaveStore, type SaveStatus } from './autosave'
import { formatClock, isListeningPart, partName, useAttemptPlayer, useSubmitAttempt } from './exams.queries'
import { PassageView } from './PassageView'

const MODE_LABEL: Record<string, string> = {
  PRACTICE: 'Luyện tập',
  TIMED: 'Tính giờ',
  FULL_TEST: 'Thi thử',
  PART_DRILL: 'Luyện theo part',
}

export function ExamPlayerPage() {
  const { attemptId } = useParams()
  const { data, isPending, error } = useAttemptPlayer(attemptId)

  if (isPending) return <p className="p-8 text-sm text-ink/55">Đang tải đề…</p>
  if (error || !data) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <h1 className="serif text-2xl">{notFound ? 'Không tìm thấy bài làm' : 'Không tải được bài làm'}</h1>
        <p className="mt-2 text-sm text-ink/60">{error instanceof ApiError ? error.message : 'Vui lòng thử lại.'}</p>
        <Link to="/practice" className="mt-5 inline-block">
          <Button variant="navy">Về danh sách đề</Button>
        </Link>
      </Card>
    )
  }
  if (data.attempt.status !== 'IN_PROGRESS') return <Navigate to={`/attempts/${data.attempt.id}/result`} replace />
  return <Player key={data.attempt.id} data={data} />
}

function Player({ data }: { data: AttemptPlayerDto }) {
  const { attempt, groups, questions, audio } = data
  const navigate = useNavigate()
  const submit = useSubmitAttempt()

  const [store] = useState(() => {
    const initial = Object.fromEntries(questions.map((q) => [q.id, q.selectedKey]))
    return new AutosaveStore(attempt.id, initial, () => navigate(`/attempts/${attempt.id}/result`, { replace: true }))
  })
  useEffect(() => {
    store.activate() // StrictMode mounts effects twice; a disposed store must be revivable
    return () => store.dispose()
  }, [store])
  const save = useSyncExternalStore(store.subscribe, store.getSnapshot)

  const [index, setIndex] = useState(() => {
    const firstOpen = questions.findIndex((q) => q.selectedKey === null)
    return firstOpen === -1 ? 0 : firstOpen
  })
  const [confirm, setConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

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
    try {
      await submit.mutateAsync(attempt.id)
      navigate(`/attempts/${attempt.id}/result`, { replace: true })
    } catch (err) {
      setFinishing(false)
      setSubmitError(err instanceof ApiError ? err.message : 'Không nộp được bài. Vui lòng thử lại.')
    }
  }

  const listening = isListeningPart(question.partCode)
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
        </div>
        <div className="flex flex-wrap items-center gap-3">
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

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
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

          {group ? (
            <Card className="p-5">
              <PassageView group={group} />
            </Card>
          ) : null}

          <Card className="p-6">
            <p className="text-sm text-ink/50">{partName(question.partCode)} • Câu {question.number}</p>
            {question.imageUrl ? (
              <img src={question.imageUrl} alt={`Hình minh họa câu ${question.number}`} className="mt-3 max-h-[26rem] w-full rounded-2xl border border-ink/10 bg-white object-contain" />
            ) : null}
            {question.prompt ? <h2 className="mt-3 text-xl leading-8 font-medium">{question.prompt}</h2> : null}
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
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>Câu trước</Button>
              <Button variant="navy" disabled={index === questions.length - 1} onClick={() => setIndex((i) => i + 1)}>Câu tiếp</Button>
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
                {code.replace('PART_', 'Part ')}
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
              Bạn đã chọn {answered}/{questions.length} câu. Câu chưa chọn sẽ tính là bỏ trống. Sau khi nộp sẽ không sửa được đáp án.
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
