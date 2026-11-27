import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Badge, Card, ProgressBar } from '@/components/ui/Primitives'
import { cn } from '@/lib/cn'
import {
  CENTER_MIN_XP,
  XP_PER_CORRECT,
  XP_PER_RANK,
  getFrameDef,
  type HonorBoardDto,
  type HonorEntryDto,
  type HonorPeriod,
  type HonorScope,
  type StaffHonorDto,
} from '@toeic/shared'
import { ArrowRight, Clock, Coins, Crown, Flame, Gift, Sparkles, Trophy, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { RankBadge } from './RankBadge'

export function formatCountdown(endsAtIso: string): string {
  const diff = new Date(endsAtIso).getTime() - Date.now()
  if (diff <= 0) return 'Đang chốt kỳ…'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  return days > 0 ? `Còn ${days} ngày ${String(hours).padStart(2, '0')} giờ` : `Còn ${Math.max(1, hours)} giờ`
}

export function DashboardHonorSummaryCard({
  honor,
  onOpenWardrobe,
}: {
  honor: HonorBoardDto
  onOpenWardrobe: (tab?: 'frames' | 'wallet') => void
}) {
  if (!honor.enabled) return null
  const centerWeek = honor.boards.center.week
  const myEntry = centerWeek.you
  const top3 = centerWeek.entries.filter((e) => e.place <= 3).slice(0, 3)

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">
            Đua Top Tuần & Tháng{honor.className ? ` • ${honor.className}` : ''}
          </p>
          <h2 className="serif mt-1 text-2xl">Vị trí vinh danh của bạn</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenWardrobe('frames')}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-warn/35 bg-warn-soft px-3 py-1.5 text-xs font-semibold text-warn transition hover:bg-warn-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
          >
            <Coins className="size-3.5 text-warn" /> {honor.me.rewardPoints.toLocaleString('vi-VN')} điểm • Kho khung viền
          </button>
          <Link to="/honor" className={buttonClasses('gold')}>
            Mở trang Xếp Hạng <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-gold/35 bg-paper p-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <AccountAvatar name={myEntry?.name ?? 'Bạn'} url={myEntry?.avatarUrl} frameId={honor.me.avatarFrame} className="size-[58px] text-base" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-button px-2.5 py-0.5 text-xs font-bold text-button-ink">
                  {myEntry ? `Hạng #${myEntry.place} Trung Tâm` : 'Chưa lên bảng tuần này'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-warn">
                  <Flame className="size-3.5 fill-warn text-warn" /> {honor.me.streakDays} ngày
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink">
                {honor.me.weeklyXp} EXP tuần • {honor.me.monthlyXp} EXP tháng • {honor.me.yearlyXp} EXP năm
              </p>
              <p className="text-xs text-ink-soft">{honor.me.lifetimeXp.toLocaleString('vi-VN')} EXP tích lũy trọn đời</p>
            </div>
          </div>
          <div className="hidden shrink-0 sm:block">
            <RankBadge rank={honor.me.rank} size={34} />
          </div>
        </div>

        <div className="rounded-2xl border border-gold/30 bg-cream p-4">
          <p className="text-xs font-semibold text-ink-soft">Top 3 Toàn Trung Tâm Tuần ({formatCountdown(centerWeek.endsAt)})</p>
          {top3.length === 0 ? (
            <p className="mt-3 text-xs text-ink-soft">
              Chưa ai đạt sàn {CENTER_MIN_XP.week} EXP tuần này để lên bục Top 3 Trung Tâm.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {top3.map((row) => (
                <div key={`${row.place}-${row.name}`} className="flex flex-col items-center rounded-xl bg-paper p-2.5 text-center">
                  <AccountAvatar name={row.name} url={row.avatarUrl} frameId={row.avatarFrame} className="size-[42px] text-xs" />
                  <p className="mt-1.5 w-full truncate text-xs font-semibold">
                    #{row.place} {row.name.split(' ').slice(-1)[0]}
                  </p>
                  <p className="text-[13px] font-medium text-gold-deep">{row.periodXp} EXP</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export function RivalsNeighborhoodPanel({ rivals, myPlace }: { rivals: HonorEntryDto[]; myPlace: number | null }) {
  const meIdx = rivals.findIndex((r) => r.you)
  const me = meIdx >= 0 ? rivals[meIdx] : null
  const above = meIdx > 0 ? rivals[meIdx - 1] : null
  const below = meIdx >= 0 && meIdx < rivals.length - 1 ? rivals[meIdx + 1] : null
  const diffAbove = above && me ? Math.max(1, above.periodXp - me.periodXp + 1) : null
  const diffBelow = below && me ? Math.max(0, me.periodXp - below.periodXp) : null

  return (
    <div className="rounded-2xl border border-gold-deep/35 bg-teal-soft/45 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wider text-gold-deep uppercase">Góc đối thủ sát sườn quanh bạn</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {rivals.length === 0
              ? 'Chưa có học viên nào ghi nhận EXP trong kỳ này.'
              : diffAbove !== null && above
                ? `Cần thêm ${diffAbove} EXP để vượt #${above.place} ${above.name}`
                : 'Bạn đang dẫn đầu nhóm này!'}
            {diffBelow !== null && below ? ` • Hơn #${below.place} ${below.name} ${diffBelow} EXP` : ''}
          </p>
        </div>
        {myPlace ? <Badge tone="ink">Hạng #{myPlace}</Badge> : null}
      </div>

      {rivals.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {rivals.map((row) => {
            const delta = me ? row.periodXp - me.periodXp : 0
            return (
              <li
                key={`${row.place}-${row.name}`}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl px-3 py-2',
                  row.you ? 'border-2 border-gold-deep bg-cream shadow-xs' : 'bg-cream/85',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="w-8 text-center text-xs font-bold text-gold-deep">#{row.place}</span>
                  <AccountAvatar name={row.name} url={row.avatarUrl} frameId={row.avatarFrame} className="size-9 text-xs" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {row.name} {row.you ? '(Bạn)' : ''}
                    </p>
                    <p className="truncate text-[13px] text-ink-soft">
                      {row.className ? `${row.className} • ` : ''}🔥 {row.streakDays} ngày
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold">{row.periodXp} EXP</p>
                  {!row.you && me ? (
                    <p className={delta > 0 ? 'text-[13px] font-semibold text-warn' : 'text-[13px] font-semibold text-success'}>
                      {delta > 0 ? `Hơn bạn +${delta} EXP` : `Kém bạn ${Math.abs(delta)} EXP`}
                    </p>
                  ) : (
                    <p className="text-[13px] font-semibold text-gold-deep">Vị trí hiện tại</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export function HonorBentoView({
  honor,
  userName,
  userAvatarUrl,
  onOpenWardrobe,
}: {
  honor: HonorBoardDto
  userName: string
  userAvatarUrl: string | null
  onOpenWardrobe: (tab: 'frames' | 'wallet') => void
}) {
  const [scope, setScope] = useState<HonorScope>('center')
  const [period, setPeriod] = useState<HonorPeriod>('week')

  if (!honor.enabled) {
    return (
      <Card className="p-6 text-center text-sm text-ink-soft">
        Bảng vinh danh đang tạm tắt bởi quản trị viên.
      </Card>
    )
  }

  const board = honor.boards[scope][period]
  const rewards = honor.rewardConfig[scope][period]
  const frameDef = getFrameDef(honor.me.avatarFrame)
  const periodXp = period === 'week' ? honor.me.weeklyXp : period === 'month' ? honor.me.monthlyXp : honor.me.yearlyXp
  const rankPct = honor.me.rank.intoRank !== null ? Math.round((honor.me.rank.intoRank / XP_PER_RANK) * 100) : 100
  const podium = [1, 2, 3].map((p) => ({
    place: p as 1 | 2 | 3,
    entry: board.entries.find((e) => e.place === p) ?? null,
    reward: rewards.find((r) => r.place === p)!,
  }))
  const rest = board.entries.filter((e) => e.place >= 4)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">
            +{XP_PER_CORRECT} EXP mỗi câu đúng lần đầu • Cộng thêm EXP duy trì Streak ngày
          </p>
          <h1 className="serif mt-1 text-3xl">Bảng xếp hạng vinh danh</h1>
        </div>
        <p className="text-xs text-ink-soft">
          {period === 'week'
            ? 'Chốt Tuần tự động 00:00 Thứ Hai'
            : period === 'month'
              ? 'Chốt Tháng tự động 00:00 ngày 01 hàng tháng'
              : `Chốt Năm tự động 00:00 ngày 01/01 (${honor.yearKey})`}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[345px_1fr] lg:items-start">
        {/* Left Sticky Column: Personal Profile + Frame/Wallet + Rivals Neighborhood */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-5">
            <div className="flex items-center gap-3.5">
              <AccountAvatar name={userName} url={userAvatarUrl} frameId={honor.me.avatarFrame} className="size-[68px] text-xl" />
              <div className="min-w-0">
                <Badge tone="ink">
                  {board.you ? `Hạng #${board.you.place} ${scope === 'center' ? 'Trung Tâm' : 'Lớp'}` : scope === 'class' && !honor.className ? 'Chưa xếp lớp' : 'Chưa lên bảng'}
                </Badge>
                <h2 className="serif mt-1.5 truncate text-xl text-ink">{userName}</h2>
                <p className="truncate text-xs text-ink-soft">
                  {honor.className ?? 'Chưa xếp lớp'} • Khung: {frameDef.name}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-gold/25 bg-paper p-2.5">
                <p className="text-xs font-medium text-ink-soft">EXP kỳ này</p>
                <p className="serif mt-0.5 text-lg text-gold-deep tabular-nums">{periodXp}</p>
              </div>
              <div className="rounded-2xl border border-gold/25 bg-paper p-2.5">
                <p className="text-xs font-medium text-ink-soft">Chuỗi Streak</p>
                <p className="serif mt-0.5 inline-flex items-center gap-1 text-lg text-warn tabular-nums">
                  <Flame className="size-4 fill-warn text-warn" /> {honor.me.streakDays}N
                </p>
              </div>
              <div className="rounded-2xl border border-warn/35 bg-warn-soft p-2.5">
                <p className="text-xs font-medium text-warn">Ví điểm</p>
                <p className="serif mt-0.5 text-lg text-warn tabular-nums">{honor.me.rewardPoints.toLocaleString('vi-VN')}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gold/30 bg-paper p-3.5">
              <div className="flex items-center justify-between gap-2">
                <RankBadge rank={honor.me.rank} size={28} />
                <span className="text-xs text-ink-soft">{honor.me.lifetimeXp.toLocaleString('vi-VN')} EXP trọn đời</span>
              </div>
              <ProgressBar value={rankPct} className="mt-2.5" />
              <p className="mt-1.5 text-[13px] text-ink-soft">
                {honor.me.rank.toNext !== null ? `Còn ${honor.me.rank.toNext} EXP trọn đời để lên hạng kế tiếp` : 'Đã đạt bậc cao nhất'}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" className="w-full px-3 text-xs" onClick={() => onOpenWardrobe('frames')}>
                <Sparkles className="size-3.5" /> Đổi khung viền
              </Button>
              <Button type="button" variant="paper" className="w-full px-3 text-xs" onClick={() => onOpenWardrobe('wallet')}>
                <Gift className="size-3.5 text-gold-deep" /> Ví điểm (Sắp mở)
              </Button>
            </div>
          </Card>

          <RivalsNeighborhoodPanel rivals={board.rivals} myPlace={board.you?.place ?? null} />
        </div>

        {/* Right Column: Controls + Top 3 Podium Cards + Top 4-10 Table */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex max-w-full flex-wrap rounded-xl border border-gold/40 bg-paper p-1" role="tablist" aria-label="Phạm vi bảng">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scope === 'class'}
                    onClick={() => setScope('class')}
                    className={cn(
                      'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                      scope === 'class' ? 'bg-button text-button-ink' : 'text-ink-soft hover:text-ink',
                    )}
                  >
                    <Users className="size-3.5 shrink-0" /> Bảng Lớp{honor.className ? ` (${honor.className})` : ''}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scope === 'center'}
                    onClick={() => setScope('center')}
                    className={cn(
                      'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                      scope === 'center' ? 'bg-button text-button-ink' : 'text-ink-soft hover:text-ink',
                    )}
                  >
                    <Crown className="size-3.5 shrink-0" /> Toàn Trung Tâm
                  </button>
                </div>

                <div className="flex max-w-full flex-wrap rounded-xl border border-gold/40 bg-paper p-1" role="tablist" aria-label="Chu kỳ">
                  {(['week', 'month', 'year'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="tab"
                      aria-selected={period === p}
                      onClick={() => setPeriod(p)}
                      className={cn(
                        'min-h-10 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                        period === p ? 'bg-button text-button-ink' : 'text-ink-soft hover:text-ink',
                      )}
                    >
                      {p === 'week' ? 'Tuần này' : p === 'month' ? 'Tháng này' : 'Năm nay'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <Clock className="size-3.5 text-gold-deep" />
                <span className="font-semibold text-gold-deep">{formatCountdown(board.endsAt)}</span>
                {scope === 'center' ? <span>• Sàn Top 3: ≥{board.minPodiumXp} EXP</span> : null}
              </div>
            </div>

            {scope === 'class' && !honor.className ? (
              <p className="mt-5 rounded-2xl bg-paper p-4 text-sm text-ink-soft">
                Bạn chưa được xếp vào lớp nào. Hãy theo dõi bảng Toàn Trung Tâm trong lúc chờ xếp lớp.
              </p>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {podium.map(({ place, entry, reward }) => (
                    <div
                      key={place}
                      className={cn(
                        'rounded-2xl border p-3.5 transition',
                        place === 1
                          ? 'border-warn/45 bg-warn-soft'
                          : place === 2
                            ? 'border-gold-deep/30 bg-paper'
                            : 'border-gold/40 bg-paper-2/70',
                        entry?.you && 'ring-2 ring-button',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-ink">
                          <Trophy className="size-3.5 text-warn" /> TOP {place}
                        </span>
                        <span className="text-sm font-extrabold text-gold-deep">
                          {entry ? `${entry.periodXp} EXP` : `≥${board.minPodiumXp} EXP`}
                        </span>
                      </div>

                      {entry ? (
                        <div className="mt-3 flex flex-col items-center text-center">
                          <AccountAvatar name={entry.name} url={entry.avatarUrl} frameId={entry.avatarFrame} className="size-[56px] text-base" />
                          <p className="mt-2 text-sm font-bold text-ink">
                            {entry.name} {entry.you ? '(Bạn)' : ''}
                          </p>
                          <p className="text-[13px] text-ink-soft">
                            {entry.className} • 🔥 {entry.streakDays}N
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 flex min-h-[92px] flex-col items-center justify-center rounded-xl border border-dashed border-gold/45 bg-cream/65 p-3 text-center">
                          <p className="text-xs font-semibold text-ink-soft">Đang chờ chủ nhân</p>
                          <p className="mt-0.5 text-[13px] text-ink-soft">Cần tối thiểu {board.minPodiumXp} EXP</p>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between rounded-xl border border-gold/25 bg-cream/90 px-2.5 py-1.5 text-[13px]">
                        <span className="inline-flex items-center gap-1 font-bold text-olive">
                          <Coins className="size-3 text-warn" /> +{reward.points}đ
                        </span>
                        <span className="truncate text-ink-soft">
                          {getFrameDef(reward.frameId).name} ({period === 'week' ? '7N' : 'Vĩnh viễn'})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {rest.length > 0 ? (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-gold/30">
                    <div className="grid grid-cols-[52px_1fr_auto] items-center bg-paper-2/80 px-4 py-2 text-xs font-semibold text-ink-soft">
                      <span>Hạng</span>
                      <span>Học viên & Chuỗi rèn luyện</span>
                      <span className="text-right">Tổng EXP kỳ</span>
                    </div>
                    <ul className="divide-y divide-gold/20 bg-cream">
                      {rest.map((row) => (
                        <li
                          key={`${row.place}-${row.name}`}
                          className={cn(
                            'grid grid-cols-[52px_1fr_auto] items-center gap-2 px-4 py-2.5',
                            row.you ? 'bg-teal-soft/50' : 'hover:bg-paper',
                          )}
                        >
                          <span className="text-sm font-bold text-ink-soft">#{row.place}</span>
                          <div className="flex min-w-0 items-center gap-3">
                            <AccountAvatar name={row.name} url={row.avatarUrl} frameId={row.avatarFrame} className="size-[38px] text-xs" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink">
                                {row.name} {row.you ? <span className="text-gold-deep">(Bạn)</span> : null}
                              </p>
                              <p className="truncate text-[13px] text-ink-soft">
                                {row.className ? `${row.className} • ` : ''}{row.rank.label} • 🔥 {row.streakDays} ngày (+{row.streakBonusXp})
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gold-deep">{row.periodXp} EXP</p>
                            <p className="text-xs text-ink-soft tabular-nums">{row.questionXp} câu đúng</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-paper p-4 text-center text-xs text-ink-soft">
                    {board.entries.length === 0
                      ? 'Chưa có học viên nào ghi nhận EXP trong kỳ này.'
                      : 'Hiện chưa có thêm học viên ngoài Top 3 trong bảng này.'}
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export function StaffHonorBoards({
  honor,
  period,
  onPeriodChange,
  canSettle = false,
  settlingKey = null,
  onEarlySettle,
}: {
  honor: StaffHonorDto
  period: HonorPeriod
  onPeriodChange: (p: HonorPeriod) => void
  canSettle?: boolean
  settlingKey?: string | null
  onEarlySettle?: (scope: HonorScope, classId?: string) => void
}) {
  if (!honor.enabled) {
    return <p className="rounded-2xl bg-paper p-4 text-sm text-ink-soft">Bảng vinh danh đang tắt.</p>
  }
  const center = honor.center[period]

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">
            +{XP_PER_CORRECT} EXP mỗi câu đúng lần đầu • Tự động chốt Tuần (Thứ Hai), Tháng (01) & Năm (01/01)
          </p>
          <h2 className="serif mt-1 text-2xl">Bảng xếp hạng học viên</h2>
        </div>
        <div className="flex max-w-full flex-wrap rounded-xl border border-gold/40 bg-paper p-1">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => onPeriodChange(p)}
              className={cn(
                'min-h-10 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                period === p ? 'bg-button text-button-ink' : 'text-ink-soft hover:text-ink',
              )}
            >
              {p === 'week' ? 'Tuần này' : p === 'month' ? 'Tháng này' : 'Năm nay'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {honor.classes.length === 0 ? (
          <StaffBoardCard title="Vinh danh trong lớp" hint="Lớp bạn được giao">
            <p className="rounded-2xl bg-paper p-4 text-sm text-ink-soft">Bạn chưa được giao lớp nào. Bảng tổng vẫn hiện bên cạnh.</p>
          </StaffBoardCard>
        ) : (
          honor.classes.map((room) => {
            const b = room.boards[period]
            const key = `class:${room.classId}`
            return (
              <StaffBoardCard
                key={room.classId}
                title={room.className}
                hint={`${b.participants} học viên có EXP • ${formatCountdown(b.endsAt)}`}
                action={
                  canSettle ? (
                    <Button
                      type="button"
                      variant="navy"
                      className="shrink-0 px-3 py-1 text-xs"
                      disabled={settlingKey === key}
                      onClick={() => onEarlySettle?.('class', room.classId)}
                    >
                      {settlingKey === key ? 'Đang chốt…' : 'Chốt thưởng sớm'}
                    </Button>
                  ) : null
                }
              >
                {b.entries.length === 0 ? (
                  <p className="rounded-2xl bg-paper p-4 text-sm text-ink-soft">Chưa có học viên nào có EXP kỳ này.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {b.entries.slice(0, 10).map((row) => (
                      <StaffEntryRow key={`${row.place}-${row.name}`} row={row} />
                    ))}
                  </ul>
                )}
              </StaffBoardCard>
            )
          })
        )}

        <StaffBoardCard
          title="Bảng xếp hạng Toàn Trung Tâm"
          hint={`Top 3 cần tối thiểu ${center.minPodiumXp} EXP • ${formatCountdown(center.endsAt)}`}
          action={
            canSettle ? (
              <Button
                type="button"
                variant="navy"
                className="shrink-0 px-3 py-1 text-xs"
                disabled={settlingKey === 'center'}
                onClick={() => onEarlySettle?.('center')}
              >
                {settlingKey === 'center' ? 'Đang chốt…' : 'Chốt thưởng sớm'}
              </Button>
            ) : null
          }
        >
          {center.entries.length === 0 ? (
            <p className="rounded-2xl bg-paper p-4 text-sm text-ink-soft">Kỳ này chưa có học viên nào hoàn thành bài.</p>
          ) : (
            <ul className="space-y-2.5">
              {center.entries.slice(0, 10).map((row) => (
                <StaffEntryRow key={`${row.className}-${row.place}-${row.name}`} row={row} showClass />
              ))}
            </ul>
          )}
        </StaffBoardCard>
      </div>
    </section>
  )
}

function StaffBoardCard({ title, hint, action, children }: { title: string; hint: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="serif text-xl">{title}</h3>
          <p className="mt-1 text-xs text-ink-soft">{hint}</p>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function StaffEntryRow({ row, showClass = false }: { row: HonorEntryDto; showClass?: boolean }) {
  return (
    <li className={cn('flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5', row.yours ? 'bg-button-soft' : 'bg-paper')}>
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('w-8 text-center text-sm font-bold', row.place <= 3 ? 'text-warn' : 'text-ink-soft')}>#{row.place}</span>
        <AccountAvatar name={row.name} url={row.avatarUrl} frameId={row.avatarFrame} className="size-10 text-xs" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.name}</p>
          <p className="truncate text-xs text-ink-soft">
            {showClass && row.className ? `${row.className} • ` : ''}
            {row.periodXp} EXP ({row.questionXp} câu + {row.streakBonusXp} Streak)
          </p>
        </div>
      </div>
      <RankBadge rank={row.rank} size={26} />
    </li>
  )
}
