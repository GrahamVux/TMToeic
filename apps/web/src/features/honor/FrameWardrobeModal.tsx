import { useAuth } from '@/app/AuthContext'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Primitives'
import { cn } from '@/lib/cn'
import { AVATAR_FRAMES, getFrameDef, type FrameCategory, type PointLedgerSource } from '@toeic/shared'
import { Check, Clock, Coins, Gift, Lock, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useEquipFrame, useMyRewards } from './honor.queries'

const CATEGORY_TABS: Array<{ id: 'ALL' | FrameCategory; label: string }> = [
  { id: 'ALL', label: `Tất cả (${AVATAR_FRAMES.length})` },
  { id: 'FREE', label: 'Miễn phí' },
  { id: 'CENTER_TOP', label: 'Top Trung Tâm' },
  { id: 'CLASS_TOP', label: 'Top Lớp' },
  { id: 'STREAK', label: 'Mốc Streak' },
  { id: 'STAFF', label: 'Staff / Admin' },
]

function expiryLabel(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Đã hết hạn'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.max(1, Math.floor((ms % 86_400_000) / 3_600_000))
  return days > 0 ? `Còn ${days} ngày ${hours} giờ` : `Còn ${hours} giờ`
}

function sourceBadge(source: PointLedgerSource): string {
  if (source === 'AUTO_WEEK') return 'Chốt Tuần'
  if (source === 'AUTO_MONTH') return 'Chốt Tháng'
  if (source === 'STREAK') return 'Streak'
  return 'Admin'
}

