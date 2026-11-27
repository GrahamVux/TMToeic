import { cn } from '@/lib/cn'
import type { InputHTMLAttributes, ReactNode } from 'react'

export function Badge({
  children,
  tone = 'gold',
  className,
}: {
  children: ReactNode
  tone?: 'gold' | 'teal' | 'warn' | 'danger' | 'ink' | 'olive' | 'paper'
  className?: string
}) {
  const tones = {
    gold: 'bg-button-soft text-ink border-button/40',
    teal: 'bg-teal-soft text-teal border-teal/20',
    warn: 'bg-warn-soft text-warn border-warn/25',
    danger: 'bg-danger-soft text-danger border-danger/25',
    ink: 'bg-button text-button-ink border-gold-deep',
    olive: 'bg-success-soft text-olive border-olive/25',
    paper: 'bg-paper-2 text-ink-soft border-gold/40',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] font-semibold uppercase tracking-wide', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn('ui-card rounded-2xl border border-gold/35 bg-cream shadow-[0_12px_40px_rgba(15,23,42,0.06)]', className)}>{children}</section>
}

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const safe = Number.isFinite(value) ? value : 0
  const clamped = Math.round(Math.min(100, Math.max(0, safe)))
  return (
    <div
      role="progressbar"
      aria-label={label ?? 'Tiến độ'}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 overflow-hidden rounded-full bg-paper-2', className)}
    >
      <div className="h-full rounded-full bg-linear-to-r from-gold-deep to-gold" style={{ width: `${clamped}%` }} />
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-xl border border-ink/15 bg-cream px-3 text-base text-ink outline-none ring-button/40 placeholder:text-ink/60 focus:border-button focus:ring-2',
        className,
      )}
      {...props}
    />
  )
}
