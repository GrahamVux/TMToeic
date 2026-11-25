import { cn } from '@/lib/cn'
import { Calendar as CalendarIcon, Clock } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

const MONTHS = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
]
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const TIME_PRESETS = ['12:00', '18:00', '21:00', '23:59'] as const

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dateKey(d: Date): number {
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate()
}

function parseLocalValue(value: string): { date: Date; hour: number; minute: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return { date: d, hour: Math.min(23, Number(m[4])), minute: Math.min(59, Number(m[5])) }
  }
  const fallback = new Date(Date.now() + 3 * 86_400_000)
  return {
    date: new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()),
    hour: fallback.getHours(),
    minute: fallback.getMinutes(),
  }
}

function formatValue(date: Date, hour: number, minute: number): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}`
}

function formatReadable(date: Date, hour: number, minute: number): string {
  const wd = date.getDay() === 0 ? 'CN' : `T${date.getDay() + 1}`
  return `${wd}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} · ${pad(hour)}:${pad(minute)}`
}

/**
 * Animated calendar + time picker faithfully ported from Lucian UX/UI Prompt #431.
 * Accepts & emits standard `YYYY-MM-DDTHH:mm` strings for drop-in replacement of `datetime-local`.
 */
export function CalendarDateTimePicker({
  id,
  value,
  onChange,
  className,
}: {
  id?: string
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  const parsed = parseLocalValue(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => new Date(parsed.date.getFullYear(), parsed.date.getMonth(), 1))
  const [slideDir, setSlideDir] = useState<-1 | 0 | 1>(0)
  const [slideTick, setSlideTick] = useState(0)
  const [selPos, setSelPos] = useState<{ x: number; y: number; visible: boolean; jump: boolean }>({
    x: 0,
    y: 0,
    visible: false,
    jump: true,
  })

  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const prevInViewRef = useRef(false)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const firstAllowed = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastAllowed = new Date(today.getFullYear(), today.getMonth() + 12, 0)

  useEffect(() => {
    if (!open) return
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const inView = parsed.date.getFullYear() === view.getFullYear() && parsed.date.getMonth() === view.getMonth()

  useLayoutEffect(() => {
    if (!open || !gridRef.current) return
    const btn = inView ? gridRef.current.querySelector<HTMLButtonElement>(`[data-day="${parsed.date.getDate()}"]`) : null
    if (btn) {
      const jump = !prevInViewRef.current
      setSelPos({ x: btn.offsetLeft, y: btn.offsetTop, visible: true, jump })
      prevInViewRef.current = true
    } else {
      setSelPos((prev) => ({ ...prev, visible: false, jump: true }))
      prevInViewRef.current = false
    }
  }, [open, view, parsed.date, inView])

  function shiftMonth(delta: number) {
    const nextView = new Date(view.getFullYear(), view.getMonth() + delta, 1)
    if (dateKey(nextView) < dateKey(firstAllowed)) return
    if (nextView.getFullYear() * 12 + nextView.getMonth() > lastAllowed.getFullYear() * 12 + lastAllowed.getMonth()) return
    prevInViewRef.current = false
    setSlideDir(delta > 0 ? 1 : -1)
    setSlideTick((t) => t + 1)
    setView(nextView)
  }

  function pickDate(nextDate: Date) {
    onChange(formatValue(nextDate, parsed.hour, parsed.minute))
  }

  function pickTime(hour: number, minute: number) {
    onChange(formatValue(parsed.date, hour, minute))
  }

  function onGridKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.u431-d')
    if (!target || !target.dataset.day) return
    const cur = new Date(view.getFullYear(), view.getMonth(), Number(target.dataset.day))
    const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key]
    let nd: Date | null = null
    if (mv) nd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + mv)
    else if (e.key === 'PageDown' || e.key === 'PageUp') {
      nd = new Date(cur.getFullYear(), cur.getMonth() + (e.key === 'PageDown' ? 1 : -1), Math.min(cur.getDate(), 28))
    } else return

    e.preventDefault()
    e.stopPropagation()
    if (dateKey(nd) < dateKey(today)) nd = new Date(today)
    if (dateKey(nd) > dateKey(lastAllowed)) nd = new Date(lastAllowed)
    const diff = nd.getFullYear() * 12 + nd.getMonth() - (view.getFullYear() * 12 + view.getMonth())
    if (diff !== 0) {
      prevInViewRef.current = false
      setSlideDir(diff > 0 ? 1 : -1)
      setSlideTick((t) => t + 1)
      setView(new Date(nd.getFullYear(), nd.getMonth(), 1))
    }
    pickDate(nd)
  }

  const y = view.getFullYear()
  const m = view.getMonth()
  const firstDow = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const canPrev = dateKey(view) > dateKey(firstAllowed)
  const canNext = y * 12 + m < lastAllowed.getFullYear() * 12 + lastAllowed.getMonth()

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            prevInViewRef.current = false
            setView(new Date(parsed.date.getFullYear(), parsed.date.getMonth(), 1))
            setSlideDir(0)
          }
          setOpen((v) => !v)
        }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-gold/45 bg-cream px-3 text-left text-sm text-ink shadow-xs transition hover:border-button focus-visible:outline-2 focus-visible:outline-button"
      >
        <span className="flex min-w-0 items-center gap-2 truncate font-medium">
          <CalendarIcon className="size-4 shrink-0 text-gold-deep" />
          <span className="truncate tabular-nums">{formatReadable(parsed.date, parsed.hour, parsed.minute)}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-gold-deep">Đổi</span>
      </button>

      {open ? (
        <div className="ux absolute right-0 z-50 mt-2 w-[312px] max-w-[calc(100vw-2rem)] rounded-[20px] bg-cream p-3 shadow-[0_0_0_1px_var(--ux-line-2),0_20px_44px_-16px_var(--ux-shadow-strong)]">
          <div className="u431-hd">
            <b aria-live="polite">
              {MONTHS[m]} {y}
            </b>
            <button type="button" className="u431-nav" aria-label="Tháng trước" disabled={!canPrev} onClick={() => shiftMonth(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m14.5 6-6 6 6 6" />
              </svg>
            </button>
            <button type="button" className="u431-nav" aria-label="Tháng sau" disabled={!canNext} onClick={() => shiftMonth(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9.5 6 6 6-6 6" />
              </svg>
            </button>
          </div>

          <div className="u431-wk" aria-hidden="true">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="u431-gw">
            <i
              className={cn('u431-sel', selPos.jump && 'is-jump')}
              aria-hidden="true"
              style={{
                ['--sx' as string]: `${selPos.x}px`,
                ['--sy' as string]: `${selPos.y}px`,
                ['--ss' as string]: selPos.visible ? 1 : 0,
              }}
            />
            <div
              key={slideTick}
              ref={gridRef}
              role="grid"
              aria-label="Chọn ngày"
              onKeyDown={onGridKeyDown}
              className={cn('u431-g', slideDir > 0 && 'is-l', slideDir < 0 && 'is-r')}
            >
              {Array.from({ length: 42 }, (_, i) => {
                const day = i - firstDow + 1
                if (day < 1 || day > daysInMonth) return <span key={i} role="gridcell" />
                const d = new Date(y, m, day)
                const isToday = dateKey(d) === dateKey(today)
                const isDisabled = dateKey(d) < dateKey(today) || dateKey(d) > dateKey(lastAllowed)
                const isSelected = dateKey(d) === dateKey(parsed.date)
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    className="u431-d"
                    data-day={day}
                    disabled={isDisabled}
                    tabIndex={isSelected || (isToday && !inView) ? 0 : -1}
                    aria-selected={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => pickDate(d)}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-2.5 border-t border-gold/25 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/75">
                <Clock className="size-3.5 text-gold-deep" /> Giờ hạn nộp
              </span>
              <div className="flex items-center gap-1">
                <select
                  aria-label="Giờ"
                  value={parsed.hour}
                  onChange={(e) => pickTime(Number(e.target.value), parsed.minute)}
                  className="h-8 rounded-lg border border-gold/40 bg-paper px-2 text-xs font-semibold tabular-nums text-ink"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {pad(h)}h
                    </option>
                  ))}
                </select>
                <span className="text-xs font-bold text-ink/50">:</span>
                <select
                  aria-label="Phút"
                  value={parsed.minute}
                  onChange={(e) => pickTime(parsed.hour, Number(e.target.value))}
                  className="h-8 rounded-lg border border-gold/40 bg-paper px-2 text-xs font-semibold tabular-nums text-ink"
                >
                  {Array.from({ length: 12 }, (_, idx) => idx * 5).map((min) => (
                    <option key={min} value={min}>
                      {pad(min)}
                    </option>
                  ))}
                  {parsed.minute % 5 !== 0 ? <option value={parsed.minute}>{pad(parsed.minute)}</option> : null}
                </select>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
              <div className="flex gap-1">
                {TIME_PRESETS.map((preset) => {
                  const [hh, mm] = preset.split(':').map(Number)
                  const active = parsed.hour === hh && parsed.minute === mm
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => pickTime(hh!, mm!)}
                      className={cn(
                        'rounded-lg px-2 py-1 text-[11px] font-semibold tabular-nums transition',
                        active ? 'bg-button text-button-ink' : 'bg-paper-2 text-ink/70 hover:text-ink',
                      )}
                    >
                      {preset}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-button px-2.5 py-1 text-[11px] font-semibold text-button-ink"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
