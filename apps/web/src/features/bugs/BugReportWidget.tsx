import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Primitives'
import { cn } from '@/lib/cn'
import { ApiError } from '@/lib/api'
import {
  BUG_REPORT_CATEGORIES,
  BUG_REPORT_CATEGORY_LABEL,
  BUG_REPORT_STATUS_LABEL,
  type BugReportCategory,
  type BugReportStatus,
} from '@toeic/shared'
import { Bug, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCreateBugReport, useMyBugReports } from './bugs.queries'

const STATUS_TONE: Record<BugReportStatus, 'gold' | 'warn' | 'olive' | 'paper'> = {
  OPEN: 'gold',
  IN_PROGRESS: 'warn',
  RESOLVED: 'olive',
  CLOSED: 'paper',
}

export function BugReportWidget() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<BugReportCategory>('OTHER')
  const [message, setMessage] = useState('')
  const mine = useMyBugReports(open)
  const send = useCreateBugReport()
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  async function submit() {
    setSent(false)
    try {
      await send.mutateAsync({
        category,
        message,
        pagePath: `${location.pathname}${location.search}${location.hash}`.slice(0, 300) || '/',
      })
      setMessage('')
      setSent(true)
      window.setTimeout(() => setSent(false), 4000)
    } catch {
      // error text from send.error
    }
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open ? (
        <section
          className="pointer-events-auto w-[min(22.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gold/40 bg-cream shadow-[0_16px_50px_rgba(30,51,60,0.22)]"
          role="dialog"
          aria-label="Báo lỗi cho quản trị viên"
        >
          <div className="flex items-start justify-between gap-3 border-b border-gold/25 bg-cream px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Báo lỗi</p>
              <p className="mt-0.5 text-xs text-ink-soft">Gửi sự cố tới tài khoản quản trị để được xử lý.</p>
            </div>
            <button
              type="button"
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
              aria-label="Đóng"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-[min(70vh,32rem)] space-y-3 overflow-y-auto p-4">
            <label className="block text-xs font-medium text-ink-soft">
              Nhóm sự cố
              <select
                className="mt-1 h-10 w-full rounded-xl border border-gold/40 bg-cream px-3 text-sm text-ink outline-none focus:border-button focus:ring-2 focus:ring-button/30"
                value={category}
                onChange={(e) => setCategory(e.target.value as BugReportCategory)}
              >
                {BUG_REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {BUG_REPORT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-ink-soft">
              Mô tả
              <textarea
                className="mt-1 min-h-24 w-full rounded-xl border border-gold/40 bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-button focus:ring-2 focus:ring-button/30"
                value={message}
                maxLength={2000}
                placeholder="Ví dụ: Không nghe được audio Part 3 trên trang luyện tập…"
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <p className="text-[13px] text-ink-soft">Trang hiện tại: {location.pathname || '/'}</p>
            {send.error ? (
              <p className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
                {send.error instanceof ApiError ? send.error.message : 'Không gửi được. Thử lại sau.'}
              </p>
            ) : null}
            {sent ? <p className="text-sm text-olive">Đã gửi. Quản trị viên sẽ xem sớm.</p> : null}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-soft tabular-nums">
                Tối thiểu 10 ký tự ({Math.min(10, message.trim().length)}/10)
              </p>
              <Button disabled={send.isPending || message.trim().length < 10} onClick={() => void submit()}>
                {send.isPending ? 'Đang gửi…' : 'Gửi báo lỗi'}
              </Button>
            </div>
            {mine.isPending ? (
              <div className="border-t border-gold/20 pt-3">
                <p className="text-xs text-ink-soft">Đang tải báo cáo gần đây…</p>
              </div>
            ) : mine.isError ? (
              <div className="border-t border-gold/20 pt-3">
                <p className="text-xs text-danger" role="alert">Không tải được lịch sử báo lỗi.</p>
              </div>
            ) : mine.data?.items.length ? (
              <div className="border-t border-gold/20 pt-3">
                <p className="text-xs font-semibold text-ink-soft">Báo cáo gần đây</p>
                <ul className="mt-2 space-y-2">
                  {mine.data.items.slice(0, 5).map((item) => (
                    <li key={item.id} className="rounded-xl bg-paper px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-ink">{BUG_REPORT_CATEGORY_LABEL[item.category]}</p>
                        <Badge tone={STATUS_TONE[item.status]}>{BUG_REPORT_STATUS_LABEL[item.status]}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{item.message}</p>
                      {item.adminNote ? <p className="mt-1 text-xs text-olive">Phản hồi: {item.adminNote}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      <button
        type="button"
        className={cn(
          'pointer-events-auto flex items-center gap-2 rounded-full bg-button px-4 py-3 text-sm font-semibold text-button-ink shadow-[0_10px_28px_rgba(31,122,140,0.35)] transition hover:bg-button-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 focus-visible:ring-offset-2',
          open && 'ring-2 ring-white/70',
        )}
        aria-expanded={open}
        aria-label="Báo lỗi cho quản trị viên"
        onClick={() => setOpen((v) => !v)}
      >
        <Bug className="size-4" />
        Báo lỗi
      </button>
    </div>
  )
}
