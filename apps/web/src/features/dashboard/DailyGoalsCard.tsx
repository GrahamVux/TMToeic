import { Button, buttonClasses } from '@/components/ui/Button'
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

  if (isPending) {
    return (
      <Card className="p-6" aria-busy="true" aria-label="Đang tải mục tiêu hôm nay">
        <div className="space-y-4 animate-pulse">
          <div className="space-y-2">
            <div className="h-3 w-32 rounded-full bg-paper-2" />
            <div className="h-7 w-48 rounded-lg bg-paper-2" />
          </div>
          <div className="h-20 rounded-2xl bg-paper-2" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-28 rounded-2xl bg-paper-2" />
            <div className="h-28 rounded-2xl bg-paper-2" />
            <div className="h-28 rounded-2xl bg-paper-2" />
          </div>
        </div>
      </Card>
    )
  }
  if (error || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-soft">Không tải được mục tiêu hôm nay. Hãy tải lại trang.</p>
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
          <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">Mục tiêu mỗi ngày</p>
          <h2 className="serif mt-1 text-2xl font-bold">Mục tiêu hôm nay</h2>
          <p className="mt-1 text-sm text-ink-soft">{dayLabel(data.day)}</p>
        </div>
        {sum.active > 0 ? (
          <Button variant="navy" onClick={() => setEditing(true)}>
            <SlidersHorizontal className="size-4" aria-hidden />
            Mục tiêu ngày
          </Button>
        ) : null}
      </div>

      {data.yesterday ? <YesterdayCorner yesterday={data.yesterday} /> : null}

      {sum.active === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-gold-deep/40 bg-teal-soft/50 p-5">
          <p className="font-semibold">Bạn chưa đặt mục tiêu mỗi ngày</p>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
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
              <p className="mt-0.5 text-sm text-ink-soft">
                {sum.met === sum.active ? 'Bạn đã hoàn thành mục tiêu của hôm nay.' : 'Hoàn thành các mục còn lại trước khi hết ngày.'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {DAILY_GOAL_KINDS.map((kind) => (
              <GoalTile key={kind} kind={kind} done={data.done[kind]} target={data.targets[kind]} />
            ))}
          </div>

          {next ? <GoalReminder next={next} /> : null}
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

function YesterdayCorner({ yesterday }: { yesterday: NonNullable<DailyGoalsDto['yesterday']> }) {
  const items = DAILY_GOAL_KINDS.flatMap((kind) => {
    const target = yesterday.done[kind] - yesterday.delta[kind]
    if (target <= 0) return []
    const delta = yesterday.delta[kind]
    const { label, unit, icon, to } = KINDS[kind]
    return [{ kind, label, unit, icon, to, missing: Math.max(0, -delta), extra: Math.max(0, delta) }]
  })
  if (items.length === 0) return null

  if (yesterday.met) {
    return (
      <aside
        aria-label="Kết quả mục tiêu hôm qua"
        className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-olive/25 bg-success-soft px-4 py-2.5 text-xs"
      >
        <p className="flex items-center gap-2 font-semibold text-olive">
          <Check className="size-4 shrink-0" aria-hidden />
          Hôm qua đã hoàn thành đủ mục tiêu
        </p>
        <p className="text-ink-soft tabular-nums">
          {items.map((item) => (item.extra > 0 ? `${item.label} +${item.extra} ${item.unit}` : `${item.label} đủ`)).join(' • ')}
        </p>
      </aside>
    )
  }

  return (
    <aside aria-label="Kết quả mục tiêu hôm qua" className="mt-4 rounded-2xl border border-danger/25 bg-danger-soft/45 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-crimson" aria-hidden="true" />
          <p className="text-sm font-bold text-danger">Hôm qua chưa xong</p>
        </div>
        <p className="text-xs font-medium text-ink-soft">Bấm vào mục còn thiếu để bù ngay hôm nay</p>
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon
          if (item.missing > 0) {
            return (
              <Link
                key={item.kind}
                to={item.to}
                className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-cream px-3.5 py-2.5 shadow-2xs transition hover:border-danger/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                <div className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                    <Icon className="size-4 shrink-0 text-danger" aria-hidden />
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-danger">Còn thiếu</span>
                </div>
                <span className="inline-flex shrink-0 items-baseline gap-1 rounded-xl bg-danger-soft px-3 py-1.5 text-danger ring-1 ring-danger/25">
                  <span className="serif text-2xl leading-none font-extrabold tabular-nums">{item.missing}</span>
                  <span className="text-xs font-semibold">{item.unit}</span>
                </span>
              </Link>
            )
          }
          return (
            <div
              key={item.kind}
              className="flex items-center justify-between gap-3 rounded-xl border border-olive/25 bg-cream/80 px-3.5 py-2.5"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                <Check className="size-4 shrink-0 text-olive" aria-hidden />
                {item.label}
              </span>
              <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-olive tabular-nums">
                {item.extra > 0 ? `+${item.extra} ${item.unit}` : 'Đã đủ'}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function GoalReminder({ next }: { next: (typeof KINDS)[DailyGoalKind] & { done: number; target: number } }) {
  const remaining = next.target - next.done
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-gold-deep/40 p-4">
      <p className="text-sm text-ink-soft">
        {next.done === 0 ? (
          <>
            Hôm nay bạn chưa luyện <b>{next.label}</b>. Mục tiêu là <RemainCount value={remaining} unit={next.unit} />.
          </>
        ) : (
          <>
            Còn <RemainCount value={remaining} unit={next.unit} /> nữa là đạt mục tiêu <b>{next.label}</b> hôm nay.
          </>
        )}
      </p>
      <Link to={next.to} className={buttonClasses('gold')}>
        {next.cta}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  )
}

function RemainCount({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="mx-0.5 inline-flex items-baseline gap-1 rounded-lg bg-button px-2 py-0.5 align-middle text-button-ink shadow-[0_6px_14px_color-mix(in_srgb,var(--color-button)_35%,transparent)]">
      <span className="text-lg leading-none font-bold tabular-nums">{value}</span>
      <span className="text-xs font-semibold">{unit}</span>
    </span>
  )
}

function GoalTile({ kind, done, target }: { kind: DailyGoalKind; done: number; target: number }) {
  const { label, unit, icon: Icon, to } = KINDS[kind]
  const off = target === 0
  const met = !off && done >= target
  return (
    <Link to={to} className="group rounded-2xl border border-gold/50 bg-cream p-4 transition hover:border-gold-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
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
        <span className="ml-1 text-sm text-ink-soft">{off ? unit : `/ ${target} ${unit}`}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-2">
        <div className={cn('h-full rounded-full', met ? 'bg-olive' : 'bg-gold-deep')} style={{ width: off ? '0%' : `${Math.min(100, (done / target) * 100)}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
        <span className={cn(met && 'font-semibold text-olive')}>{off ? 'Chưa đặt mục tiêu' : met ? 'Đạt mục tiêu' : `Còn ${target - done} ${unit}`}</span>
        <ArrowRight className="size-4 text-ink-soft transition group-hover:text-gold-deep" aria-hidden />
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
      <p className="text-sm text-ink-soft">Chọn lượng bạn muốn hoàn thành mỗi ngày. Đặt 0 để tắt một mục.</p>
      <div className="mt-4 divide-y divide-gold/30">
        {DAILY_GOAL_KINDS.map((kind) => {
          const { field, hint, unit, step } = KINDS[kind]
          const max = DAILY_GOAL_LIMITS[kind].max
          return (
            <div key={kind} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{field}</p>
                <p className="text-xs text-ink-soft">
                  {hint} Tối đa {max} {unit}.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" className={stepCls} aria-label={`Giảm ${field}`} disabled={save.isPending || targets[kind] <= 0} onClick={() => setKind(kind, targets[kind] - step)}>
                  <Minus className="size-4" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={max}
                  aria-label={field}
                  disabled={save.isPending}
                  value={targets[kind]}
                  onChange={(e) => setKind(kind, Number(e.target.value))}
                  className="h-11 w-16 rounded-xl border border-gold/60 bg-cream text-center text-sm font-semibold tabular-nums outline-none focus:border-button focus:ring-2 focus:ring-button/30 disabled:opacity-50"
                />
                <button type="button" className={stepCls} aria-label={`Tăng ${field}`} disabled={save.isPending || targets[kind] >= max} onClick={() => setKind(kind, targets[kind] + step)}>
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

const stepCls = 'grid size-11 place-items-center rounded-full border border-ink/12 bg-cream text-ink transition hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 disabled:opacity-40'
