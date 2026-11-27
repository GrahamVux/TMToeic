import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card, Input } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { useStaffHonor } from '@/features/progress/progress.queries'
import { useStudents } from '@/features/teacher/users.queries'
import { ApiError } from '@/lib/api'
import { getFrameDef, type HonorPeriod, type HonorRewardConfig, type HonorScope } from '@toeic/shared'
import { CheckCircle2, Crown, History, PlusCircle, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StaffHonorBoards } from './HonorBoards'
import { useAdjustPoints, useEarlySettle, useUpdateHonorConfig } from './honor.queries'

export function StaffHonorPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const { data, isPending, error } = useStaffHonor()
  const [period, setPeriod] = useState<HonorPeriod>('week')
  const [settlingKey, setSettlingKey] = useState<string | null>(null)
  const [pendingSettle, setPendingSettle] = useState<{ scope: HonorScope; period: HonorPeriod; classId?: string; label: string; periodLabel: string } | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const updateConfig = useUpdateHonorConfig()
  const adjustPoints = useAdjustPoints()
  const earlySettle = useEarlySettle()

  const [draftConfig, setDraftConfig] = useState<HonorRewardConfig | null>(null)
  useEffect(() => {
    if (data?.rewardConfig) setDraftConfig(data.rewardConfig)
  }, [data?.rewardConfig])

  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [deltaStr, setDeltaStr] = useState('50')
  const [reason, setReason] = useState('')
  const students = useStudents({ q: studentSearch.trim(), status: 'ACTIVE', classId: '', page: 1, pageSize: 20 }, isAdmin)

  useEffect(() => {
    const firstId = students.data?.items[0]?.id ?? ''
    if (!selectedStudentId && firstId) setSelectedStudentId(firstId)
  }, [students.data?.items, selectedStudentId])

  if (isPending) return <PageLoading message="Đang tải bảng xếp hạng…" />
  if (error || !data) return <QueryErrorRedirect error={error} />

  const config = draftConfig ?? data.rewardConfig

  function setTierPoints(scope: HonorScope, p: HonorPeriod, place: 1 | 2 | 3, points: number) {
    setDraftConfig((prev) => {
      const base = prev ?? data!.rewardConfig
      return {
        ...base,
        [scope]: {
          ...base[scope],
          [p]: base[scope][p].map((t) => (t.place === place ? { ...t, points } : t)),
        },
      }
    })
  }

  async function saveConfig() {
    setNotice('')
    setActionError('')
    try {
      await updateConfig.mutateAsync(config)
      setNotice('Đã lưu cấu hình mức điểm thưởng Top 3.')
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không lưu được cấu hình.')
    }
  }

  async function submitManualPoints() {
    setNotice('')
    setActionError('')
    const delta = Math.trunc(Number(deltaStr))
    if (!selectedStudentId || !Number.isFinite(delta) || delta === 0 || reason.trim().length < 2) {
      setActionError('Chọn học viên, nhập số điểm khác 0 và lý do (tối thiểu 2 ký tự).')
      return
    }
    try {
      const res = await adjustPoints.mutateAsync({ userId: selectedStudentId, delta, reason: reason.trim() })
      setReason('')
      setNotice(`Đã cập nhật ví điểm học viên (số dư mới: ${res.rewardPoints.toLocaleString('vi-VN')} điểm).`)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không điều chỉnh được điểm.')
    }
  }

  function requestSettle(scope: HonorScope, classId?: string) {
    const label = scope === 'center' ? 'Toàn Trung Tâm' : data?.classes.find((c) => c.classId === classId)?.className ?? 'Lớp'
    const periodLabel = period === 'week' ? 'Tuần' : period === 'month' ? 'Tháng' : 'Năm'
    setActionError('')
    setPendingSettle({ scope, period, classId, label, periodLabel })
  }

  async function confirmSettle() {
    if (!pendingSettle) return
    const target = pendingSettle
    const key = target.scope === 'center' ? 'center' : `class:${target.classId}`
    setSettlingKey(key)
    setNotice('')
    setActionError('')
    try {
      const res = await earlySettle.mutateAsync({ scope: target.scope, period: target.period, classId: target.classId })
      setNotice(`Đã chốt thưởng ${target.label}: trao giải cho ${res.winners.length} học viên Top 3.`)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không chốt thưởng được.')
    } finally {
      setSettlingKey(null)
      setPendingSettle(null)
    }
  }

  return (
    <div className="space-y-8">
      {notice ? (
        <div role="status" className="flex items-center gap-2 rounded-2xl border border-success/35 bg-success-soft px-4 py-3 text-sm font-medium text-ink">
          <CheckCircle2 className="size-4 text-success" /> {notice}
        </div>
      ) : null}
      {actionError ? (
        <p role="alert" className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <StaffHonorBoards
        honor={data}
        period={period}
        onPeriodChange={setPeriod}
        canSettle={isAdmin}
        settlingKey={settlingKey}
        onEarlySettle={(scope, classId) => requestSettle(scope, classId)}
      />

      {isAdmin ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="serif text-2xl">Cấu hình mức điểm thưởng Top 3</h2>
                <p className="text-xs text-ink-soft">Thay đổi áp dụng cho các kỳ chốt tự động và chốt sớm kế tiếp.</p>
              </div>
              <Button type="button" disabled={updateConfig.isPending} onClick={() => void saveConfig()}>
                {updateConfig.isPending ? 'Đang lưu…' : 'Lưu cấu hình thưởng'}
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {(['class', 'center'] as const).map((scope) => (
                <Card key={scope} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {scope === 'center' ? <Crown className="size-5 text-warn" /> : <Trophy className="size-5 text-gold-deep" />}
                      <h3 className="serif text-lg">{scope === 'center' ? 'Thưởng Toàn Trung Tâm' : 'Thưởng Trong Lớp'}</h3>
                    </div>
                    <Badge tone={scope === 'center' ? 'warn' : 'teal'}>
                      {scope === 'center' ? 'Tuần ≥50 • Tháng ≥200 • Năm ≥1000 EXP' : 'Sàn > 0 EXP'}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {(['week', 'month', 'year'] as const).map((p) => (
                      <div key={p} className="rounded-2xl border border-gold/30 bg-paper p-3.5">
                        <p className="text-xs font-bold text-ink uppercase">
                          {p === 'week' ? 'Tuần (7 ngày)' : p === 'month' ? 'Tháng (Vĩnh viễn)' : 'Năm (Vĩnh viễn)'}
                        </p>
                        <div className="mt-3 space-y-2.5">
                          {config[scope][p].map((tier) => (
                            <label key={tier.place} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate font-semibold text-ink">
                                Top {tier.place} • {getFrameDef(tier.frameId).name}
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  step={10}
                                  value={tier.points}
                                  onChange={(e) => setTierPoints(scope, p, tier.place, Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                                  className="h-10 w-20 rounded-lg border border-gold/45 bg-cream px-2 text-right text-xs font-bold text-ink tabular-nums outline-none focus:border-button focus:ring-2 focus:ring-button/30"
                                />
                                <span className="text-ink-soft">điểm</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <PlusCircle className="size-5 text-gold-deep" />
                <h3 className="serif text-lg">Cộng / Trừ điểm thủ công</h3>
              </div>
              <p className="mt-1 text-xs text-ink-soft">Ghi nhận trực tiếp vào sổ cái ví điểm của học viên.</p>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-ink-soft">
                  Tìm học viên (tên hoặc mã HV)
                  <Input
                    className="mt-1 text-sm"
                    placeholder="Nhập tên hoặc mã TM-…"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value)
                      setSelectedStudentId('')
                    }}
                  />
                </label>
                <label className="block text-xs font-medium text-ink-soft">
                  Chọn tài khoản
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-ink/12 bg-cream px-3 text-sm outline-none focus:border-button focus:ring-2 focus:ring-button/30"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                  >
                    {(students.data?.items ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.studentCode ?? s.username}) — {s.rewardPoints}đ
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-ink-soft">
                  Số điểm thay đổi (nhập số âm để trừ, VD: -50)
                  <Input className="mt-1 text-sm font-bold" type="number" value={deltaStr} onChange={(e) => setDeltaStr(e.target.value)} />
                </label>
                <label className="block text-xs font-medium text-ink-soft">
                  Lý do
                  <Input
                    className="mt-1 text-sm"
                    placeholder="VD: Thưởng nóng đạt 700+ Mock Test"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <Button type="button" className="w-full" disabled={adjustPoints.isPending} onClick={() => void submitManualPoints()}>
                  {adjustPoints.isPending ? 'Đang ghi…' : 'Ghi nhận biến động điểm'}
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="size-5 text-gold-deep" />
                  <h3 className="serif text-lg">Lịch sử các kỳ đã chốt & trao thưởng</h3>
                </div>
                <span className="text-xs text-ink-soft">{data.settlements.length} kỳ gần nhất</span>
              </div>
              {data.settlements.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-paper p-4 text-sm text-ink-soft">
                  Chưa có kỳ nào được chốt kể từ khi bật hệ thống thưởng mới.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.settlements.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-gold/30 bg-paper p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">
                          {s.cycleKey} • <span className="text-gold-deep">{s.className ?? 'Toàn Trung Tâm'}</span>
                        </p>
                        <span className="text-xs text-ink-soft">
                          {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(s.settledAt))}
                        </span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {s.winners.length === 0 ? (
                          <span className="text-xs text-ink-soft">Không có học viên đạt điều kiện sàn Top 3 trong kỳ này.</span>
                        ) : (
                          s.winners.map((w) => (
                            <span key={w.place} className="inline-flex items-center gap-1.5 rounded-xl border border-gold/35 bg-cream px-2.5 py-1 text-xs">
                              <strong>#{w.place} {w.name}</strong>
                              <span className="font-semibold text-olive">+{w.points}đ</span>
                              <span className="text-ink-soft">• {getFrameDef(w.frameId).name}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
      {pendingSettle ? (
        <Modal
          title="Chốt thưởng sớm?"
          dismissible={!earlySettle.isPending}
          onClose={() => !earlySettle.isPending && setPendingSettle(null)}
        >
          <p className="text-sm text-ink-soft">
            Chốt thưởng sớm kỳ <strong className="text-ink">{pendingSettle.periodLabel}</strong> cho <strong className="text-ink">{pendingSettle.label}</strong>? Điểm và khung viền Top 3 sẽ được trao ngay.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="paper" disabled={earlySettle.isPending} onClick={() => setPendingSettle(null)}>
              Hủy
            </Button>
            <Button type="button" disabled={earlySettle.isPending} onClick={() => void confirmSettle()}>
              {earlySettle.isPending ? 'Đang chốt…' : 'Chốt thưởng ngay'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
