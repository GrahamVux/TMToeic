import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Accessible modal: backdrop click / Esc close, scroll-safe on mobile, focus trap & restoration. */
export function Modal({
  title,
  children,
  onClose,
  dismissible = true,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  dismissible?: boolean
  wide?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [previousFocus] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null,
  )
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)

  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  }, [onClose, dismissible])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) {
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(first ?? dialog).focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissibleRef.current) {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) {
        e.preventDefault()
        dialog.focus()
        return
      }
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previousFocus?.focus?.()
    }
  }, [previousFocus])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-2xl border border-gold/40 bg-cream p-6 shadow-[0_20px_60px_rgba(30,51,60,0.25)] focus:outline-none ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="serif min-w-0 flex-1 text-2xl">{title}</h2>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
