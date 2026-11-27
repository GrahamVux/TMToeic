import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useAssignments } from '@/features/assignments/assignments.queries'
import { FrameWardrobeModal } from '@/features/honor/FrameWardrobeModal'
import { DashboardHonorSummaryCard } from '@/features/honor/HonorBoards'
import { formatGoal, type GoalDto, type SkillStatDto, type StudentDashboardDto } from '@toeic/shared'
import { useState, type ReactNode } from 'react'
import { Flame } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { useStudyOverview } from '@/features/study/study.queries'
import { DailyGoalsCard } from './DailyGoalsCard'
import { useDashboard } from './dashboard.queries'

const dayMonth = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function chartGoalLines(goal: GoalDto) {
  if (goal?.track !== 'TWO_SKILL') return null
  return (
    <ReferenceLine
      y={goal.score}
      stroke="var(--color-crimson)"
      strokeDasharray="6 4"
      label={{ value: `Mục tiêu ${goal.score}`, fill: 'var(--color-crimson)', fontSize: 13, fontWeight: 600, position: 'insideTopLeft' }}
    />
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data, isPending, error } = useDashboard()
  const homework = useAssignments()
  const study = useStudyOverview()
  const [wardrobeTab, setWardrobeTab] = useState<'frames' | 'wallet' | null>(null)

  if (isPending) return <PageLoading message="Đang tải tổng quan…" />
  if (error || !data) return <QueryErrorRedirect error={error} />

  const allPending = (homework.data ?? []).filter((a) => a.myProgress?.status !== 'COMPLETED')
  const due = allPending.slice(0, 3)

  return (
    <div className="space-y-8">
      <Hero d={data} name={user?.fullName ?? ''} />

      <Card className={due.length > 0 ? 'border-l-4 border-l-crimson p-6' : 'p-6'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">Nhiệm vụ học vụ &amp; bài về nhà</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h2 className="serif text-2xl font-bold">Bài tập Thầy giao</h2>
              <Badge tone={allPending.length > 0 ? 'warn' : 'olive'} className="tabular-nums">
                {allPending.length > 0 ? `${allPending.length} bài cần làm` : 'Đã hoàn thành'}
              </Badge>
            </div>
          </div>
          <Link to="/assignments" className="text-sm font-semibold text-navy underline-offset-4 hover:underline">
            Xem tất cả bài tập →
          </Link>
        </div>

        <div className="mt-4 border-t border-gold/25 pt-4">
          {homework.isPending ? <p className="text-sm text-ink-soft">Đang tải bài tập…</p> : null}
          {!homework.isPending && due.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-[68ch] text-sm text-ink-soft">
                Hiện chưa có bài tập nào chưa hoàn thành. Khi giáo viên giao bài, bài sẽ xuất hiện tại đây kèm hạn nộp.
              </p>
              <Link to="/practice" className="shrink-0">
                <Button variant="navy">Tự luyện đề trong lúc chờ</Button>
              </Link>
            </div>
          ) : null}
          {due.length > 0 ? (
            <div className="divide-y divide-gold/25">
              {due.map((a) => {
                const inProgress = a.myProgress?.status === 'IN_PROGRESS'
                return (
                  <div key={a.id} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{a.title}</p>
                        <Badge tone={inProgress ? 'warn' : 'gold'}>{inProgress ? 'Đang làm' : 'Chưa nộp'}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-soft tabular-nums">
                        {a.parts.map((p) => p.code.replace('PART_', 'Part ')).join(', ')}
                        {a.dueAt ? ` • Hạn ${new Date(a.dueAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                      </p>
                    </div>
                    <Link to="/assignments" className="shrink-0">
                      <Button variant={inProgress ? 'gold' : 'navy'} className="w-full sm:w-auto">
                        {inProgress ? 'Làm tiếp' : 'Làm bài ngay'}
                      </Button>
                    </Link>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </Card>

      <DailyGoalsCard />

      <ScoreChart d={data} />
      <DashboardHonorSummaryCard honor={data.honor} onOpenWardrobe={(tab = 'frames') => setWardrobeTab(tab)} />
      <FrameWardrobeModal open={wardrobeTab !== null} initialTab={wardrobeTab ?? 'frames'} onClose={() => setWardrobeTab(null)} />

      <section className="grid gap-6 lg:grid-cols-2">
        <SkillCard stat={data.skills.find((s) => s.skill === 'LISTENING')} kind="LISTENING" />
        <SkillCard stat={data.skills.find((s) => s.skill === 'READING')} kind="READING" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <Badge>Ngữ pháp</Badge>
          <h2 className="serif mt-3 text-2xl font-bold">Chuyên đề Part 5 & 6</h2>
          <p className="mt-2 text-sm text-ink-soft tabular-nums">
            {study.data ? `Đã học ${study.data.grammarCompleted}/${study.data.grammarTotal} chuyên đề.` : 'Các chuyên đề ngữ pháp cốt lõi cho Part 5 và Part 6.'}
          </p>
          <Link to="/study" className="mt-4 inline-block">
            <Button variant="navy">Học ngữ pháp</Button>
          </Link>
        </Card>
        <Card className="p-6">
          <Badge tone="teal">Từ vựng</Badge>
          <h2 className="serif mt-3 text-2xl font-bold">Flashcard và sổ tay</h2>
          <p className="mt-2 text-sm text-ink-soft tabular-nums">
            {study.data ? `${study.data.notebookTotal} từ trong sổ tay • ${study.data.catalogNew} từ kho chưa học.` : 'Flashcard và sổ tay từ vựng của bạn.'}
          </p>
          <Link to="/study/notebook" className="mt-4 inline-block">
            <Button variant="ghost">Mở sổ tay</Button>
          </Link>
        </Card>
      </section>
    </div>
  )
}

function Hero({ d, name }: { d: StudentDashboardDto; name: string }) {
  const { goal, latestScore, remainingToTarget, streak } = d
  const goalLabel = formatGoal(goal)
  let message: ReactNode
  if (!goal || !goalLabel) {
    message = (
      <>
        Bạn chưa đặt mục tiêu điểm số. <Link to="/settings#goal" className="font-semibold text-gold-deep underline">Đặt mục tiêu</Link> để theo dõi mình còn cách đích bao xa.
      </>
    )
  } else if (goal.track === 'FOUR_SKILL') {
    message = <>Mục tiêu của bạn là {goalLabel}. Điểm thi thử L&R (thang 990) không so sánh trực tiếp với tổng 4 kỹ năng.</>
  } else if (!latestScore) {
    message = <>Mục tiêu của bạn là {goalLabel}. Hoàn thành một đề thi thử đủ 200 câu để biết mình đang ở mức nào.</>
  } else if (remainingToTarget === 0) {
    message = <>Chúc mừng! Điểm gần nhất của bạn ({latestScore.totalScore}) đã đạt mục tiêu {goal.score}+.</>
  } else {
    message = <>Bạn còn cách mục tiêu {goal.score}+ đúng {remainingToTarget} điểm. Duy trì luyện tập đều đặn nhé!</>
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-gold/40 bg-cream p-6 shadow-[0_6px_24px_rgba(15,23,42,0.06)] sm:p-8">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-button via-navy to-crimson" />
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-[0.06em] text-navy uppercase">Tổng quan của bạn</p>
          <h1 className="serif mt-2 text-3xl font-bold sm:text-4xl">Xin chào, {name}! 👋</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft tabular-nums">{message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/practice"><Button>Làm đề luyện tập</Button></Link>
            <Link to="/study"><Button variant="navy">Ôn từ vựng</Button></Link>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-2">
          <Stat
            label="Chuỗi rèn luyện"
            value={`${streak.days} ngày`}
            hint={streak.days === 0 ? 'Làm bài hôm nay để bắt đầu' : streak.activeToday ? 'Đã luyện hôm nay' : 'Luyện hôm nay để giữ chuỗi'}
            flame={streak.activeToday}
          />
          <Stat label="Mock test gần nhất" value={latestScore ? String(latestScore.totalScore) : '—'} hint={latestScore ? '/ 990' : 'Chưa có bài đủ 200 câu'} />
          <Stat
            className="lg:col-span-2"
            label="Mục tiêu cá nhân"
            value={goalLabel ?? 'Chưa đặt'}
            hint={goal ? (goal.track === 'FOUR_SKILL' ? '4 kỹ năng' : '2 kỹ năng') : 'Nhấn để đặt mục tiêu điểm số'}
            to="/settings#goal"
          />
        </div>
      </div>
    </section>
  )
}

function ScoreChart({ d }: { d: StudentDashboardDto }) {
  const data = d.scoreHistory.map((p) => ({ label: dayMonth(p.at), score: p.totalScore }))
  return (
    <Card className="p-6">
      <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">Tiến độ cá nhân</p>
      <h2 className="serif mt-1 text-2xl font-bold">Đường tăng trưởng điểm thi mock test</h2>
      <p className="mt-1 text-sm text-ink-soft tabular-nums">
        {data.length === 0
          ? 'Chưa có điểm mock test nào.'
          : d.improvement === null
            ? 'Mới có 1 bài thi thử — làm thêm để thấy xu hướng.'
            : `${d.improvement >= 0 ? 'Tăng' : 'Giảm'} ${Math.abs(d.improvement)} điểm so với bài thi thử đầu tiên`}
        {formatGoal(d.goal) ? ` • Mục tiêu ${formatGoal(d.goal)}` : ''}
      </p>
      {data.length === 0 ? (
        <div className="mt-6 grid h-72 place-items-center rounded-2xl bg-paper p-6 text-center text-sm text-ink-soft">
          <div>
            <p>Điểm quy đổi 990 chỉ có sau khi bạn làm đủ 100 câu Listening và/hoặc 100 câu Reading của một đề đầy đủ.</p>
            <Link to="/practice" className="mt-4 inline-block">
              <Button variant="navy">Chọn đề thi thử</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="var(--color-gold)" strokeOpacity={0.55} vertical={false} />
              <XAxis dataKey="label" stroke="var(--color-ink-soft)" tick={{ fill: 'var(--color-ink-soft)', fontSize: 14 }} tickLine={false} axisLine={{ stroke: 'var(--color-gold)' }} />
              <YAxis domain={[0, 990]} stroke="var(--color-ink-soft)" tick={{ fill: 'var(--color-ink-soft)', fontSize: 14 }} tickLine={false} axisLine={{ stroke: 'var(--color-gold)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-cream)',
                  borderColor: 'var(--color-gold)',
                  borderRadius: '12px',
                  color: 'var(--color-ink)',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)',
                }}
                labelStyle={{ color: 'var(--color-ink-soft)', fontWeight: 600, marginBottom: 2 }}
                itemStyle={{ color: 'var(--color-chart-line)', fontWeight: 700 }}
              />
              {chartGoalLines(d.goal)}
              <Line
                type="monotone"
                dataKey="score"
                name="Điểm"
                stroke="var(--color-chart-line)"
                strokeWidth={3}
                dot={{ r: 5, fill: 'var(--color-chart-dot)', stroke: 'var(--color-chart-line)', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: 'var(--color-crimson)', stroke: 'var(--color-cream)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

function SkillCard({ stat, kind }: { stat: SkillStatDto | undefined; kind: 'LISTENING' | 'READING' }) {
  const listening = kind === 'LISTENING'
  const done = (stat?.attempts ?? 0) > 0
  return (
    <Card className="p-6">
      {listening ? <Badge tone="teal">Listening module • Part 1–4</Badge> : <Badge>Reading module • Part 5–7</Badge>}
      <h2 className="serif mt-3 text-2xl font-bold">{listening ? 'Luyện tập kỹ năng nghe' : 'Luyện tập kỹ năng đọc'}</h2>
      <p className="mt-2 text-sm text-ink-soft tabular-nums">
        {done && stat
          ? `Đã làm ${stat.attempts} bài • ${stat.answered} câu${stat.accuracy !== null ? ` • Tỷ lệ đúng ${stat.accuracy}%` : ''}`
          : 'Bạn chưa làm bài nào ở kỹ năng này.'}
      </p>
      <div className="mt-4 flex gap-3">
        <Link to={listening ? '/practice/listening' : '/practice/reading'}>
          <Button variant={listening ? 'teal' : 'navy'}>{done ? 'Luyện tiếp' : 'Bắt đầu luyện'}</Button>
        </Link>
        <Link to="/practice"><Button variant="ghost">Toàn bộ kho đề</Button></Link>
      </div>
    </Card>
  )
}

function StreakFlame() {
  return (
    <span className="streak-flame relative grid size-11 shrink-0 place-items-center" aria-hidden="true">
      <span className="absolute size-9 rounded-full bg-orange-400/70 blur-md" />
      <Flame className="absolute size-9 fill-orange-500 text-orange-700 drop-shadow-[0_0_10px_rgba(249,115,22,0.9)]" strokeWidth={1.75} />
      <Flame className="absolute size-5 translate-y-0.5 fill-amber-200 text-amber-50" strokeWidth={1.5} />
    </span>
  )
}

function Stat({ label, value, hint, to, flame, className }: { label: string; value: string; hint?: string; to?: string; flame?: boolean; className?: string }) {
  const body = (
    <div className={`min-w-0 rounded-2xl border border-gold/40 bg-teal-soft p-4 ${className ?? ''}`}>
      <p className="text-xs font-semibold leading-snug text-navy">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <p className="serif text-2xl font-bold tabular-nums">{value}</p>
        {flame ? <StreakFlame /> : null}
      </div>
      {hint ? <p className="mt-0.5 text-xs text-ink-soft tabular-nums">{hint}</p> : null}
    </div>
  )
  return to ? <Link to={to} className={className}>{body}</Link> : body
}
