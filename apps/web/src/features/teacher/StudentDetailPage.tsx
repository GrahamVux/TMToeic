import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { partName } from '@/features/exams/exams.queries'
import { AttemptsTable, PartBreakdown, ScoreTrend } from '@/features/progress/ProgressParts'
import { useStudentProgress } from '@/features/progress/progress.queries'
import { ApiError } from '@/lib/api'
import { Link, useParams } from 'react-router-dom'
import { AccountActions } from './StudentDialogs'
import { useUser } from './users.queries'

const dateFmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })

export function StudentDetailPage() {
  const { studentId } = useParams()
  const { data: user, isPending, error, refetch } = useUser(studentId)
  const progress = useStudentProgress(studentId)
  const p = progress.data

  if (isPending) return <p className="py-16 text-center text-ink/55" role="status">Đang tải hồ sơ…</p>
  if (error || !user) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-coral">{notFound ? 'Không tìm thấy học viên.' : 'Không tải được hồ sơ học viên.'}</p>
        <div className="flex justify-center gap-3">
          <Link to="/admin"><Button variant="paper">← Danh sách học viên</Button></Link>
          {!notFound && <Button variant="paper" onClick={() => void refetch()}>Thử lại</Button>}
        </div>
      </div>
    )
  }

  const target = user.targetScore
  return (
    <div className="space-y-6">
      <Link to="/admin" className="text-sm text-gold-deep">
        ← Quay lại danh sách học viên
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Hồ sơ học viên nội bộ</p>
          <h1 className="serif mt-2 text-4xl">{user.fullName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/60">
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
          <Info label="Điểm mục tiêu" value={target?.toString()} />
          <Info label="Ngày tạo" value={dateFmt.format(new Date(user.createdAt))} />
          <Info label="Đăng nhập gần nhất" value={user.lastLoginAt ? dateFmt.format(new Date(user.lastLoginAt)) : 'Chưa đăng nhập'} />
          <Info label="Làm bài gần nhất" value={p ? (p.lastActivityAt ? dateFmt.format(new Date(p.lastActivityAt)) : 'Chưa làm bài') : undefined} />
        </dl>
      </Card>

      <h2 className="serif text-2xl">Phân tích điểm số</h2>

      {progress.isPending ? <p className="text-sm text-ink/55">Đang tải số liệu…</p> : null}
      {progress.error ? (
        <div className="rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">
          {progress.error instanceof ApiError ? progress.error.message : 'Không tải được số liệu học tập.'}
          <Button className="ml-3" variant="paper" onClick={() => void progress.refetch()}>Thử lại</Button>
        </div>
      ) : null}

      {p ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs text-ink/50">Điểm gần nhất</p>
              <p className="serif mt-2 text-4xl">{p.latestScore?.totalScore ?? '—'}</p>
              <p className="mt-1 text-sm text-gold-deep">
                {p.improvement === null ? (p.latestScore ? 'Mới có 1 bài' : 'Chưa có bài đủ 200 câu') : `${p.improvement >= 0 ? '+' : ''}${p.improvement} điểm so với lần đầu`}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-ink/50">Hoạt động</p>
              <p className="serif mt-2 text-4xl">{p.totals.attemptsFinished}<span className="text-lg text-ink/40"> bài</span></p>
              <p className="mt-1 text-xs text-ink/50">
                {p.totals.answered} câu • {p.totals.accuracy === null ? 'chưa có tỷ lệ đúng' : `${p.totals.accuracy}% đúng`} • chuỗi {p.streak.days} ngày
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-ink/50">Điểm yếu</p>
              <p className="mt-3 text-sm leading-6">
                {p.weakestPart ? `${partName(p.weakestPart.partCode)} — ${p.weakestPart.accuracy}% đúng (${p.weakestPart.answered} câu)` : 'Chưa đủ dữ liệu'}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-ink/50">{target !== null ? `So với mục tiêu ${target}` : 'Mục tiêu'}</p>
              <p className="serif mt-2 text-4xl">{p.remainingToTarget ?? '—'}</p>
              <p className="mt-1 text-xs text-ink/50">
                {target === null ? 'Học viên chưa đặt mục tiêu' : p.latestScore ? 'điểm còn lại' : 'chưa có điểm để so sánh'}
              </p>
            </Card>
          </div>

          <ScoreTrend history={p.scoreHistory} target={target} />
          <PartBreakdown parts={p.parts} />

          <section>
            <h3 className="serif text-2xl">Bài làm gần đây</h3>
            <div className="mt-3"><AttemptsTable attempts={p.recentAttempts} reviewLinks={false} /></div>
          </section>
        </>
      ) : null}
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-ink/50">{label}</dt>
      <dd className="mt-1 font-medium">{value || '—'}</dd>
    </div>
  )
}
