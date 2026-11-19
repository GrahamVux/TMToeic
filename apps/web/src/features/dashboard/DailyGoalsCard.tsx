import { Button } from '@/components/ui/Button'
import { CornerNotice, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Primitives'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { DAILY_GOAL_KINDS, DAILY_GOAL_LIMITS, type DailyGoalCounts, type DailyGoalKind, type DailyGoalsDto } from '@toeic/shared'
import { ArrowRight, BookOpen, Check, Headphones, Languages, Minus, Plus, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDailyGoals, useSetDailyGoals } from './dashboard.queries'

const KINDS: Record<DailyGoalKind, { label: string; unit: string; icon: LucideIcon; to: string; cta: string; field: string; hint: string; step: number }> = {
  reading: { label: 'Đọc', unit: 'bài', icon: BookOpen, to: '/practice/reading', cta: 'Luyện đọc', field: 'Số bài Reading', hint: 'Bài đã nộp có câu Part 5–7.', step: 1 },
  listening: { label: 'Nghe', unit: 'bài', icon: Headphones, to: '/practice/listening', cta: 'Luyện nghe', field: 'Số bài Listening', hint: 'Bài đã nộp có câu Part 1–4.', step: 1 },
  vocab: { label: 'Từ vựng', unit: 'từ', icon: Languages, to: '/study/flashcards', cta: 'Ôn từ vựng', field: 'Số từ vựng', hint: 'Thẻ từ đã ôn trong flashcard.', step: 5 },
}

const RING_R = 26
const RING_C = 2 * Math.PI * RING_R

function dayLabel(day: string) {
  const text = new Date(`${day}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function summarize(d: DailyGoalsDto) {
  const active = DAILY_GOAL_KINDS.filter((kind) => d.targets[kind] > 0)
  const unmet = active.filter((kind) => d.done[kind] < d.targets[kind])
  const share = active.reduce((sum, kind) => sum + Math.min(1, d.done[kind] / d.targets[kind]), 0)
  return {
    active: active.length,
    met: active.length - unmet.length,
    percent: active.length ? Math.round((share / active.length) * 100) : 0,
    // Point at a goal not started yet before one that is partly done.
    next: unmet.find((kind) => d.done[kind] === 0) ?? unmet[0] ?? null,
  }
}

export function DailyGoalsCard() {
  const { data, isPending, error } = useDailyGoals()
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)

  if (isPending) return null
  if (error || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink/60">Không tải được mục tiêu hôm nay. Hãy tải lại trang.</p>
      </Card>
    )
  }

  const sum = summarize(data)
  const next = sum.next ? { ...KINDS[sum.next], done: data.done[sum.next], target: data.targets[sum.next] } : null

  return (
    <Card className="p-6">
      <CornerNotice notice={notice} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-gold-deep uppercase">Mục tiêu mỗi ngày</p>
          <h2 className="serif mt-1 text-2xl">Mục tiêu hôm nay</h2>
          <p className="mt-1 text-sm text-ink/55">{dayLabel(data.day)}</p>
        </div>
        {sum.active > 0 ? (
          <Button variant="navy" onClick={() => setEditing(true)}>
            <SlidersHorizontal className="size-4" aria-hidden />
            Mục tiêu ngày
          </Button>
        ) : null}
      </div>

      {sum.active === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-gold-deep/40 bg-teal-soft/50 p-5">
          <p className="font-semibold">Bạn chưa đặt mục tiêu mỗi ngày</p>
          <p className="mt-1 max-w-2xl text-sm text-ink/65">
            Chọn số bài Reading, số bài Listening và số từ vựng muốn hoàn thành mỗi ngày. Bảng này sẽ nhắc bạn mỗi lần đăng nhập.
          </p>
          <Button className="mt-4" onClick={() => setEditing(true)}>
            Đặt mục tiêu ngày
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-teal-soft/60 p-4">
            <span className="relative grid size-16 shrink-0 place-items-center text-gold-deep" role="img" aria-label={`Hoàn thành ${sum.percent}%`}>
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64" aria-hidden>
                <circle cx="32" cy="32" r={RING_R} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r={RING_R}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - sum.percent / 100)}
                />
              </svg>
              <span className="text-sm font-bold text-ink tabular-nums">{sum.percent}%</span>
            </span>
            <div className="min-w-0">
              <p className="font-semibold">
                Đã xong {sum.met}/{sum.active} mục tiêu
              </p>
              <p className="mt-0.5 text-sm text-ink/60">
                {sum.met === sum.active ? 'Bạn đã hoàn thành mục tiêu của hôm nay.' : 'Hoàn thành các mục còn lại trước khi hết ngày.'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {DAILY_GOAL_KINDS.map((kind) => (
              <GoalTile key={kind} kind={kind} done={data.done[kind]} target={data.targets[kind]} />
            ))}
          </div>

          {next ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-gold-deep/40 p-4">
              <p className="text-sm text-ink/75">
                {next.done === 0 ? (
                  <>
                    Hôm nay bạn chưa luyện <b>{next.label}</b>. Mục tiêu là {next.target} {next.unit}.
                  </>
                ) : (
                  <>
                    Còn <b>{next.target - next.done} {next.unit}</b> nữa là đạt mục tiêu <b>{next.label}</b> hôm nay.
                  </>
                )}
              </p>
              <Link to={next.to}>
                <Button>
                  {next.cta}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </Link>
            </div>
          ) : null}
        </>
      )}

      {editing ? (
        <GoalForm
          data={data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            setNotice(flashNotice('Đã lưu mục tiêu ngày.'))
          }}
        />
      ) : null}
    </Card>
  )
}

function GoalTile({ kind, done, target }: { kind: DailyGoalKind; done: number; target: number }) {
  const { label, unit, icon: Icon, to } = KINDS[kind]
  const off = target === 0
  const met = !off && done >= target
  return (
    <Link to={to} className="group rounded-2xl border border-gold/50 bg-white p-4 transition hover:border-gold-deep">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-gold-deep" aria-hidden />
          {label}
        </span>
        {met ? (
          <span className="grid size-5 place-items-center rounded-full bg-olive/15 text-olive" aria-hidden>
            <Check className="size-3" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <p className="mt-3">
        <span className="text-2xl font-semibold tabular-nums">{done}</span>
        <span className="ml-1 text-sm text-ink/50">{off ? unit : `/ ${target} ${unit}`}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-2">
        <div className={cn('h-full rounded-full', met ? 'bg-olive' : 'bg-gold-deep')} style={{ width: off ? '0%' : `${Math.min(100, (done / target) * 100)}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-ink/60">
        <span className={cn(met && 'font-semibold text-olive')}>{off ? 'Chưa đặt mục tiêu' : met ? 'Đạt mục tiêu' : `Còn ${target - done} ${unit}`}</span>
        <ArrowRight className="size-4 text-ink/40 transition group-hover:text-gold-deep" aria-hidden />
      </div>
    </Link>
  )
}

function GoalForm({ data, onClose, onSaved }: { data: DailyGoalsDto; onClose: () => void; onSaved: () => void }) {
  const save = useSetDailyGoals()
  const [targets, setTargets] = useState<DailyGoalCounts>(() =>
    data.configured
      ? data.targets
      : { reading: DAILY_GOAL_LIMITS.reading.suggested, listening: DAILY_GOAL_LIMITS.listening.suggested, vocab: DAILY_GOAL_LIMITS.vocab.suggested },
  )
  const [error, setError] = useState<string | null>(null)

  function setKind(kind: DailyGoalKind, value: number) {
    const whole = Number.isFinite(value) ? Math.round(value) : 0
    setTargets((prev) => ({ ...prev, [kind]: Math.min(DAILY_GOAL_LIMITS[kind].max, Math.max(0, whole)) }))
  }

  async function submit() {
    setError(null)
    try {
      await save.mutateAsync(targets)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được mục tiêu. Hãy thử lại.')
    }
  }

  return (
    <Modal title="Mục tiêu mỗi ngày" onClose={onClose} dismissible={!save.isPending}>
      <p className="text-sm text-ink/60">Chọn lượng bạn muốn hoàn thành mỗi ngày. Đặt 0 để tắt một mục.</p>
      <div className="mt-4 divide-y divide-gold/30">
        {DAILY_GOAL_KINDS.map((kind) => {
          const { field, hint, unit, step } = KINDS[kind]
          const max = DAILY_GOAL_LIMITS[kind].max
          return (
            <div key={kind} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{field}</p>
                <p className="text-xs text-ink/55">
                  {hint} Tối đa {max} {unit}.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" className={stepCls} aria-label={`Giảm ${field}`} disabled={targets[kind] <= 0} onClick={() => setKind(kind, targets[kind] - step)}>
                  <Minus className="size-4" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={max}
                  aria-label={field}
                  value={targets[kind]}
                  onChange={(e) => setKind(kind, Number(e.target.value))}
                  className="h-9 w-16 rounded-xl border border-gold/60 bg-white text-center text-sm font-semibold tabular-nums outline-none focus:border-gold-deep focus:ring-2 focus:ring-gold-deep/20"
                />
                <button type="button" className={stepCls} aria-label={`Tăng ${field}`} disabled={targets[kind] >= max} onClick={() => setKind(kind, targets[kind] + step)}>
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="ghost" disabled={save.isPending} onClick={onClose}>
          Hủy
        </Button>
        <Button disabled={save.isPending} onClick={() => void submit()}>
          {save.isPending ? 'Đang lưu…' : 'Lưu mục tiêu'}
        </Button>
      </div>
    </Modal>
  )
}

const stepCls = 'grid size-9 place-items-center rounded-full border border-ink/12 bg-white text-ink transition hover:bg-paper-2 disabled:opacity-40'
