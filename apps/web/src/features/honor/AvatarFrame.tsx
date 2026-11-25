import { accountImageSrc } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useId, useState } from 'react'

type FramedAvatarProps = {
  name: string
  url?: string | null
  frameId?: string | null
  size?: number
  className?: string
}

/**
 * Crisp vector SVG frame rendered around the account avatar.
 * Scales cleanly from 28px header pills to 88px podium cards with zero external image assets.
 */
export function FramedAvatar({ name, url, frameId = 'none', size = 40, className }: FramedAvatarProps) {
  const [failed, setFailed] = useState<string | null>(null)
  const words = name.trim().normalize('NFC').split(/\s+/)
  const initials = words.length > 1 ? words[0]![0]! + words[words.length - 1]![0]! : words[0]!.slice(0, 2)
  const hasFrame = Boolean(frameId && frameId !== 'none')
  const innerSize = hasFrame ? Math.round(size * 0.78) : size
  const fontSize = Math.max(10, Math.round(innerSize * 0.34))

  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-grid shrink-0 place-items-center select-none', className)}
      style={{ width: size, height: size }}
    >
      <span
        className="inline-grid place-items-center overflow-hidden rounded-full bg-teal-soft font-bold text-gold-deep"
        style={{ width: innerSize, height: innerSize, fontSize }}
      >
        {url && url !== failed ? (
          <img
            src={url.startsWith('data:') || url.startsWith('http') ? url : accountImageSrc(url)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            onError={() => setFailed(url)}
          />
        ) : (
          initials.toLocaleUpperCase('vi') || '?'
        )}
      </span>
      {hasFrame ? <FrameSvg frameId={frameId!} /> : null}
    </span>
  )
}

