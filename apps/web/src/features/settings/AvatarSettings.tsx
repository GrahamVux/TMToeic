import { useAuth } from '@/app/AuthContext'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Primitives'
import { api, apiUpload } from '@/lib/api'
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, type AccountAvatarDto } from '@toeic/shared'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'

export function AvatarSettings() {
  const { user, viewing, avatarChanged } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const change = useMutation({
    mutationFn: (file: File | null) => file
      ? apiUpload<AccountAvatarDto>('/me/avatar', file, file.type || 'application/octet-stream')
      : api<AccountAvatarDto>('/me/avatar', { method: 'DELETE' }),
    onSuccess: (result) => {
      avatarChanged(result)
      setMessage(result.avatarUrl ? 'Đã cập nhật ảnh đại diện.' : 'Đã gỡ ảnh đại diện.')
    },
    onError: (err) => setError(err.message),
  })

  function save(file: File | null) {
    setError('')
    setMessage('')
    if (file && (file.size > AVATAR_MAX_BYTES || (file.type && !AVATAR_MIME_TYPES.some((mime) => mime === file.type)))) {
      setError('Vui lòng chọn ảnh JPG, PNG hoặc WebP tối đa 4 MB.')
      return
    }
    change.mutate(file)
  }

  if (!user) return null
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-4">
        <AccountAvatar name={user.fullName} url={user.avatarUrl} className="size-16 text-xl" />
        <div>
          <h2 className="font-semibold">Ảnh đại diện</h2>
          <p className="mt-1 text-xs text-ink/60">JPG, PNG hoặc WebP, tối đa 4 MB. Ảnh được cắt vuông từ giữa.</p>
          {!viewing && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input ref={input} type="file" hidden accept={AVATAR_MIME_TYPES.join(',')} onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) save(file)
              }} />
              <Button type="button" disabled={change.isPending} onClick={() => input.current?.click()}>{user.avatarUrl ? 'Đổi ảnh' : 'Chọn ảnh'}</Button>
              {user.avatarUrl && <Button type="button" variant="ghost" disabled={change.isPending} onClick={() => save(null)}>Gỡ ảnh</Button>}
            </div>
          )}
        </div>
      </div>
      <p role="status" className="empty:hidden mt-3 text-sm text-ink/70">{change.isPending ? 'Đang lưu ảnh…' : message}</p>
      {error && <p role="alert" className="mt-3 text-sm text-coral">{error}</p>}
    </Card>
  )
}

export function StaffProfilePage() {
  const { user } = useAuth()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="serif text-3xl">Tài khoản cá nhân</h1>
        <p className="mt-1 text-sm text-ink/60">{user?.fullName} · {user?.username}</p>
      </header>
      <AvatarSettings />
    </div>
  )
}
