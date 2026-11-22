import { accountImageSrc } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useState } from 'react'

export function AccountAvatar({ name, url, className = 'size-9 text-xs' }: { name: string; url?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const words = name.trim().normalize('NFC').split(/\s+/)
  const initials = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)
  return (
    <span aria-hidden="true" className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-teal-soft font-bold text-gold-deep', className)}>
      {url && url !== failed ? (
        <img src={accountImageSrc(url)} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(url)} />
      ) : initials.toLocaleUpperCase('vi') || '?'}
    </span>
  )
}
