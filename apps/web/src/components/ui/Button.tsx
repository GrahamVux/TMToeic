import { cn } from '@/lib/cn'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'gold' | 'navy' | 'ghost' | 'paper' | 'danger' | 'teal'

const styles: Record<ButtonVariant, string> = {
  gold: 'bg-button text-button-ink hover:bg-button-hover',
  navy: 'border border-ink/15 bg-cream text-ink hover:bg-paper-2',
  ghost: 'border border-ink/15 bg-transparent text-ink hover:bg-paper-2',
  paper: 'border border-gold/45 bg-paper-2 text-ink hover:bg-button-soft',
  danger: 'bg-danger-fill text-white hover:opacity-90',
  teal: 'bg-banner text-banner-ink hover:opacity-90',
}

export function buttonClasses(variant: ButtonVariant = 'gold', className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold tracking-tight transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50',
    styles[variant],
    className,
  )
}

export function Button({
  className,
  variant = 'gold',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; children: ReactNode }) {
  return (
    <button className={buttonClasses(variant, className)} {...props}>
      {children}
    </button>
  )
}
