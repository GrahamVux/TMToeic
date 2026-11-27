import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { CornerNotice, flashError, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { DarkModeSwitch } from '@/components/ui/DarkModeSwitch'
import { ChangePasswordForm } from '@/features/auth/PasswordFields'
import { Card, Input } from '@/components/ui/Primitives'
import { useDashboard, useSetGoal } from '@/features/dashboard/dashboard.queries'
import { ThemeBackdrop } from '@/features/site/ThemeBackdrop'
import { useColorMode, useRawSite } from '@/features/site/SiteSettingsProvider'
import { useSetStudentTheme, useUpdateProfile } from '@/features/site/site.queries'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useNotifyPrefs, type NotifyKind } from '@/lib/notify-prefs'
import { GOAL_TRACK_BOUNDS, GOAL_TRACKS, THEME_PRESETS, formatGoal, remainingToGoal, resolveThemePreset, type GoalDto, type GoalTrack, type ThemePresetId } from '@toeic/shared'
import { Check, Lock, Palette, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AvatarSettings } from './AvatarSettings'

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-soft">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors after:absolute after:-inset-x-1 after:-inset-y-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-50',
          checked ? 'bg-button' : 'bg-ink/15',
        )}
      >
        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-button-ink shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  )
}

function scoreFor(track: GoalTrack, saved: GoalDto) {
  if (saved?.track === track) return saved.score
  return GOAL_TRACK_BOUNDS[track].defaultScore
}

function goalStatus(goal: GoalDto, latest: number | null) {
  const label = formatGoal(goal)
  if (!goal || !label) return 'Bạn chưa đặt mục tiêu.'
  if (goal.track === 'FOUR_SKILL') return `Mục tiêu ${label}. Điểm mock L&R (thang 990) không so sánh trực tiếp với tổng 4 kỹ năng.`
  if (latest === null) return `Mục tiêu ${label}. Chưa có điểm thi thử đủ 200 câu để so sánh.`
  const left = remainingToGoal(goal, latest) ?? 0
  if (left === 0) return `Điểm gần nhất: ${latest} • Đã đạt mục tiêu ${goal.score}.`
  return `Điểm gần nhất: ${latest} • Còn ${left} điểm để đạt mục tiêu.`
}

