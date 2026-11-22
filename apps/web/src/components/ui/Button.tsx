import { cn } from '@/lib/cn'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'gold' | 'navy' | 'ghost' | 'paper' | 'danger' | 'teal'

const styles: Record<Variant, string> = {
  gold: 'bg-button text-button-ink hover:bg-button-hover',
  navy: 'border border-ink/12 bg-white text-ink hover:bg-paper-2',
  ghost: 'bg-transparent text-ink border border-ink/12 hover:bg-paper-2',
  paper: 'bg-paper-2 text-ink border border-gold/40 hover:bg-gold/50',
  danger: 'bg-coral text-white hover:opacity-90',
  teal: 'bg-teal text-white hover:opacity-90',
}

export function Button({
  className,
  variant = 'gold',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold tracking-tight transition disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
