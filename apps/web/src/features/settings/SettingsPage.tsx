import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { ChangePasswordForm } from '@/features/auth/PasswordFields'
import { Card } from '@/components/ui/Primitives'
import { useDashboard, useSetGoal } from '@/features/dashboard/dashboard.queries'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink/55">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-gold-deep' : 'bg-ink/15')}
      >
        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  )
}

const fieldCls =
  'mt-1 h-10 w-full rounded-xl border border-gold/40 bg-white px-3 text-sm text-ink outline-none focus:border-gold-deep focus:ring-2 focus:ring-gold-deep/20'

export function SettingsPage() {
  const { hash } = useLocation()
  const { user, changePassword } = useAuth()
  const isStudent = user?.role === 'STUDENT'
  const dashboard = useDashboard(isStudent)
  const setGoal = useSetGoal()
  // Slider position; null = no goal. Starts from the saved goal, edits are local until "Lưu mục tiêu".
  const savedGoal = user?.targetScore ?? null
  const [target, setTarget] = useState<number | null>(savedGoal)
  const [saved, setSaved] = useState(false)
  const latest = dashboard.data?.latestScore?.totalScore ?? null
  const dirty = target !== savedGoal

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [hash])

  async function saveGoal() {
    setSaved(false)
    try {
      await setGoal.mutateAsync(target)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch {
      // error text is rendered from setGoal.error
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs text-ink/50">Trang chủ / Cài đặt cá nhân</p>
        <h1 className="serif mt-2 text-3xl">Cài đặt cá nhân</h1>
        <p className="mt-1 text-sm text-ink/60">Quản lý thông tin, mục tiêu điểm số và nhắc học của bạn.</p>
      </header>

      <Card className="scroll-mt-24 p-6" >
        <h2 className="text-base font-semibold">Thông tin cá nhân</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink/60">
            Họ và tên
            <input className={cn(fieldCls, 'bg-paper-2 text-ink/60')} value={user?.fullName ?? ''} readOnly />
          </label>
          <label className="text-xs font-medium text-ink/60">
            Mã học viên
            <input className={cn(fieldCls, 'bg-paper-2 text-ink/60')} value={user?.studentCode ?? user?.username ?? ''} readOnly />
          </label>
          <label className="text-xs font-medium text-ink/60">
            Email
            <input className={cn(fieldCls, 'bg-paper-2 text-ink/60')} type="email" value={user?.email ?? 'Chưa cập nhật'} readOnly />
          </label>
          <label className="text-xs font-medium text-ink/60">
            Số điện thoại
            <input className={cn(fieldCls, 'bg-paper-2 text-ink/60')} value={user?.phone ?? 'Chưa cập nhật'} readOnly />
          </label>
        </div>
      </Card>

      <Card className="scroll-mt-24 p-6">
        <div id="security" className="scroll-mt-24">
          <h2 className="text-base font-semibold">Đổi mật khẩu</h2>
          <p className="mt-1 mb-4 text-xs text-ink/55">Sau khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</p>
          <div className="max-w-md">
            <ChangePasswordForm onSubmit={changePassword} />
          </div>
        </div>
      </Card>

      {isStudent ? (
        <Card className="scroll-mt-24 p-6">
          <div id="goal" className="scroll-mt-24">
            <h2 className="text-base font-semibold">Mục tiêu điểm số</h2>
            <p className="mt-1 text-xs text-ink/55">
              {target === null
                ? 'Bạn chưa đặt mục tiêu. Kéo thanh trượt để chọn điểm TOEIC mong muốn.'
                : latest === null
                  ? 'Chưa có điểm thi thử đủ 200 câu để so sánh với mục tiêu.'
                  : `Điểm gần nhất: ${latest} • Còn ${Math.max(0, target - latest)} điểm để đạt mục tiêu.`}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <input
                type="range"
                min={400}
                max={990}
                step={5}
                value={target ?? 800}
                aria-label="Điểm mục tiêu"
                onChange={(e) => setTarget(Number(e.target.value))}
                className={cn('h-2 flex-1 accent-[#2b8a9c]', target === null && 'opacity-50')}
              />
              <span className="w-20 rounded-xl bg-teal-soft py-1.5 text-center text-lg font-bold text-gold-deep">{target ?? 'Chưa đặt'}</span>
            </div>
            {setGoal.error ? (
              <p className="mt-3 text-sm text-coral" role="alert">
                {setGoal.error instanceof ApiError ? setGoal.error.message : 'Không lưu được mục tiêu.'}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-3">
              {saved ? <span className="text-sm text-olive">Đã lưu mục tiêu ✓</span> : null}
              {target !== null ? (
                <Button variant="ghost" disabled={setGoal.isPending} onClick={() => setTarget(null)}>Bỏ mục tiêu</Button>
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
          <p className="mt-1 text-xs text-ink/55">Tính năng nhắc học qua email sẽ có ở bản sau; hiện chưa có thông báo nào được gửi.</p>
          <div className="mt-2 divide-y divide-gold/20 opacity-60">
            <Toggle disabled checked={false} onChange={() => {}} label="Nhắc ôn từ vựng mỗi ngày" hint="Gửi lúc 20:00 nếu chưa hoàn thành flashcard." />
            <Toggle disabled checked={false} onChange={() => {}} label="Nhắc hạn nộp bài tập" hint="Báo trước 24 giờ khi bài tập sắp hết hạn." />
            <Toggle disabled checked={false} onChange={() => {}} label="Báo cáo tiến độ hằng tuần" hint="Tóm tắt điểm số và bảng vinh danh qua email." />
          </div>
        </div>
      </Card>
    </div>
  )
}