export function SettingsPage() {
  const { hash } = useLocation()
  const { user, viewing, changePassword, updateUser } = useAuth()
  const site = useRawSite()
  const { colorMode, toggleColorMode } = useColorMode()
  const isStudent = user?.role === 'STUDENT'
  const readOnlyPreview = Boolean(viewing)
  const dashboard = useDashboard(isStudent)
  const setGoal = useSetGoal()
  const saveProfile = useUpdateProfile()
  const setStudentTheme = useSetStudentTheme()
  const savedGoal = user?.goal ?? null
  const [track, setTrack] = useState<GoalTrack | null>(savedGoal?.track ?? null)
  const [scores, setScores] = useState({ TWO_SKILL: scoreFor('TWO_SKILL', savedGoal), FOUR_SKILL: scoreFor('FOUR_SKILL', savedGoal) })
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [notify, setNotify] = useNotifyPrefs()
  const latest = dashboard.data?.latestScore?.totalScore ?? null
  const currentGoal: GoalDto = track ? { track, score: scores[track] } : null
  const dirty = JSON.stringify(currentGoal) !== JSON.stringify(savedGoal)
  const profileDirty = fullName !== (user?.fullName ?? '') || email !== (user?.email ?? '') || phone !== (user?.phone ?? '')

  useEffect(() => {
    setFullName(user?.fullName ?? '')
    setEmail(user?.email ?? '')
    setPhone(user?.phone ?? '')
  }, [user?.fullName, user?.email, user?.phone])

  useEffect(() => {
    const g = user?.goal ?? null
    setTrack(g?.track ?? null)
    setScores({ TWO_SKILL: scoreFor('TWO_SKILL', g), FOUR_SKILL: scoreFor('FOUR_SKILL', g) })
  }, [user?.goal])

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [hash])

  async function submitProfile() {
    setProfileError(null)
    try {
      const res = await saveProfile.mutateAsync({ fullName, email, phone })
      updateUser(res.user)
      setNotice(flashNotice('Đã lưu thông tin.'))
    } catch (err) {
      setProfileError(err instanceof ApiError && err.status === 409 ? 'Email đã được dùng bởi tài khoản khác.' : 'Không lưu được thông tin. Kiểm tra họ tên, email và số điện thoại.')
    }
  }

  async function pickStudentTheme(presetId: ThemePresetId | null) {
    if (readOnlyPreview) return
    try {
      const res = await setStudentTheme.mutateAsync(presetId)
      updateUser(res.user)
      const label = presetId ? THEME_PRESETS.find((p) => p.id === presetId)?.label ?? presetId : 'Mặc định theo lớp học'
      setNotice(flashNotice(`Đã đổi giao diện sang “${label}”.`))
    } catch (err) {
      setNotice(flashError(err instanceof ApiError ? err.message : 'Chủ đề này không còn được mở hoặc không lưu được.'))
    }
  }

  async function saveGoal() {
    try {
      const goal = clampedGoal()
      if (goal) setScores((prev) => ({ ...prev, [goal.track]: goal.score }))
      await setGoal.mutateAsync(goal)
      setNotice(flashNotice('Đã lưu mục tiêu.'))
    } catch {
      // error text is rendered from setGoal.error
    }
  }

  function setKind(kind: NotifyKind, value: boolean) {
    setNotify({ ...notify, [kind]: value })
  }

  function clampedGoal(): GoalDto {
    if (!track) return null
    const b = GOAL_TRACK_BOUNDS[track]
    const score = Math.min(b.max, Math.max(b.min, Math.round(scores[track])))
    return { track, score }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CornerNotice notice={notice} />
      <header>
        <p className="text-xs text-ink-soft">Trang chủ / Cài đặt cá nhân</p>
        <h1 className="serif mt-2 text-3xl">Cài đặt cá nhân</h1>
        <p className="mt-1 text-sm text-ink-soft">Quản lý thông tin, mục tiêu điểm số và nhắc học của bạn.</p>
      </header>

      <AvatarSettings />
      {isStudent ? (
        <Card className="min-w-0 scroll-mt-24 p-4 sm:p-6">
          <div id="theme" className="min-w-0 scroll-mt-24">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                  <Palette className="size-4 text-gold-deep" />
                  Giao diện & Chủ đề
                </h2>
                <p className="mt-1 text-xs text-ink-soft">
                  Chọn cảnh nền học tập bạn thích trong danh sách Quản trị viên đang mở cho lớp.
                </p>
              </div>
              <div className="shrink-0 self-start sm:self-center">
                <DarkModeSwitch variant="labeled" checked={colorMode === 'dark'} onToggle={toggleColorMode} />
              </div>
            </div>

            {readOnlyPreview ? (
              <p className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-xs text-ink-soft">
                Đang ở chế độ xem thử (View-As) — không thể lưu thay đổi giao diện của học viên.
              </p>
            ) : null}

            {site.studentAllowedThemes.length === 0 ? (
              <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-gold/30 bg-paper px-4 py-3 text-xs text-ink-soft">
                <Lock className="size-4 shrink-0 text-gold-deep" />
                <span>
                  Quản trị viên hiện đang dùng giao diện đồng bộ toàn lớp (<strong>{resolveThemePreset(site.themePreset).label}</strong>).
                </span>
              </div>
            ) : (
              <div className="mt-4 grid min-w-0 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={readOnlyPreview || setStudentTheme.isPending}
                  onClick={() => void pickStudentTheme(null)}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                    !user?.themePreset
                      ? 'border-button bg-button-soft ring-2 ring-button/35'
                      : 'border-gold/35 bg-paper hover:border-gold-deep/60',
                  )}
                >
                  <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-cream text-gold-deep">
                    <Sparkles className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">Mặc định theo lớp học</span>
                    <span className="block truncate text-[11px] text-ink-soft">
                      {site.backgroundMode === 'sky'
                        ? 'Bầu trời theo giờ VN'
                        : site.backgroundMode === 'gradient'
                          ? resolveThemePreset(site.themePreset).label
                          : 'Nền đơn sắc chuẩn'}
                    </span>
                  </span>
                  {!user?.themePreset ? <Check className="size-4 shrink-0 text-gold-deep" /> : null}
                </button>

                {THEME_PRESETS.filter((p) => site.studentAllowedThemes.includes(p.id)).map((preset) => {
                  const selected = user?.themePreset === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={readOnlyPreview || setStudentTheme.isPending}
                      onClick={() => void pickStudentTheme(preset.id)}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                        selected
                          ? 'border-button bg-button-soft ring-2 ring-button/35'
                          : 'border-gold/35 bg-paper hover:border-gold-deep/60',
                      )}
                    >
                      <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-xl border border-ink/15 shadow-xs">
                        <ThemeBackdrop embedded presetOverride={preset.id} />
                        <span className="absolute right-1 bottom-0.5 text-xs drop-shadow">{preset.emoji}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{preset.label}</span>
                        <span className="block truncate text-[11px] text-ink-soft">{preset.subtitle}</span>
                      </span>
                      {selected ? <Check className="size-4 shrink-0 text-gold-deep" /> : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      ) : null}
      <Card className="scroll-mt-24 p-6">
        <h2 className="text-base font-semibold">Thông tin cá nhân</h2>
        <p className="mt-1 text-xs text-ink-soft">Bạn có thể tự cập nhật họ tên, email và số điện thoại. Mã học viên do lớp cấp, không đổi được.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink-soft">
            Họ và tên
            <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
          <label className="text-xs font-medium text-ink-soft">
            Mã học viên
            <input
              className="mt-1 h-10 w-full rounded-xl border border-gold/40 bg-paper-2 px-3 text-sm text-ink-soft outline-none focus:border-button focus:ring-2 focus:ring-button/30"
              value={user?.studentCode ?? user?.username ?? ''}
              readOnly
            />
          </label>
          <label className="text-xs font-medium text-ink-soft">
            Email
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Chưa cập nhật" autoComplete="email" />
          </label>
          <label className="text-xs font-medium text-ink-soft">
            Số điện thoại
            <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Chưa cập nhật" autoComplete="tel" />
          </label>
        </div>
        {profileError ? (
          <p className="mt-3 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            {profileError}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button disabled={!profileDirty || saveProfile.isPending} onClick={() => void submitProfile()}>
            {saveProfile.isPending ? 'Đang lưu…' : 'Lưu thông tin'}
          </Button>
        </div>
      </Card>

      <Card className="scroll-mt-24 p-6">
        <div id="security" className="scroll-mt-24">
          <h2 className="text-base font-semibold">Đổi mật khẩu</h2>
          <p className="mt-1 mb-4 text-xs text-ink-soft">Sau khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</p>
          <div className="max-w-md">
            <ChangePasswordForm hideSuccess onSubmit={changePassword} onDone={() => setNotice(flashNotice('Đã đổi mật khẩu thành công.'))} />
          </div>
        </div>
      </Card>

      {isStudent ? (
        <Card className="scroll-mt-24 p-6">
          <div id="goal" className="scroll-mt-24">
            <h2 className="text-base font-semibold">Mục tiêu điểm số</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Chọn 2 kỹ năng hoặc 4 kỹ năng (chỉ một nhóm), rồi kéo thanh để đặt một điểm mục tiêu.
            </p>
            <p className="mt-2 text-sm text-ink-soft">{goalStatus(currentGoal, latest)}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Nhóm mục tiêu">
              {GOAL_TRACKS.map((t) => {
                const b = GOAL_TRACK_BOUNDS[t]
                const selected = track === t
                return (
                  <label
                    key={t}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 focus-within:ring-2 focus-within:ring-button/40',
                      selected ? 'border-gold-deep bg-teal-soft/40' : 'border-gold/35 bg-cream',
                    )}
                  >
                    <input className="mt-1" type="radio" name="goal-track" checked={selected} onChange={() => setTrack(t)} />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{b.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{b.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            {track ? (
              <div className="mt-5 flex items-center gap-4">
                <input
                  type="range"
                  min={GOAL_TRACK_BOUNDS[track].min}
                  max={GOAL_TRACK_BOUNDS[track].max}
                  step={1}
                  value={scores[track]}
                  aria-label="Điểm mục tiêu"
                  onChange={(e) => setScores((prev) => ({ ...prev, [track]: Number(e.target.value) }))}
                  className="h-2 flex-1 accent-[var(--color-gold-deep)]"
                />
                <span className="w-20 shrink-0 rounded-xl bg-teal-soft py-1.5 text-center text-lg font-bold text-gold-deep tabular-nums">{scores[track]}</span>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-soft">Chọn một nhóm để kéo thanh điểm mục tiêu.</p>
            )}
            {setGoal.error ? (
              <p className="mt-3 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
                Không lưu được mục tiêu. Kiểm tra điểm trong thang của nhóm đã chọn.
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-3">
              {track !== null ? (
                <Button variant="ghost" disabled={setGoal.isPending} onClick={() => setTrack(null)}>
                  Bỏ mục tiêu
                </Button>
              ) : null}
              <Button disabled={!dirty || setGoal.isPending} onClick={() => void saveGoal()}>
                {setGoal.isPending ? 'Đang lưu…' : 'Lưu mục tiêu'}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="p-6">
        <div id="notify" className="scroll-mt-24">
          <h2 className="text-base font-semibold">Thông báo & nhắc học</h2>
          <p className="mt-1 text-xs text-ink-soft">Bật hoặc tắt từng loại nhắc trên icon chuông. Thay đổi có hiệu lực ngay.</p>
          <div className="mt-2 divide-y divide-gold/20">
            <Toggle checked={notify.overdue} onChange={(value) => setKind('overdue', value)} label="Bài tập quá hạn" hint="Hiện khi bài đã quá hạn nộp." />
            <Toggle checked={notify.dueSoon} onChange={(value) => setKind('dueSoon', value)} label="Bài sắp hết hạn" hint="Hiện khi bài còn dưới 24 giờ." />
            <Toggle checked={notify.inProgress} onChange={(value) => setKind('inProgress', value)} label="Bài đang làm dở" hint="Nhắc bài đã mở nhưng chưa nộp." />
            <Toggle checked={notify.vocab} onChange={(value) => setKind('vocab', value)} label="Thẻ từ đến hạn" hint="Nhắc thẻ trong kho từ và sổ tay cần ôn." />
          </div>
        </div>
      </Card>
    </div>
  )
}
