import { Button } from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { partName } from '@/features/exams/exams.queries'
import { MIN_ANSWERS_FOR_INSIGHT, type AttemptSummaryDto, type GoalDto, type PartStatDto, type ScorePointDto } from '@toeic/shared'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'

const dayMonth = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

const MODE_LABEL: Record<string, string> = { PRACTICE: 'Luyện tập', TIMED: 'Tính giờ', FULL_TEST: 'Thi thử', PART_DRILL: 'Luyện part', RANDOM: 'Ngẫu nhiên' }

export function ScoreTrend({ history, target, subtitle }: { history: ScorePointDto[]; target: GoalDto; subtitle?: string }) {
  const data = history.map((p) => ({ label: dayMonth(p.at), score: p.totalScore }))
  return (
    <Card className="p-6">
      <h2 className="serif text-2xl">Xu hướng điểm mock test</h2>
      {subtitle ? <p className="text-sm text-ink/55">{subtitle}</p> : null}
      {data.length === 0 ? (
        <p className="mt-4 grid h-56 place-items-center rounded-2xl bg-paper p-6 text-center text-sm text-ink/60">
          Chưa có bài thi thử đủ 100 câu Listening và/hoặc 100 câu Reading, nên chưa có điểm quy đổi.
        </p>
      ) : (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#eaf5f8" />
              <XAxis dataKey="label" />
              <YAxis domain={[0, 990]} />
              <Tooltip />
              {target?.track === 'TWO_SKILL' ? (
                <ReferenceLine y={target.score} stroke="#b9860b" strokeDasharray="6 4" label={{ value: `Mục tiêu ${target.score}`, fontSize: 11, position: 'insideTopLeft' }} />
              ) : null}
              <Line type="monotone" dataKey="score" name="Điểm" stroke="#2b8a9c" strokeWidth={3} dot={{ r: 5, fill: '#b9e4ec' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

export function PartBreakdown({ parts }: { parts: PartStatDto[] }) {
  return (
    <div className="grid gap-3">
      {parts.map((p) => {
        const enough = p.answered >= MIN_ANSWERS_FOR_INSIGHT
        return (
          <Card key={p.partCode} className="grid items-center gap-4 p-4 md:grid-cols-[90px_1fr_150px]">
            <div className="serif text-2xl text-gold-deep">{p.partCode.replace('PART_', 'Part ')}</div>
            <div>
              <p className="font-semibold">{partName(p.partCode).split(' — ')[1] ?? partName(p.partCode)}</p>
              <p className="text-sm text-ink/55">
                {p.answered === 0 ? 'Chưa có dữ liệu' : `${p.correct}/${p.answered} câu đúng • ${p.attempts} bài`}
                {p.avgSeconds !== null ? ` • ${p.avgSeconds}s/câu` : ''}
              </p>
              <ProgressBar className="mt-2" value={p.accuracy ?? 0} />
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold">{p.accuracy === null ? '—' : `${p.accuracy}%`}</p>
              {p.answered > 0 && !enough ? <p className="text-xs text-ink/50">Cần ≥{MIN_ANSWERS_FOR_INSIGHT} câu để đánh giá</p> : null}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function AttemptsTable({
  attempts,
  reviewLinks,
  staffStudentId,
}: {
  attempts: AttemptSummaryDto[]
  reviewLinks?: boolean
  /** Teacher view: link to that student’s result & detailed sitting. */
  staffStudentId?: string
}) {
  if (attempts.length === 0) return <p className="rounded-2xl bg-paper p-4 text-sm text-ink/60">Chưa có bài nào được nộp.</p>
  const showActions = Boolean(reviewLinks || staffStudentId)
  return (
    <div className="overflow-x-auto rounded-2xl border border-gold/35 bg-cream">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-paper text-xs tracking-wide text-ink/45 uppercase">
          <tr>
            <th className="px-4 py-3">Đề</th>
            <th className="px-4 py-3">Hình thức</th>
            <th className="px-4 py-3">Kết quả</th>
            <th className="px-4 py-3">Nộp lúc</th>
            {showActions ? <th className="px-4 py-3 text-right" /> : null}
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => {
            const kind = a.assignmentTitle ? 'Bài tập' : (MODE_LABEL[a.mode] ?? a.mode)
            const parts = (a.partCodes ?? []).map((c) => c.replace('PART_', 'Part ')).join(', ')
            return (
              <tr key={a.attemptId} className="border-t border-gold/25">
                <td className="px-4 py-3">
                  <p className="font-medium">{a.assignmentTitle ?? a.examTitle}</p>
                  {a.assignmentTitle ? <p className="text-xs text-ink/50">{a.examTitle}</p> : null}
                  {parts ? <p className="mt-0.5 text-xs text-ink/50">{parts}</p> : null}
                </td>
                <td className="px-4 py-3">
                  {kind}
                  {a.status === 'EXPIRED' ? <Badge tone="warn" className="ml-2">Hết giờ</Badge> : null}
                </td>
                <td className="px-4 py-3">
                  {a.totalScore !== null ? <span className="font-semibold">{a.totalScore}/990</span> : null}
                  <span className="text-ink/60">{a.totalScore !== null ? ' • ' : ''}{a.correct}/{a.total} câu ({a.accuracy}%)</span>
                </td>
                <td className="px-4 py-3 text-ink/70">{dateTime.format(new Date(a.at))}</td>
                {showActions ? (
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {staffStudentId ? (
                        <>
                          <Link to={`/admin/students/${staffStudentId}/attempts/${a.attemptId}`}>
                            <Button variant="paper" className="px-3 py-1.5 text-xs">Kết quả</Button>
                          </Link>
                          <Link to={`/admin/students/${staffStudentId}/attempts/${a.attemptId}/review`}>
                            <Button className="px-3 py-1.5 text-xs">Bài làm</Button>
                          </Link>
                        </>
                      ) : (
                        <Link to={`/attempts/${a.attemptId}/review`}>
                          <Button variant="paper" className="px-3 py-1.5 text-xs">Chữa đề</Button>
                        </Link>
                      )}
                    </div>
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