export function FrameWardrobeModal({
  open,
  initialTab = 'frames',
  onClose,
}: {
  open: boolean
  initialTab?: 'frames' | 'wallet'
  onClose: () => void
}) {
  const { user, viewing, frameChanged } = useAuth()
  const rewards = useMyRewards(open && Boolean(user))
  const equip = useEquipFrame()
  const [cat, setCat] = useState<'ALL' | FrameCategory>('ALL')
  const [tab, setTab] = useState<'frames' | 'wallet'>(initialTab)
  const [previewFrameId, setPreviewFrameId] = useState(user?.avatarFrame ?? 'none')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setPreviewFrameId(user?.avatarFrame ?? 'none')
      setError('')
    }
  }, [open, initialTab, user?.avatarFrame])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !user) return null

  const unlockedMap = new Map((rewards.data?.unlockedFrames ?? []).map((u) => [u.frameId, u]))
  const equippedFrameId = rewards.data?.avatarFrame ?? user.avatarFrame ?? 'none'
  const points = rewards.data?.rewardPoints ?? user.rewardPoints ?? 0
  const ledger = rewards.data?.ledger ?? []
  const isStaff = user.role === 'ADMIN' || user.role === 'TEACHER'

  const activeDef = getFrameDef(previewFrameId)
  const unlockInfo = unlockedMap.get(previewFrameId)
  const isUnlocked = isStaff || Boolean(unlockInfo)
  const previewExpiry = unlockInfo ? expiryLabel(unlockInfo.expiresAt) : null
  const visibleFrames = AVATAR_FRAMES.filter((f) => cat === 'ALL' || f.category === cat)

  async function handleEquip(frameId: string) {
    if (viewing) return
    setError('')
    try {
      const res = await equip.mutateAsync(frameId)
      frameChanged(res.avatarFrame)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đổi được khung viền.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kho khung viền và ví điểm thưởng"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gold/45 bg-cream shadow-[0_24px_70px_rgba(30,51,60,0.28)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/30 bg-paper px-6 py-4">
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 text-gold-deep" />
            <div>
              <h2 className="serif text-xl">Kho Khung Viền & Ví Điểm Thưởng</h2>
              <p className="text-xs text-ink-soft">Khung đang đeo sẽ hiển thị đồng bộ trên thanh điều hướng, bảng xếp hạng và hồ sơ tài khoản.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng hộp thoại"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-ink/12 bg-cream text-ink-soft transition hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex overflow-x-auto border-b border-gold/25 bg-cream px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setTab('frames')}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-button/50',
              tab === 'frames' ? 'border-button text-gold-deep' : 'border-transparent text-ink-soft hover:text-ink',
            )}
          >
            Bộ sưu tập Khung viền ({AVATAR_FRAMES.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('wallet')}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-button/50',
              tab === 'wallet' ? 'border-button text-gold-deep' : 'border-transparent text-ink-soft hover:text-ink',
            )}
          >
            <Coins className="size-4 text-amber-500" />
            Ví điểm thưởng ({points.toLocaleString('vi-VN')} điểm)
          </button>
        </div>

        {rewards.error ? (
          <div className="mx-4 mt-4 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger sm:mx-6" role="alert">
            Không tải được dữ liệu ví điểm và khung viền.
          </div>
        ) : null}

        {tab === 'frames' ? (
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[260px_1fr]">
            <Card className="flex flex-col items-center justify-between bg-paper p-4 text-center">
              <div className="w-full">
                <Badge tone={isUnlocked ? 'teal' : 'paper'}>{isUnlocked ? 'Đã mở khóa' : 'Chưa mở khóa'}</Badge>
                <div className="my-3.5 flex justify-center">
                  <AccountAvatar name={user.fullName} url={user.avatarUrl} frameId={previewFrameId} className="size-[84px] text-2xl" />
                </div>
                <h3 className="serif text-base">{activeDef.name}</h3>
                <p className="mt-0.5 text-xs font-semibold text-gold-deep">
                  {activeDef.badgeLabel} • {activeDef.durationHint}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{activeDef.unlockCondition}</p>
                {previewExpiry ? (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-xl border border-warn/25 bg-warn-soft px-2.5 py-1 text-[13px] font-medium text-warn">
                    <Clock className="size-3.5 shrink-0" />
                    {previewExpiry}
                  </p>
                ) : null}
              </div>

              <div className="mt-3.5 w-full space-y-2 border-t border-gold/25 pt-3">
                <p className="text-[13px] text-ink-soft">Xem thử trên thanh tài khoản:</p>
                <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-cream py-1 pr-3 pl-1.5 shadow-2xs">
                  <AccountAvatar name={user.fullName} url={user.avatarUrl} frameId={previewFrameId} className="size-[30px] text-[12px]" />
                  <span className="max-w-[140px] truncate text-xs font-semibold">{user.fullName}</span>
                </div>
                {error ? <p role="alert" className="text-xs text-coral">{error}</p> : null}
                {viewing ? (
                  <p className="text-[13px] text-ink-soft">Chế độ xem thử không cho phép đổi khung.</p>
                ) : isUnlocked ? (
                  <Button
                    type="button"
                    className="mt-2 w-full"
                    disabled={equip.isPending || equippedFrameId === previewFrameId}
                    onClick={() => void handleEquip(previewFrameId)}
                  >
                    {equip.isPending ? 'Đang lưu…' : equippedFrameId === previewFrameId ? 'Đang đeo khung này' : 'Đeo khung viền này'}
                  </Button>
                ) : (
                  <Button type="button" variant="navy" className="mt-2 w-full" disabled>
                    <Lock className="size-3.5" /> Hoàn thành điều kiện để mở
                  </Button>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_TABS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCat(c.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      cat === c.id ? 'border-button bg-button text-button-ink' : 'border-gold/35 bg-cream text-ink-soft hover:bg-teal-soft',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {rewards.isPending ? <p className="text-xs text-ink-soft">Đang tải danh sách khung đã mở…</p> : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {visibleFrames.map((f) => {
                  const u = unlockedMap.get(f.id)
                  const unlocked = isStaff || Boolean(u)
                  const equipped = equippedFrameId === f.id
                  const selected = previewFrameId === f.id
                  const expText = u ? expiryLabel(u.expiresAt) : null
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPreviewFrameId(f.id)}
                      className={cn(
                        'relative flex flex-col items-center rounded-2xl border px-3 pt-7 pb-3 text-center transition',
                        selected ? 'border-button bg-teal-soft/55 ring-2 ring-button/25' : 'border-gold/30 bg-cream hover:border-gold-deep/50',
                        !unlocked && 'opacity-75',
                      )}
                    >
                      {equipped ? (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-olive px-2 py-0.5 text-[12px] font-bold text-white">
                          <Check className="size-3" /> Đang dùng
                        </span>
                      ) : !unlocked ? (
                        <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-ink/10 text-ink-soft">
                          <Lock className="size-3" />
                        </span>
                      ) : expText ? (
                        <span className="absolute top-2 right-2 rounded-full bg-warn-soft px-1.5 py-0.5 text-[12px] font-bold text-warn">
                          {expText}
                        </span>
                      ) : null}

                      <AccountAvatar name={user.fullName} url={user.avatarUrl} frameId={f.id} className="size-[56px] text-sm" />
                      <span className="mt-2 line-clamp-2 text-xs leading-tight font-semibold text-ink">{f.name}</span>
                      <span className="mt-0.5 text-[12px] text-ink-soft">{f.badgeLabel}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 overflow-y-auto p-6 md:grid-cols-[280px_1fr]">
            <Card className="bg-paper p-5">
              <p className="text-xs font-semibold tracking-wider text-gold-deep uppercase">Số dư tích lũy</p>
              <p className="serif mt-2 text-4xl text-ink">{points.toLocaleString('vi-VN')}</p>
              <p className="text-xs text-ink-soft">Điểm thưởng vinh danh</p>
              <div className="mt-5 rounded-2xl border border-dashed border-gold-deep/40 bg-cream p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gold-deep">
                  <Gift className="size-4" /> Cửa hàng Đổi quà
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  Tính năng đổi quà, tài liệu VIP và voucher bằng Điểm thưởng đang được chuẩn bị. Điểm của bạn được ghi nhận và bảo lưu đầy đủ!
                </p>
                <Badge tone="gold" className="mt-3">Đổi quà sắp mở</Badge>
              </div>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">Lịch sử biến động điểm</h3>
                <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                  <ShieldCheck className="size-3.5 text-olive" /> Tự động chốt theo kỳ & Streak
                </span>
              </div>
              {rewards.isPending ? (
                <p className="text-xs text-ink-soft">Đang tải lịch sử điểm…</p>
              ) : !rewards.error && ledger.length === 0 ? (
                <p className="rounded-2xl border border-gold/30 bg-cream p-4 text-sm text-ink-soft">
                  Chưa có giao dịch điểm thưởng nào. Đạt Top 3 Tuần/Tháng hoặc các mốc Streak để nhận điểm!
                </p>
              ) : (
                <ul className="divide-y divide-gold/25 rounded-2xl border border-gold/30 bg-cream">
                  {ledger.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{item.reason}</p>
                        <p className="text-xs text-ink-soft">
                          {sourceBadge(item.source)} • {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdAt))}
                        </p>
                      </div>
                      <span className={cn('shrink-0 text-sm font-bold', item.delta >= 0 ? 'text-olive' : 'text-coral')}>
                        {item.delta >= 0 ? `+${item.delta}` : item.delta} điểm
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
