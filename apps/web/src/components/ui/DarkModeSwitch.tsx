import { cn } from '@/lib/cn'
import { Moon, Sun } from 'lucide-react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { resolveSwitchPalette, switchPaletteVars, type SwitchThemeOverride } from './dark-mode-switch.palette'

export type DarkModeSwitchVariant = 'icon' | 'compact' | 'labeled'

/** Theme-adaptive Light/Dark toggle aligned with the site palette (`--sw-*` tokens). */
export function DarkModeSwitch({
  checked,
  onToggle,
  variant = 'compact',
  className,
  label = 'Chuyển chế độ Sáng / Tối',
  themeOverride,
}: {
  checked: boolean
  onToggle: () => void
  variant?: DarkModeSwitchVariant
  className?: string
  label?: string
  themeOverride?: SwitchThemeOverride
}) {
  const override = themeOverride ? resolveSwitchPalette(themeOverride) : null
  const switchStyle = override ? (switchPaletteVars(override.palette) as CSSProperties) : undefined
  const title = checked ? 'Đang bật chế độ Tối — nhấn để chuyển Sáng' : 'Đang bật chế độ Sáng — nhấn để chuyển Tối'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        title={title}
        data-switch-theme={override?.themeKey}
        style={switchStyle}
        onClick={onToggle}
        className={cn('theme-sw theme-sw-icon', className)}
      >
        <Sun className="theme-sw-sun size-[18px]" strokeWidth={2} aria-hidden="true" />
        <Moon className="theme-sw-moon size-[18px]" strokeWidth={2} aria-hidden="true" />
      </button>
    )
  }

  if (variant === 'labeled') {
    function onGroupKeyDown(e: KeyboardEvent<HTMLDivElement>) {
      if (e.key === 'ArrowRight' && !checked) {
        e.preventDefault()
        onToggle()
      } else if (e.key === 'ArrowLeft' && checked) {
        e.preventDefault()
        onToggle()
      }
    }

    return (
      <div
        role="radiogroup"
        aria-label={label}
        data-checked={checked ? 'true' : 'false'}
        data-switch-theme={override?.themeKey}
        style={switchStyle}
        onKeyDown={onGroupKeyDown}
        className={cn('theme-sw theme-sw-labeled', className)}
      >
        <span className="theme-sw-thumb" aria-hidden="true" />
        <button
          type="button"
          role="radio"
          aria-checked={!checked}
          onClick={() => {
            if (checked) onToggle()
          }}
          className={cn('theme-sw-opt', !checked && 'is-active')}
        >
          <Sun className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>Sáng</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={checked}
          onClick={() => {
            if (!checked) onToggle()
          }}
          className={cn('theme-sw-opt', checked && 'is-active')}
        >
          <Moon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>Tối</span>
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      data-switch-theme={override?.themeKey}
      style={switchStyle}
      onClick={onToggle}
      className={cn('theme-sw theme-sw-compact', className)}
    >
      <span className="theme-sw-thumb" aria-hidden="true" />
      <span className={cn('theme-sw-slot', !checked && 'is-active')} aria-hidden="true">
        <Sun className="size-4" strokeWidth={2} />
      </span>
      <span className={cn('theme-sw-slot', checked && 'is-active')} aria-hidden="true">
        <Moon className="size-4" strokeWidth={2} />
      </span>
    </button>
  )
}
