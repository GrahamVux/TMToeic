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
    gold: 'bg-teal-soft text-gold-deep border-gold/50',
    teal: 'bg-teal-soft text-teal border-teal/20',
    warn: 'bg-[#f8e7c9] text-warn border-warn/20',
    danger: 'bg-[#f8dcd8] text-coral border-coral/20',
    ink: 'bg-gold-deep text-white border-gold-deep',
    olive: 'bg-[#e4efd8] text-olive border-olive/20',
    paper: 'bg-paper-2 text-ink/70 border-ink/10',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border border-gold/35 bg-cream shadow-[0_12px_40px_rgba(43,138,156,0.06)]', className)}>{children}</section>
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-paper-2', className)}>
      <div className="h-full rounded-full bg-linear-to-r from-gold-deep to-gold" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-xl border border-ink/12 bg-white px-3 text-base outline-none ring-gold/40 placeholder:text-ink/40 focus:ring-2',
        className,
      )}
      {...props}
    />
  )
}
