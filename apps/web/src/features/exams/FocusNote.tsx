import { Badge, Card } from '@/components/ui/Primitives'
import type { FocusReportDto } from '@toeic/shared'
import { formatClock } from './exams.queries'

const timeFmt = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Ho_Chi_Minh',
})

/** Teacher-only tally of tab leaves. Students are not shown this count. */
export function FocusNote({ focus }: { focus: FocusReportDto | null }) {
  if (!focus) return null

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="serif text-2xl">Rời màn hình</h2>
        {focus.leaveCount > 0 ? <Badge tone="warn">{focus.leaveCount} lần</Badge> : <Badge tone="paper">Không ghi nhận</Badge>}
      </div>
      {focus.leaveCount === 0 ? (
        <p className="mt-2 text-sm text-ink/70">Không ghi nhận lần rời tab hay chuyển cửa sổ trong bài này.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink/75">
            Học viên rời tab hoặc chuyển sang cửa sổ khác {focus.leaveCount} lần, tổng {formatClock(focus.awaySeconds)}. Lần dài nhất {formatClock(focus.longestAwaySeconds)}.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-ink/70">
            {focus.leaves.map((leave) => (
              <li key={leave.leftAt}>
                {timeFmt.format(new Date(leave.leftAt))} · vắng {formatClock(leave.awaySeconds)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">Dấu hiệu cần xem cùng bài làm.</p>
        </>
      )}
    </Card>
  )
}
