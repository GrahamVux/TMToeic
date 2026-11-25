import { FrameSvg } from '@/features/honor/AvatarFrame'
import { accountImageSrc } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useState } from 'react'

export function AccountAvatar({
  name,
  url,
  frameId,
  className = 'size-9 text-xs',
}: {
  name: string
  url?: string | null
  frameId?: string | null
  className?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const words = name.trim().normalize('NFC').split(/\s+/)
  const initials = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)
  const hasFrame = Boolean(frameId && frameId !== 'none')
  return (
    <span aria-hidden="true" className={cn('relative inline-grid shrink-0 place-items-center select-none', className)}>
      <span
        className={cn(
          'inline-grid place-items-center overflow-hidden rounded-full bg-teal-soft font-bold text-gold-deep',
          hasFrame ? 'size-[78%]' : 'size-full',
        )}
      >
        {url && url !== failed ? (
          <img src={accountImageSrc(url)} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(url)} />
        ) : initials.toLocaleUpperCase('vi') || '?'}
      </span>
      {hasFrame ? <FrameSvg frameId={frameId!} /> : null}
    </span>
  )
}
