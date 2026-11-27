import { Button } from '@/components/ui/Button'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Badge, Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { partName } from '@/features/exams/exams.queries'
import { AttemptsTable, PartBreakdown, ScoreTrend } from '@/features/progress/ProgressParts'
import { useStudentAttempts, useStudentProgress } from '@/features/progress/progress.queries'
import { formatGoal } from '@toeic/shared'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AccountActions } from './StudentDialogs'
import { useUser } from './users.queries'
import { useEffect } from 'react'

const dateFmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })

export function StudentDetailPage() {
  const { studentId } = useParams()
  const location = useLocation()
  const { data: user, isPending, error } = useUser(studentId)
  const progress = useStudentProgress(studentId)
  const sittings = useStudentAttempts(studentId)
  const p = progress.data

  useEffect(() => {
    if (location.hash !== '#bai-lam') return
    document.getElementById('bai-lam')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, sittings.data])

  if (isPending) return <PageLoading message="Đang tải hồ sơ…" />
  if (error || !user) return <QueryErrorRedirect error={error} />

  const target = user.goal
  return (
    <div className="space-y-6">
      <Link to="/admin" className="inline-block rounded-lg text-sm text-gold-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50">
        ← Quay lại danh sách học viên
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">Hồ sơ học viên nội bộ</p>
          <h1 className="serif mt-2 flex items-center gap-3 text-4xl">
            <AccountAvatar name={user.fullName} url={user.avatarUrl} frameId={user.avatarFrame} className="size-12 font-sans text-base" />
            {user.fullName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <span>{user.studentCode ?? user.username}</span>
            {user.status === 'DISABLED' ? <Badge tone="danger">Đã khóa</Badge> : user.mustChangePassword ? <Badge tone="warn">Chờ đăng nhập lần đầu</Badge> : <Badge tone="olive">Hoạt động</Badge>}
          </p>
        </div>
        <AccountActions user={user} />
      </div>

      <Card className="p-6">
        <h2 className="serif text-2xl">Thông tin tài khoản</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Email" value={user.email} />
          <Info label="Số điện thoại" value={user.phone} />
          <Info label="Điểm mục tiêu" value={formatGoal(target)} />
          <Info label="Điểm thưởng tích lũy" value={`${user.rewardPoints.toLocaleString('vi-VN')} điểm`} />
          <Info label="Ngày tạo" value={dateFmt.format(new Date(user.createdAt))} />
          <Info label="Đăng nhập gần nhất" value={user.lastLoginAt ? dateFmt.format(new Date(user.lastLoginAt)) : 'Chưa đăng nhập'} />
          <Info label="Làm bài gần nhất" value={p ? (p.lastActivityAt ? dateFmt.format(new Date(p.lastActivityAt)) : 'Chưa làm bài') : undefined} />
        </dl>
      </Card>

      <h2 className="serif text-2xl">Phân tích điểm số</h2>

      {progress.isPending ? <p className="text-sm text-ink-soft">Đang tải số liệu…</p> : null}
      {progress.error ? (
        <div className="rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger" role="alert">
          Không tải được số liệu học tập.
          <Button className="ml-3" variant="paper" onClick={() => void progress.refetch()}>Thử lại</Button>
        </div>
      ) : null}

      {p ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <Card className="p-5">
              <p className="text-xs text-ink-soft">Điểm gần nhất</p>
              <p className="serif mt-2 text-4xl tabular-nums">{p.latestScore?.totalScore ?? '—'}</p>
              <p className="mt-1 text-sm text-gold-deep">
                {p.improvement === null ? (p.latestScore ? 'Mới có 1 bài' : 'Chưa có bài đủ 200 câu') : `${p.improvement >= 0 ? '+' : ''}${p.improvement} điểm so với lần đầu`}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-ink-soft">Hoạt động</p>
              <p className="serif mt-2 text-4xl tabular-nums">{p.totals.attemptsFinished}<span className="text-lg text-ink-soft"> bài</span></p>
              <p className="mt-1 text-xs text-ink-soft tabular-nums">
                {p.totals.answered} câu • {p.totals.accuracy === null ? 'chưa có tỷ lệ đúng' : `${p.totals.accuracy}% đúng`} • chuỗi {p.streak.days} ngày
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-ink-soft">Điểm yếu</p>
              <p className="mt-3 text-sm leading-6">
                {p.weakestPart ? `${partName(p.weakestPart.partCode)} — ${p.weakestPart.accuracy}% đúng (${p.weakestPart.answered} câu)` : 'Chưa đủ dữ liệu'}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-ink-soft">{target ? `So với mục tiêu ${formatGoal(target)}` : 'Mục tiêu'}</p>
              <p className="serif mt-2 text-4xl tabular-nums">{p.remainingToTarget ?? '—'}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {!target ? 'Học viên chưa đặt mục tiêu' : target.track === 'FOUR_SKILL' ? 'Không so sánh với mock L&R' : p.latestScore ? 'điểm còn lại đến mục tiêu' : 'chưa có điểm để so sánh'}
              </p>
            </Card>
          </div>

          <ScoreTrend history={p.scoreHistory} target={target} />
          <PartBreakdown parts={p.parts} />
        </>
      ) : null}

      <section id="bai-lam">
        <h2 className="serif text-2xl">Kết quả & bài làm chi tiết</h2>
        <p className="mt-1 text-sm text-ink-soft">Mỗi lần nộp: điểm tổng, đúng/sai theo part, và từng câu học viên đã chọn.</p>
        {sittings.isPending ? <p className="mt-3 text-sm text-ink-soft">Đang tải bài làm…</p> : null}
        {sittings.error ? (
          <div className="mt-3 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger" role="alert">
            Không tải được danh sách bài làm.
            <Button className="ml-3" variant="paper" onClick={() => void sittings.refetch()}>Thử lại</Button>
          </div>
        ) : null}
        {!sittings.isPending && !sittings.error ? (
          <div className="mt-3">
            <AttemptsTable attempts={sittings.data ?? []} staffStudentId={user.id} />
          </div>
        ) : null}
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-1 font-medium">{value || '—'}</dd>
    </div>
  )
}
