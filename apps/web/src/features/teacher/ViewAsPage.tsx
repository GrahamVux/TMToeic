import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/ui/Button'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { Card } from '@/components/ui/Primitives'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError, api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useQuery } from '@tanstack/react-query'
import { homePathForRole, type Paginated, type UserDto } from '@toeic/shared'
import { Eye, GraduationCap, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Target = 'STUDENT' | 'TEACHER'

const TARGETS: { role: Target; label: string; icon: typeof GraduationCap; hint: string }[] = [
  { role: 'STUDENT', label: 'Góc nhìn học sinh', icon: GraduationCap, hint: 'Xem tổng quan, bài tập, tiến độ và sổ tay như học sinh đang thấy.' },
  { role: 'TEACHER', label: 'Góc nhìn giáo viên', icon: UserRound, hint: 'Xem menu và các trang đúng theo quyền đã cấp cho giáo viên.' },
]

function usePreviewable(role: Target, q: string) {
  return useQuery({
    queryKey: ['users', 'view-as', role, q] as const,
    queryFn: () => {
      const params = new URLSearchParams({ role, status: 'ACTIVE', pageSize: '30' })
      if (q) params.set('q', q)
      return api<Paginated<UserDto>>(`/users?${params}`)
    },
    placeholderData: (previous) => previous,
  })
}

function grantLabels(user: UserDto) {
  const g = user.permissions
  return [g.createStudents && 'Tạo học viên', g.manageAssignments && 'Kho đề & bài tập', g.viewProgress && 'Xem tiến độ'].filter(Boolean) as string[]
}

export function ViewAsPage() {
  const { startViewAs } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<Target>('STUDENT')
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const list = usePreviewable(role, q)
  const current = TARGETS.find((t) => t.role === role) ?? TARGETS[0]

  async function open(user: UserDto) {
    setError(null)
    setOpening(user.id)
    try {
      const target = await startViewAs(user.id)
      navigate(homePathForRole(target.role), { replace: true })
    } catch (err) {
      setOpening(null)
      setError(err instanceof ApiError ? err.message : 'Không mở được chế độ xem thử.')
    }
  }

  if (list.error && !list.data) return <QueryErrorRedirect error={list.error} />

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Quản trị</p>
        <h1 className="serif mt-2 text-3xl sm:text-4xl">Giả lập góc nhìn</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/60">
          Chọn một tài khoản để xem hệ thống đúng như người đó thấy. Chế độ này chỉ để xem: mọi thao tác lưu, nộp bài hay chỉnh sửa đều bị chặn nên dữ liệu thật không bị thay đổi. Mỗi lần mở đều được ghi vào nhật ký.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {TARGETS.map((t) => (
          <button
            key={t.role}
            type="button"
            aria-pressed={role === t.role}
            onClick={() => {
              setRole(t.role)
              setQ('')
            }}
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
              role === t.role ? 'border-gold-deep bg-teal-soft shadow-sm' : 'border-gold/30 bg-white hover:border-gold-deep/60',
            )}
          >
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', role === t.role ? 'bg-button text-button-ink' : 'bg-teal-soft text-gold-deep')}>
              <t.icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="mt-0.5 block text-[13px] text-ink/60">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const field = new FormData(event.currentTarget).get('q')
            setQ(typeof field === 'string' ? field.trim() : '')
          }}
        >
          <input
            key={role}
            name="q"
            className="h-10 min-w-0 flex-1 rounded-xl border border-ink/12 px-3 text-sm"
            placeholder={role === 'STUDENT' ? 'Tìm theo tên hoặc mã học viên' : 'Tìm theo tên hoặc tên đăng nhập'}
          />
          <Button type="submit" variant="navy">
            Tìm
          </Button>
        </form>

        {error ? <p className="mt-3 text-sm text-coral" role="alert">{error}</p> : null}

        <p className="mt-4 text-sm text-ink/55">
          {list.isPending ? 'Đang tải…' : `${list.data?.total ?? 0} ${role === 'STUDENT' ? 'học sinh' : 'giáo viên'} đang hoạt động`}
          {list.data && list.data.total > list.data.items.length ? ` · hiển thị ${list.data.items.length} đầu tiên, hãy tìm theo tên để thu hẹp` : ''}
        </p>

        <ul className="mt-2 divide-y divide-ink/8">
          {(list.data?.items ?? []).map((user) => {
            const grants = role === 'TEACHER' ? grantLabels(user) : []
            return (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <AccountAvatar name={user.fullName} url={user.avatarUrl} frameId={user.avatarFrame} /><span className="truncate">{user.fullName}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink/55">
                    {role === 'STUDENT' ? `Mã HV: ${user.studentCode ?? user.username}${user.className ? ` · Lớp ${user.className}` : ''}` : user.username}
                  </p>
                  {role === 'TEACHER' ? (
                    <p className="mt-1 text-xs text-ink/55">{grants.length ? grants.join(' · ') : 'Chưa được cấp quyền nào'}</p>
                  ) : null}
                </div>
                <Button type="button" disabled={opening !== null} onClick={() => void open(user)}>
                  <Eye className="size-4" />
                  {opening === user.id ? 'Đang mở…' : `Xem như ${role === 'STUDENT' ? 'học sinh' : 'giáo viên'}`}
                </Button>
              </li>
            )
          })}
        </ul>
        {list.data && list.data.items.length === 0 ? <p className="py-6 text-center text-sm text-ink/50">Không có tài khoản phù hợp với {current.label.toLowerCase()}.</p> : null}
      </Card>
    </div>
  )
}
