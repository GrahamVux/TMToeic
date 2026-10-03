import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useAssignments } from '@/features/assignments/assignments.queries'
import { formatGoal, type GoalDto, type LeaderboardEntryDto, type SkillStatDto, type StudentDashboardDto } from '@toeic/shared'
import type { ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { useStudyOverview } from '@/features/study/study.queries'
import { useDashboard } from './dashboard.queries'

const dayMonth = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function chartGoalLines(goal: GoalDto) {
  if (goal?.track !== 'TWO_SKILL') return null
  return <ReferenceLine y={goal.score} stroke="#b9860b" strokeDasharray="6 4" label={{ value: `Mục tiêu ${goal.score}`, fontSize: 11, position: 'insideTopLeft' }} />
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data, isPending, error } = useDashboard()
  const homework = useAssignments()
  const study = useStudyOverview()

  if (isPending) return <PageLoading message="Đang tải tổng quan…" />
  if (error || !data) return <QueryErrorRedirect error={error} />

  const due = (homework.data ?? []).filter((a) => a.myProgress?.status !== 'COMPLETED').slice(0, 3)

  return (
    <div className="space-y-8">
      <Hero d={data} name={user?.fullName ?? ''} />

      <section>
        <p className="text-xs font-semibold tracking-[0.16em] text-gold-deep uppercase">Nhiệm vụ học vụ & bài về nhà</p>
        <h2 className="serif mt-1 text-2xl">Bài tập Thầy giao</h2>
        <Card className="mt-4 p-6">
          {homework.isPending ? <p className="text-sm text-ink/55">Đang tải bài tập…</p> : null}
          {!homework.isPending && due.length === 0 ? (
            <>
              <p className="text-sm text-ink/65">Hiện chưa có bài tập nào được giao cho bạn. Khi giáo viên giao bài, bài sẽ xuất hiện tại đây kèm hạn nộp.</p>
              <Link to="/practice" className="mt-4 inline-block">
                <Button variant="navy">Tự luyện đề trong lúc chờ</Button>
              </Link>
            </>
          ) : null}
          {due.map((a) => (
            <div key={a.id} className="border-t border-gold/20 py-3 first:border-t-0 first:pt-0">
              <p className="font-semibold">{a.title}</p>
              <p className="text-sm text-ink/55">
                {a.parts.map((p) => p.code.replace('PART_', 'Part ')).join(', ')}
                {a.dueAt ? ` • hạn ${new Date(a.dueAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
              </p>
            </div>
          ))}
          {due.length > 0 ? (
            <Link to="/assignments" className="mt-2 inline-block">
              <Button variant="navy">Vào danh sách bài tập</Button>
            </Link>
          ) : null}
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <ScoreChart d={data} />
        <Leaderboard d={data} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <SkillCard stat={data.skills.find((s) => s.skill === 'LISTENING')} kind="LISTENING" />
        <SkillCard stat={data.skills.find((s) => s.skill === 'READING')} kind="READING" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <Badge>Ngữ pháp</Badge>
          <h2 className="serif mt-3 text-2xl">Chuyên đề Part 5 & 6</h2>
          <p className="mt-2 text-sm text-ink/60">
            {study.data ? `Đã học ${study.data.grammarCompleted}/${study.data.grammarTotal} chuyên đề.` : 'Các chuyên đề ngữ pháp cốt lõi cho Part 5 và Part 6.'}
          </p>
          <Link to="/study" className="mt-4 inline-block">
            <Button variant="navy">Học ngữ pháp</Button>
          </Link>
        </Card>
        <Card className="p-6">
          <Badge tone="teal">Từ vựng</Badge>
          <h2 className="serif mt-3 text-2xl">Flashcard và sổ tay</h2>
          <p className="mt-2 text-sm text-ink/60">
            {study.data ? `${study.data.notebookTotal} từ trong sổ tay • ${study.data.catalogNew} từ kho chưa học.` : 'Bôi một từ khi làm bài để lưu vào sổ tay.'}
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
    <section className="overflow-hidden rounded-3xl border border-gold/40 bg-cream p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs tracking-[0.2em] text-gold-deep uppercase">Tổng quan của bạn</p>
          <h1 className="serif mt-2 text-4xl">Xin chào, {name}! 👋</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/65">{message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/practice"><Button>Làm đề luyện tập</Button></Link>
            <Link to="/study"><Button variant="paper">Ôn từ vựng</Button></Link>
          </div>
        </div>
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Chuỗi rèn luyện"
            value={`${streak.days} ngày`}
            hint={streak.days === 0 ? 'Làm bài hôm nay để bắt đầu' : streak.activeToday ? 'Đã luyện hôm nay 🔥' : 'Luyện hôm nay để giữ chuỗi'}
          />
          <Stat label="Mock test gần nhất" value={latestScore ? String(latestScore.totalScore) : '—'} hint={latestScore ? '/ 990' : 'Chưa có bài đủ 200 câu'} />
          <Stat label="Mục tiêu cá nhân" value={goalLabel ?? 'Chưa đặt'} hint={goal ? (goal.track === 'FOUR_SKILL' ? '4 kỹ năng' : '2 kỹ năng') : undefined} to="/settings#goal" />
        </div>
      </div>
    </section>
  )
}

function ScoreChart({ d }: { d: StudentDashboardDto }) {
  const data = d.scoreHistory.map((p) => ({ label: dayMonth(p.at), score: p.totalScore }))
  return (
    <Card className="p-6">
      <p className="text-xs font-semibold tracking-[0.16em] text-gold-deep uppercase">Tiến độ cá nhân</p>
      <h2 className="serif mt-1 text-2xl">Đường tăng trưởng điểm thi mock test</h2>
      <p className="mt-1 text-sm text-ink/60">
        {data.length === 0
          ? 'Chưa có điểm mock test nào.'
          : d.improvement === null
            ? 'Mới có 1 bài thi thử — làm thêm để thấy xu hướng.'
            : `${d.improvement >= 0 ? 'Tăng' : 'Giảm'} ${Math.abs(d.improvement)} điểm so với bài thi thử đầu tiên`}
        {formatGoal(d.goal) ? ` • Mục tiêu ${formatGoal(d.goal)}` : ''}
      </p>
      {data.length === 0 ? (
        <div className="mt-6 grid h-72 place-items-center rounded-2xl bg-paper p-6 text-center text-sm text-ink/60">
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
              <CartesianGrid stroke="#eaf5f8" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 990]} tick={{ fontSize: 12 }} />
              <Tooltip />
              {chartGoalLines(d.goal)}
              <Line type="monotone" dataKey="score" name="Điểm" stroke="#2b8a9c" strokeWidth={3} dot={{ r: 5, fill: '#b9e4ec' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

function Leaderboard({ d }: { d: StudentDashboardDto }) {
  const { entries, you, participants } = d.leaderboard
  const [y, m, day] = d.weekStart.split('-')
  const youInList = entries.some((e) => e.you)
  return (
    <Card className="p-6">
      <h2 className="serif text-2xl">Bảng vinh danh tuần</h2>
      <p className="mt-1 text-sm text-ink/60">
        Xếp theo số câu đã làm từ thứ Hai {day}/{m}/{y} • {participants} bạn tham gia
      </p>
      {entries.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-paper p-4 text-sm text-ink/60">Tuần này chưa ai luyện tập. Hãy là người đầu tiên lên bảng!</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {entries.map((row) => (
            <Row key={row.rank} row={row} />
          ))}
          {you && !youInList ? (
            <>
              <li className="text-center text-xs text-ink/40" aria-hidden="true">⋯</li>
              <Row row={you} />
            </>
          ) : null}
        </ul>
      )}
      {!you && entries.length > 0 ? <p className="mt-4 text-xs text-ink/55">Bạn chưa có hoạt động tuần này — làm vài câu để có tên trên bảng.</p> : null}
    </Card>
  )
}

function Row({ row }: { row: LeaderboardEntryDto }) {
  return (
    <li className={`flex items-center justify-between rounded-2xl px-3 py-3 ${row.you ? 'bg-gold/15' : 'bg-paper'}`}>
      <div>
        <p className="font-semibold">{row.rank}. {row.name} {row.you ? '(Bạn)' : ''}</p>
        <p className="text-xs text-ink/55">
          {row.answered} câu{row.accuracy !== null ? ` • ${row.accuracy}% đúng` : ''}
        </p>
      </div>
      {row.rank === 1 ? <Badge tone="gold">Top chuyên cần</Badge> : null}
    </li>
  )
}

function SkillCard({ stat, kind }: { stat: SkillStatDto | undefined; kind: 'LISTENING' | 'READING' }) {
  const listening = kind === 'LISTENING'
  const done = (stat?.attempts ?? 0) > 0
  return (
    <Card className="p-6">
      {listening ? <Badge tone="teal">Listening module • Part 1–4</Badge> : <Badge>Reading module • Part 5–7</Badge>}
      <h2 className="serif mt-3 text-2xl">{listening ? 'Luyện tập kỹ năng nghe' : 'Luyện tập kỹ năng đọc'}</h2>
      <p className="mt-2 text-sm text-ink/65">
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

function Stat({ label, value, hint, to }: { label: string; value: string; hint?: string; to?: string }) {
  const body = (
    <div className="min-w-0 rounded-2xl border border-gold/40 bg-teal-soft p-4">
      <p className="text-[10px] leading-snug tracking-wide text-gold-deep uppercase">{label}</p>
      <p className="serif mt-2 text-2xl">{value}</p>
      {hint ? <p className="text-xs text-ink/55">{hint}</p> : null}
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}
