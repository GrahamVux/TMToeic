import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/practice/listening', title: 'Luyện Listening', meta: 'Bài ngắn • Part 1–4' },
  { to: '/practice/reading', title: 'Luyện Reading', meta: 'Bài ngắn • Part 5–7' },
  { to: '/practice', title: 'Đề tổng hợp', meta: 'Full test • Tính giờ' },
]

export function PracticeTabs() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            cn(
              'min-w-[11.5rem] shrink-0 rounded-2xl px-4 py-3 text-left',
              isActive ? 'bg-button text-button-ink shadow-[0_8px_20px_color-mix(in_srgb,var(--color-button)_35%,transparent)]' : 'border border-ink/12 bg-cream text-ink hover:border-button',
            )
          }
        >
          <span className="block text-sm font-semibold">{tab.title}</span>
          <span className={cn('mt-0.5 block text-xs', 'opacity-75')}>{tab.meta}</span>
        </NavLink>
      ))}
    </div>
  )
}

export function FilterChip({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-full px-3 py-1.5 text-sm font-semibold',
        active ? 'bg-button text-button-ink' : 'border border-ink/12 bg-cream text-ink-soft hover:border-gold-deep hover:text-ink',
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
