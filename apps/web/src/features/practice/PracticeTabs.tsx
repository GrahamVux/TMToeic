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
              isActive ? 'bg-gold-deep text-white shadow-[0_8px_20px_rgba(43,138,156,0.25)]' : 'border border-ink/10 bg-white text-ink hover:border-gold-deep',
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
        active ? 'bg-gold-deep text-white' : 'border border-ink/10 bg-white text-ink/75 hover:border-gold-deep',
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
