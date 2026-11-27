import { useEffect, type ReactNode } from 'react'

/** Minimal accessible modal: backdrop click / Esc close, focus stays in the dialog via autofocus on content. */
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
  useEffect(() => {
    if (!dismissible) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, dismissible])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full rounded-2xl border border-gold/40 bg-cream p-6 shadow-[0_20px_60px_rgba(30,51,60,0.25)] ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <h2 className="serif text-2xl">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
