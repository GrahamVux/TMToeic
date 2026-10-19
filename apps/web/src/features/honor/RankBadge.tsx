import { HONOR_PODIUM, type HonorRankDto } from '@toeic/shared'

/** Original shield in the rank color. Not a copy of any game artwork. */
export function RankBadge({ rank, size = 36 }: { rank: HonorRankDto; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2" title={rank.label}>
      <Shield color={rank.color} ink={rank.ink} size={size} mark={rank.tier === 'Thách Đấu' ? 'star' : rank.tier === 'Cao Thủ' ? 'flame' : 'gem'} />
      <span className="text-sm font-semibold" style={{ color: rank.ink === '#FFFFFF' ? rank.color : rank.ink }}>
        {rank.label}
      </span>
    </span>
  )
}

export function PodiumMark({ place }: { place: number }) {
  const podium = HONOR_PODIUM.find((item) => item.place === place)
  if (!podium) return <span className="w-8 text-center text-sm font-semibold text-ink/45">{place}</span>
  return (
    <span className="inline-flex items-center gap-2" title={`Hạng ${place} • ${podium.title}`}>
      <Shield color={podium.color} ink={podium.ink} size={42} mark={place === 1 ? 'star' : place === 2 ? 'flame' : 'gem'} />
      <span className="text-xs font-bold tracking-wide" style={{ color: podium.ink === '#FFFFFF' ? podium.color : podium.ink }}>
        {podium.title}
      </span>
    </span>
  )
}

function Shield({ color, ink, size, mark }: { color: string; ink: string; size: number; mark: 'star' | 'flame' | 'gem' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 3 42 10v14c0 10.5-7.2 17.8-18 21C13.2 41.8 6 34.5 6 24V10L24 3z" fill={color} stroke={ink} strokeWidth="1.5" />
      <path d="M24 8 37 13v9.5c0 7.6-5.2 13-13 15.4C16.2 35.5 11 30.1 11 22.5V13L24 8z" fill="none" stroke={ink} strokeOpacity="0.35" />
      {mark === 'star' ? <polygon points="24,14 26.4,20.2 33,20.6 27.8,24.8 29.5,31.2 24,27.6 18.5,31.2 20.2,24.8 15,20.6 21.6,20.2" fill={ink} /> : null}
      {mark === 'flame' ? <path d="M24 14c2 4 6 5 6 10a6 6 0 0 1-12 0c0-2 1.2-3.2 2-4.5.4 1.6 1.4 2.2 2 2.2 0-3 1-5.2 2-7.7z" fill={ink} /> : null}
      {mark === 'gem' ? <polygon points="24,15 32,22 24,33 16,22" fill={ink} /> : null}
    </svg>
  )
}