export function FrameSvg({ frameId }: { frameId: string }) {
  const uid = useId().replace(/:/g, '')
  const g1 = `fg1-${uid}`
  const g2 = `fg2-${uid}`

  switch (frameId) {
    case 'mint-ring':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1f7a8c" />
              <stop offset="50%" stopColor="#56c2d6" />
              <stop offset="100%" stopColor="#185f6e" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="43" fill="none" stroke={`url(#${g1})`} strokeWidth="4.2" />
          <circle cx="50" cy="50" r="47" fill="none" stroke="#9fe0ec" strokeWidth="1.2" strokeDasharray="6 4" />
        </svg>
      )

    case 'dawn-compass':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <circle cx="50" cy="50" r="43" fill="none" stroke="#3a6f7c" strokeWidth="3.5" />
          <circle cx="50" cy="50" r="46.5" fill="none" stroke="#b9e4ec" strokeWidth="1.4" />
          <polygon points="50,1 53.5,8 46.5,8" fill="#1f7a8c" />
          <polygon points="50,99 53.5,92 46.5,92" fill="#1f7a8c" />
          <polygon points="1,50 8,46.5 8,53.5" fill="#4aa8b8" />
          <polygon points="99,50 92,46.5 92,53.5" fill="#4aa8b8" />
        </svg>
      )

    case 'scholar-olive':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <circle cx="50" cy="50" r="43" fill="none" stroke="#2f856e" strokeWidth="3.8" />
          <path d="M20,76 C9,60 9,38 22,22" fill="none" stroke="#52b79a" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M80,76 C91,60 91,38 78,22" fill="none" stroke="#52b79a" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="50" cy="93" r="4.5" fill="#2f856e" stroke="#e6f7f2" strokeWidth="1.5" />
        </svg>
      )

    case 'class-top1':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="5" />
          <circle cx="50" cy="50" r="48" fill="none" stroke="#fef08a" strokeWidth="1.3" />
          <polygon points="50,1 53.5,8.5 61.5,9.2 55.5,14.4 57.3,22 50,17.8 42.7,22 44.5,14.4 38.5,9.2 46.5,8.5" fill="#facc15" stroke="#854d0e" strokeWidth="1.4" />
        </svg>
      )

    case 'class-top2':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="4.8" />
          <polygon points="50,2 56,9 50,16 44,9" fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />
        </svg>
      )

    case 'class-top3':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="50%" stopColor="#d97736" />
              <stop offset="100%" stopColor="#7c2d12" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="4.8" />
          <polygon points="44,4 56,4 58,12 50,16 42,12" fill="#ea9359" stroke="#7c2d12" strokeWidth="1.4" />
        </svg>
      )

    case 'center-top1':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-[0_0_6px_rgba(234,179,8,0.45)]">
          <defs>
            <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
            <linearGradient id={g2} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="none" stroke="#fde047" strokeOpacity="0.55" strokeWidth="1.8" strokeDasharray="5 3" />
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="5.8" />
          <path d="M12,66 C4,50 8,30 19,18" fill="none" stroke={`url(#${g2})`} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M88,66 C96,50 92,30 81,18" fill="none" stroke={`url(#${g2})`} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M35,11 L39,1 L46,8 L50,-2 L54,8 L61,1 L65,11 Z" fill="#facc15" stroke="#78350f" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="50" cy="6" r="2" fill="#ef4444" />
          <polygon points="50,89 55,95 50,101 45,95" fill="#facc15" stroke="#78350f" strokeWidth="1.3" />
        </svg>
      )

    case 'center-top2':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-[0_0_5px_rgba(225,29,72,0.38)]">
          <defs>
            <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="50%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="47.5" fill="none" stroke="#fda4af" strokeOpacity="0.6" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="5.4" />
          <path d="M11,56 L4,45 L12,37" fill="none" stroke="#fb7185" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M89,56 L96,45 L88,37" fill="none" stroke="#fb7185" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <polygon points="50,0 57,9 50,16 43,9" fill="#fb7185" stroke="#881337" strokeWidth="1.5" />
        </svg>
      )

    case 'center-top3':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-[0_0_5px_rgba(14,165,233,0.38)]">
          <defs>
            <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="50%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#0c4a6e" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="47.5" fill="none" stroke="#7dd3fc" strokeOpacity="0.65" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="5.2" />
          <polygon points="50,1 57,8 54,15 46,15 43,8" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="1.5" />
        </svg>
      )

    case 'streak-7':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={g1} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#c2410c" />
              <stop offset="60%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fdba74" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="4.8" />
          <path d="M50,84 C54,88 57,91 55,96 C53,99 47,99 45,96 C43,91 46,88 50,84 Z" fill="#f97316" stroke="#7c2d12" strokeWidth="1.3" />
        </svg>
      )

    case 'streak-30':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-[0_0_5px_rgba(234,88,12,0.4)]">
          <defs>
            <linearGradient id={g1} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#991b1b" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fde047" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="5.5" />
          <circle cx="50" cy="50" r="48" fill="none" stroke="#fdba74" strokeWidth="1.3" strokeDasharray="8 4" />
          <path d="M50,0 C55,6 59,10 56,16 C53,19 47,19 44,16 C41,10 45,6 50,0 Z" fill="#facc15" stroke="#9a3412" strokeWidth="1.4" />
          <path d="M12,68 C6,56 7,42 15,30" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
          <path d="M88,68 C94,56 93,42 85,30" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )

    case 'streak-100':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-[0_0_6px_rgba(13,148,136,0.42)]">
          <defs>
            <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="none" stroke="#5eead4" strokeWidth="1.6" />
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="5.5" />
          <polygon points="50,-1 55,8 64,8 57,14 59,22 50,17 41,22 43,14 36,8 45,8" fill="#2dd4bf" stroke="#115e59" strokeWidth="1.4" />
        </svg>
      )

    case 'staff-mentor':
      return (
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="50%" stopColor="#1d4ed8" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${g1})`} strokeWidth="5" />
          <circle cx="50" cy="50" r="47.5" fill="none" stroke="#facc15" strokeWidth="1.5" />
          <polygon points="50,1 58,7 55,15 45,15 42,7" fill="#facc15" stroke="#1e3a8a" strokeWidth="1.5" />
        </svg>
      )

    default:
      return null
  }
}
