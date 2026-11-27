import { useAssignments } from '@/features/assignments/assignments.queries'
import { useStudyOverview } from '@/features/study/study.queries'
import { cn } from '@/lib/cn'
import { DEFAULT_NOTIFY_PREFS, useNotifyPrefs, type NotifyPrefs } from '@/lib/notify-prefs'
import type { AssignmentDto, StudyOverviewDto } from '@toeic/shared'
import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

const DAY_MS = 24 * 60 * 60 * 1000

type Reminder = {
  id: string
  title: string
  body: string
  to: string
  urgent: boolean
}

function dueLabel(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

export function remindersOf(
  assignments: AssignmentDto[] | undefined,
  study: StudyOverviewDto | undefined,
  now = Date.now(),
  prefs: NotifyPrefs = DEFAULT_NOTIFY_PREFS,
): Reminder[] {
  const items: Reminder[] = []
  for (const assignment of assignments ?? []) {
    if (assignment.status !== 'PUBLISHED') continue
    const mine = assignment.myProgress?.status
    if (!mine || mine === 'COMPLETED') continue
    const due = assignment.dueAt ? new Date(assignment.dueAt).getTime() : null
    if (mine === 'OVERDUE') {
      if (prefs.overdue) {
        items.push({
          id: `asg-${assignment.id}`,
          title: assignment.title,
          body: due ? `Đã quá hạn từ ${dueLabel(assignment.dueAt!)}` : 'Đã quá hạn nộp',
          to: '/assignments',
          urgent: true,
        })
      }
      continue
    }
    if (due !== null && due - now <= DAY_MS) {
      if (prefs.dueSoon) {
        items.push({
          id: `asg-${assignment.id}`,
          title: assignment.title,
          body: `Sắp đến hạn ${dueLabel(assignment.dueAt!)}`,
          to: '/assignments',
          urgent: true,
        })
      } else if (mine === 'IN_PROGRESS' && prefs.inProgress) {
        items.push({
          id: `asg-${assignment.id}`,
          title: assignment.title,
          body: 'Bài đang làm dở',
          to: '/assignments',
          urgent: false,
        })
      }
      continue
    }
    if (mine === 'IN_PROGRESS' && prefs.inProgress) {
      items.push({
        id: `asg-${assignment.id}`,
        title: assignment.title,
        body: 'Bài đang làm dở',
        to: '/assignments',
        urgent: false,
      })
    }
  }
  if (prefs.vocab && (study?.catalogDue ?? 0) > 0) {
    items.push({
      id: 'catalog-due',
      title: 'Ôn từ vựng',
      body: `${study!.catalogDue} thẻ đến hạn`,
      to: '/study/flashcards?deck=catalog',
      urgent: false,
    })
  }
  if (prefs.vocab && (study?.notebookDue ?? 0) > 0) {
    items.push({
      id: 'notebook-due',
      title: 'Sổ tay từ vựng',
      body: `${study!.notebookDue} thẻ cần ôn`,
      to: '/study/flashcards?deck=notebook',
      urgent: false,
    })
  }
  return items
}

export function NotificationBell() {
  const assignments = useAssignments()
  const study = useStudyOverview()
  const [prefs] = useNotifyPrefs()
  const items = remindersOf(assignments.data, study.data, Date.now(), prefs)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const mobilePanelRef = useRef<HTMLDivElement>(null)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : true,
  )
  const count = items.length

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 640px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    function onDown(event: MouseEvent) {
      const target = event.target as Node
      if (wrapRef.current?.contains(target) || mobilePanelRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const popover = (
    <div
      ref={isDesktop ? undefined : mobilePanelRef}
      className={cn(
        'rounded-2xl border border-gold/40 bg-cream p-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)]',
        isDesktop ? 'absolute top-full right-0 z-40 mt-2 w-80' : 'fixed inset-x-3 top-[4.5rem] z-50 w-auto',
      )}
      role="dialog"
      aria-label="Nhắc nhở"
    >
      <p className="px-1 text-sm font-semibold text-ink">Nhắc nhở</p>
      {(assignments.isPending || study.isPending) && count === 0 ? (
        <p className="px-1 py-3 text-sm text-ink-soft">Đang tải nhắc nhở…</p>
      ) : (assignments.isError || study.isError) && count === 0 ? (
        <div className="px-1 py-3 text-sm text-danger">
          Không tải được nhắc nhở.{' '}
          <button
            type="button"
            className="rounded font-semibold underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
            onClick={() => {
              void assignments.refetch()
              void study.refetch()
            }}
          >
            Thử lại
          </button>
        </div>
      ) : count === 0 ? (
        <p className="px-1 py-3 text-sm text-ink-soft">Hiện chưa có nhắc nhở.</p>
      ) : null}
      <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                'block rounded-xl px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                item.urgent ? 'bg-danger-soft hover:bg-danger-soft/80' : 'bg-paper hover:bg-paper-2',
              )}
            >
              <p className="break-words text-sm font-semibold text-ink">{item.title}</p>
              <p className="break-words text-xs text-ink-soft">{item.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div ref={wrapRef} className="relative">
      <button
        className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-cream text-ink-soft transition hover:border-gold-deep hover:text-gold-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
        type="button"
        aria-label={count > 0 ? `Thông báo, ${count} nhắc nhở` : 'Thông báo'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-crimson-fill px-1 text-[12px] leading-[18px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>
      {open ? (isDesktop || typeof document === 'undefined' ? popover : createPortal(popover, document.body)) : null}
    </div>
  )
}
