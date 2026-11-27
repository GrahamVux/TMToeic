import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useAdminBugReports, useUpdateBugReport } from '@/features/bugs/bugs.queries'
import {
  BUG_REPORT_CATEGORY_LABEL,
  BUG_REPORT_STATUS_LABEL,
  BUG_REPORT_STATUSES,
  type BugReportStatus,
} from '@toeic/shared'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const dateFmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

const TONE: Record<BugReportStatus, 'gold' | 'warn' | 'olive' | 'paper'> = {
  OPEN: 'gold',
  IN_PROGRESS: 'warn',
  RESOLVED: 'olive',
  CLOSED: 'paper',
}

export function BugReportsPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<BugReportStatus | ''>('OPEN')
  const [page, setPage] = useState(1)
  const list = useAdminBugReports(status, page)
  const update = useUpdateBugReport()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)

  if (user?.role !== 'ADMIN') {
    return (
      <Card className="p-6">
        <h1 className="serif text-2xl">Báo lỗi từ học viên</h1>
        <p className="mt-2 text-sm text-ink/60">Chỉ quản trị viên mới xem và xử lý các báo lỗi này.</p>
      </Card>
    )
  }

  if (list.isError) return <QueryErrorRedirect error={list.error} />

  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 20))
  const chips: Array<{ id: BugReportStatus | ''; label: string }> = [
    { id: '', label: 'Tất cả' },
    ...BUG_REPORT_STATUSES.map((s) => ({ id: s, label: BUG_REPORT_STATUS_LABEL[s] })),
  ]

  async function setStatusOf(id: string, next: BugReportStatus) {
    setErr(null)
    try {
      await update.mutateAsync({ id, status: next, adminNote: notes[id] ?? '' })
    } catch {
      setErr('Không cập nhật được báo lỗi. Thử lại.')
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="serif text-3xl sm:text-4xl">Báo lỗi từ học viên</h1>
        <p className="mt-2 text-sm text-ink/60">
          Học viên gửi từ nút góc phải dưới. {list.data ? `${list.data.openCount} báo cáo chưa xử lý.` : null}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id || 'all'}
            type="button"
            onClick={() => {
              setStatus(c.id)
              setPage(1)
            }}
            className={
              status === c.id
                ? 'rounded-full bg-button px-3 py-1.5 text-xs font-semibold text-button-ink'
                : 'rounded-full border border-gold/40 bg-cream px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-teal-soft'
            }
          >
            {c.label}
            {c.id === 'OPEN' && list.data ? ` (${list.data.openCount})` : ''}
          </button>
        ))}
      </div>

      {err ? (
        <p className="text-sm text-coral" role="alert">
          {err}
        </p>
      ) : null}

      {list.isPending ? <p className="text-sm text-ink-soft">Đang tải báo lỗi…</p> : null}

      {!list.isPending && (list.data?.items.length ?? 0) === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-ink/60">Chưa có báo lỗi nào trong mục này.</p>
        </Card>
      ) : null}

      <ul className="space-y-3">
        {(list.data?.items ?? []).map((item) => (
          <li key={item.id}>
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    <Link className="text-gold-deep hover:underline" to={`/admin/students/${item.reporter.id}`}>
                      {item.reporter.fullName}
                    </Link>
                    {item.reporter.studentCode ? <span className="ml-2 text-xs font-normal text-ink-soft">{item.reporter.studentCode}</span> : null}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {BUG_REPORT_CATEGORY_LABEL[item.category]} • {item.pagePath} • {dateFmt.format(new Date(item.createdAt))}
                  </p>
                </div>
                <Badge tone={TONE[item.status]}>{BUG_REPORT_STATUS_LABEL[item.status]}</Badge>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink/80">{item.message}</p>
              {item.resolvedByName ? (
                <p className="mt-2 text-xs text-ink-soft">
                  {BUG_REPORT_STATUS_LABEL[item.status]} bởi {item.resolvedByName}
                  {item.resolvedAt ? ` • ${dateFmt.format(new Date(item.resolvedAt))}` : ''}
                </p>
              ) : null}
              <label className="mt-4 block text-xs font-medium text-ink/60">
                Ghi chú phản hồi (học viên sẽ thấy)
                <textarea
                  className="mt-1 min-h-16 w-full rounded-xl border border-gold/40 bg-cream px-3 py-2 text-sm outline-none focus:border-button"
                  value={notes[item.id] ?? item.adminNote ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                  placeholder="Đã sửa / cần thêm thông tin…"
                />
              </label>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {item.status === 'OPEN' ? (
                  <Button variant="paper" disabled={update.isPending} onClick={() => void setStatusOf(item.id, 'IN_PROGRESS')}>
                    Đang xử lý
                  </Button>
                ) : null}
                {item.status !== 'RESOLVED' ? (
                  <Button disabled={update.isPending} onClick={() => void setStatusOf(item.id, 'RESOLVED')}>
                    Đã sửa
                  </Button>
                ) : null}
                {item.status !== 'CLOSED' ? (
                  <Button variant="ghost" disabled={update.isPending} onClick={() => void setStatusOf(item.id, 'CLOSED')}>
                    Đóng
                  </Button>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {pages > 1 ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Trước
          </Button>
          <Button variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Sau
          </Button>
        </div>
      ) : null}
    </div>
  )
}
