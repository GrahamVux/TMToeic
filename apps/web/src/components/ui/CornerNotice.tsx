import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type NoticeTone = 'success' | 'error'

export type CornerNoticeState = { id: number; text: string; tone: NoticeTone }

const TONE = {
  success: { bar: 'bg-[#3cb85c]', ink: 'text-[#3cb85c]' },
  error: { bar: 'bg-[#e24b4b]', ink: 'text-[#e24b4b]' },
} as const

const VISIBLE_MS = 5000
const RING_R = 14
const RING_C = 2 * Math.PI * RING_R

let noticeSeq = 0

export function flashNotice(text: string): CornerNoticeState {
  noticeSeq += 1
  return { id: noticeSeq, text, tone: 'success' }
}

export function flashError(text: string): CornerNoticeState {
  noticeSeq += 1
  return { id: noticeSeq, text, tone: 'error' }
}

/** Toast in the top-right corner. A circle counts down 5 seconds, then the toast goes away. */
export function CornerNotice({ notice }: { notice: CornerNoticeState | null }) {
  const [shown, setShown] = useState<CornerNoticeState | null>(null)
  const [leftMs, setLeftMs] = useState(VISIBLE_MS)
  const closed = useRef(false)

  useEffect(() => {
    closed.current = false
    setShown(notice)
    setLeftMs(VISIBLE_MS)
    if (!notice) return
    const started = performance.now()
    let frame = 0
    const tick = () => {
      if (closed.current) return
      const left = Math.max(0, VISIBLE_MS - (performance.now() - started))
      setLeftMs(left)
      if (left > 0) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    const timer = window.setTimeout(() => {
      setShown((current) => (current?.id === notice.id ? null : current))
    }, VISIBLE_MS)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [notice])

  if (!shown) return null
  const tone = TONE[shown.tone]
  const ratio = Math.min(1, Math.max(0, leftMs / VISIBLE_MS))
  const seconds = Math.max(1, Math.ceil(leftMs / 1000))

  function close() {
    closed.current = true
    setShown(null)
  }

  return createPortal(
    <div
      className="fixed top-4 right-4 z-[80] flex max-w-md items-stretch overflow-hidden rounded-lg bg-white shadow-[0_8px_24px_rgba(30,51,60,0.16)]"
      role={shown.tone === 'error' ? 'alert' : 'status'}
    >
      <span className={`w-1.5 shrink-0 ${tone.bar}`} aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-white ${tone.bar}`} aria-hidden>
          {shown.tone === 'error' ? <X className="size-4" strokeWidth={3} /> : <Check className="size-4" strokeWidth={3} />}
        </span>
        <p className="min-w-0 flex-1 text-sm text-[#3a3a3a]">{shown.text}</p>
        <span className={`relative grid size-8 shrink-0 place-items-center ${tone.ink}`} aria-label={`Còn ${seconds} giây`}>
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
            <circle cx="18" cy="18" r={RING_R} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
            <circle
              cx="18"
              cy="18"
              r={RING_R}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - ratio)}
            />
          </svg>
          <span className="text-[11px] font-bold tabular-nums">{seconds}</span>
        </span>
        <button type="button" className="shrink-0 text-[#8a8a8a] transition hover:text-[#3a3a3a]" aria-label="Đóng" onClick={close}>
          <X className="size-4" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
