import { cn } from '@/lib/cn'
import { Maximize2, Minus, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type TouchEvent, type WheelEvent } from 'react'
import { createPortal } from 'react-dom'

const STEPS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const
const MIN = STEPS[0]
const MAX = STEPS[STEPS.length - 1]

function stepFrom(scale: number, dir: 1 | -1): number {
  if (dir > 0) return STEPS.find((s) => s > scale + 0.01) ?? MAX
  return [...STEPS].reverse().find((s) => s < scale - 0.01) ?? MIN
}

function clamp(n: number) {
  return Math.min(MAX, Math.max(MIN, n))
}

export function TextZoomBar({ scale, onChange }: { scale: number; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[13px] font-semibold tracking-wide text-ink-soft uppercase">Cỡ chữ</span>
      <ToolBtn label="Chữ nhỏ hơn" onClick={() => onChange(stepFrom(scale, -1))} disabled={scale <= MIN}>
        <Minus className="size-3.5" />
      </ToolBtn>
      <button
        type="button"
        onClick={() => onChange(1)}
        className="min-h-10 min-w-12 rounded-full bg-paper px-2 py-1 text-xs font-semibold text-gold-deep transition hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 sm:min-h-8"
        title="Về 100%"
      >
        {Math.round(scale * 100)}%
      </button>
      <ToolBtn label="Chữ to hơn" onClick={() => onChange(stepFrom(scale, 1))} disabled={scale >= MAX}>
        <Plus className="size-3.5" />
      </ToolBtn>
    </div>
  )
}

export function examTextStyle(scale: number): CSSProperties {
  return { '--exam-scale': String(scale) } as CSSProperties
}

/** Exam figure. Both fits fill the column and keep the picture's own height. */
export function ZoomableImage({ src, alt, fit = 'frame' }: { src: string; alt: string; fit?: 'frame' | 'listening' }) {
  const [scale, setScale] = useState(1)
  const [open, setOpen] = useState(false)
  const fitted = scale <= 1
  const listening = fit === 'listening'

  return (
    <div
      className={cn('exam-figure w-full min-w-0 space-y-2', listening && 'exam-listen-fit', listening && !fitted && 'is-zoomed')}
      style={listening ? ({ '--fig-zoom': String(scale) } as CSSProperties) : undefined}
    >
      <ZoomToolbar
        scale={scale}
        onZoomOut={() => setScale((s) => stepFrom(s, -1))}
        onZoomIn={() => setScale((s) => stepFrom(s, 1))}
        onReset={() => setScale(1)}
        onExpand={() => setOpen(true)}
      />
      <div className={cn('w-full min-w-0 rounded-2xl border border-ink/12 bg-cream', fitted ? 'overflow-hidden' : 'overflow-auto')}>
        <button
          type="button"
          className="block w-full max-w-full cursor-zoom-in rounded-2xl p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
          onClick={() => setOpen(true)}
          aria-label={`${alt} — mở phóng to`}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            loading="lazy"
            className="mx-auto block h-auto bg-[#ffffff]"
            style={listening && fitted ? undefined : { width: `${scale * 100}%`, maxWidth: fitted ? '100%' : 'none' }}
          />
        </button>
      </div>
      {open ? <ZoomLightbox src={src} alt={alt} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

function ZoomToolbar({
  scale,
  onZoomOut,
  onZoomIn,
  onReset,
  onExpand,
  onDark = false,
}: {
  scale: number
  onZoomOut: () => void
  onZoomIn: () => void
  onReset: () => void
  onExpand?: () => void
  onDark?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn('mr-1 text-[13px] font-semibold tracking-wide uppercase', onDark ? 'text-white/90' : 'text-ink-soft')}>
        Zoom đề
      </span>
      <ToolBtn label="Thu nhỏ" onClick={onZoomOut} disabled={scale <= MIN} onDark={onDark}>
        <Minus className="size-3.5" />
      </ToolBtn>
      <button
        type="button"
        onClick={onReset}
        className={cn(
          'min-h-10 min-w-12 rounded-full px-2 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 sm:min-h-8',
          onDark
            ? 'bg-white/15 text-white hover:bg-white/25 focus-visible:ring-white/80'
            : 'bg-paper text-gold-deep hover:bg-paper-2 focus-visible:ring-button/50',
        )}
        title="Về 100%"
      >
        {Math.round(scale * 100)}%
      </button>
      <ToolBtn label="Phóng to" onClick={onZoomIn} disabled={scale >= MAX} onDark={onDark}>
        <Plus className="size-3.5" />
      </ToolBtn>
      {onExpand ? (
        <ToolBtn label="Xem toàn màn hình" onClick={onExpand} onDark={onDark}>
          <Maximize2 className="size-3.5" />
        </ToolBtn>
      ) : null}
    </div>
  )
}

function ToolBtn({
  label,
  onClick,
  disabled,
  onDark = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  onDark?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-10 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 sm:size-8',
        onDark
          ? 'border-white/25 bg-white/15 text-white hover:bg-white/25 focus-visible:ring-white/80'
          : 'border-ink/15 bg-cream text-ink hover:bg-paper-2 focus-visible:ring-button/50',
      )}
    >
      {children}
    </button>
  )
}

function ZoomLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const pinch = useRef<{ dist: number; scale: number } | null>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setScale((s) => stepFrom(s, 1))
      if (e.key === '-' || e.key === '_') setScale((s) => stepFrom(s, -1))
      if (e.key === '0') {
        setScale(1)
        setPos({ x: 0, y: 0 })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault()
    setScale((s) => clamp(s + (e.deltaY < 0 ? 0.15 : -0.15)))
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    setPos({
      x: drag.current.x + (e.clientX - drag.current.px),
      y: drag.current.y + (e.clientY - drag.current.py),
    })
  }

  function onPointerUp() {
    drag.current = null
    pinch.current = null
  }

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      drag.current = null
      pinch.current = { dist: touchDist(e), scale }
    }
  }

  function onTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault()
      setScale(clamp(pinch.current.scale * (touchDist(e) / pinch.current.dist)))
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/92" role="dialog" aria-modal="true" aria-label={`Phóng to: ${alt}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-white">
        <ZoomToolbar
          scale={scale}
          onDark
          onZoomOut={() => setScale((s) => stepFrom(s, -1))}
          onZoomIn={() => setScale((s) => stepFrom(s, 1))}
          onReset={() => {
            setScale(1)
            setPos({ x: 0, y: 0 })
          }}
        />
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <X className="size-4" /> Đóng
        </button>
      </div>
      <div
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onDoubleClick={() => {
          setScale((s) => (s > 1.05 ? 1 : 2))
          setPos({ x: 0, y: 0 })
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="pointer-events-none absolute top-1/2 left-1/2 max-h-[88vh] max-w-[96vw] origin-center object-contain select-none"
          style={{ transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})` }}
        />
      </div>
      <p className="px-4 pb-3 text-center text-[13px] text-white/80">Lăn chuột hoặc chụm ngón để zoom • Kéo để xem • Esc để đóng</p>
    </div>
    ,
    document.body,
  )
}

function touchDist(e: TouchEvent) {
  const a = e.touches[0]
  const b = e.touches[1]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}
