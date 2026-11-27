import { useId, useEffect, useState } from 'react'
import { skyFrame, type SkyBody } from './sky'

type SkyPoint = readonly [number, number]

/** Twelve small zodiac figures, one in each cell of an even 4×3 sky grid. */
const SHAPES: readonly (readonly SkyPoint[])[][] = [
  [[[0, 6], [5, 1], [10, 6]], [[5, 1], [6, 8], [2, 12]]],
  [[[1, 8], [4, 3], [8, 2], [12, 6]], [[4, 3], [3, 10], [8, 12]]],
  [[[1, 1], [1, 12]], [[0, 6], [4, 6]], [[8, 2], [8, 13]], [[6, 7], [11, 7]]],
  [[[1, 3], [6, 8], [11, 3]], [[6, 8], [6, 13]]],
  [[[1, 5], [4, 1], [8, 4], [6, 7], [10, 9], [13, 6]]],
  [[[2, 1], [2, 13]], [[2, 6], [7, 4], [9, 8]], [[2, 11], [6, 13]]],
  [[[1, 7], [6, 2], [11, 7]], [[3, 7], [9, 7]], [[4, 7], [4, 12]], [[8, 7], [8, 12]]],
  [[[1, 3], [4, 7], [7, 4], [10, 8], [13, 6], [12, 11], [8, 13]]],
  [[[1, 11], [6, 4], [12, 9]], [[6, 4], [9, 1]], [[4, 8], [9, 6]]],
  [[[1, 4], [5, 2], [9, 6], [7, 10], [3, 12], [9, 13]]],
  [[[0, 4], [3, 7], [6, 4], [9, 7], [12, 4]], [[0, 9], [3, 12], [6, 9], [9, 12], [12, 9]]],
  [[[1, 2], [4, 7], [2, 12]], [[11, 2], [8, 7], [10, 12]], [[4, 7], [8, 7]]],
]

const SLOTS: readonly SkyPoint[] = [
  [5, 3], [29, 3], [53, 3], [77, 3],
  [5, 37], [29, 37], [53, 37], [77, 37],
  [5, 71], [29, 71], [53, 71], [77, 71],
]

const FIGURES: SkyPoint[][] = SHAPES.flatMap((shape, index) => {
  const [ox, oy] = SLOTS[index] ?? [0, 0]
  return shape.map((line) => line.map(([x, y]) => [ox + x, oy + y] as const))
})

const DUST: SkyPoint[] = Array.from({ length: 48 }, (_, index) => {
  const col = index % 8
  const row = Math.floor(index / 8)
  return [4 + col * 12 + (row % 2) * 5, 5 + row * 15] as const
})

/** Ordinary stars, separate from the constellation points. The third value is how widely each one glows. */
const GLOW_STARS: readonly (readonly [number, number, number])[] = [
  [14, 20, 1],
  [27, 8, 0.55],
  [46, 18, 0.8],
  [63, 26, 0.65],
  [84, 16, 0.9],
  [8, 46, 0.6],
  [22, 58, 1],
  [40, 44, 0.7],
  [58, 52, 0.85],
  [74, 40, 0.6],
  [90, 48, 0.75],
  [16, 78, 0.85],
  [36, 86, 0.6],
  [52, 74, 1],
  [70, 82, 0.7],
  [88, 70, 0.55],
  [33, 30, 0.5],
  [78, 58, 0.8],
]

const CRATERS = [
  [30, 36, 6.2],
  [78, 32, 4.8],
  [96, 58, 5.4],
  [52, 78, 5],
  [18, 66, 3.8],
  [26, 34, 2.4],
  [40, 22, 1.5],
  [58, 28, 2],
  [74, 22, 1.3],
  [90, 34, 2.2],
  [104, 48, 1.6],
  [22, 52, 1.4],
  [36, 48, 1.1],
  [50, 44, 1.8],
  [66, 40, 1.2],
  [82, 50, 2.6],
  [98, 62, 1.5],
  [18, 70, 1.7],
  [34, 66, 1.2],
  [48, 62, 2.1],
  [64, 70, 1.4],
  [78, 76, 2.3],
  [94, 82, 1.3],
  [28, 86, 1.6],
  [46, 84, 1.1],
  [60, 92, 1.9],
  [76, 96, 1.2],
  [88, 18, 1],
  [14, 44, 1],
  [70, 58, 1.3],
  [54, 74, 1],
] as const

const SUN_RAYS = [-62, -34, -8, 18, 46, 74, 150, 200, 250]
const MOON_RAYS = [-48, -12, 24, 58, 120, 190, 240]

/** Full-page sky, or a small preview when `embedded`. Sun and moon sit in opposite outer corners. */
export function SkyBackdrop({ embedded = false }: { embedded?: boolean }) {
  const [frame, setFrame] = useState(() => skyFrame())
  const moonId = useId().replace(/:/g, '')

  useEffect(() => {
    const id = window.setInterval(() => setFrame(skyFrame()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const disc = embedded ? '5.25rem' : 'min(12.75rem, 19vw)'
  const star = 0.5 + frame.moon.lift * 0.45
  const sunLocalX = (frame.sun.x / 58) * 100
  const moonAt = ((frame.moon.x - 42) / 58) * 100

  return (
    <div
      className={embedded ? 'sky-backdrop absolute inset-0 overflow-hidden' : 'sky-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden'}
      aria-hidden="true"
      style={{
        background: `linear-gradient(90deg, ${frame.sunSide} 0%, ${frame.sunSide} 38%, ${frame.moonSide} 62%, ${frame.moonSide} 100%)`,
        ['--sky-disc' as string]: disc,
      }}
    >
      <Half
        side="left"
        background={`radial-gradient(ellipse 70% 62% at ${sunLocalX}% ${frame.sun.y}%, rgba(255, 214, 110, ${0.42 + frame.sunGlow * 0.28}) 0%, rgba(255, 196, 80, ${0.16 + frame.sunGlow * 0.12}) 32%, transparent 62%)`}
      />
      <Half
        side="right"
        background={`radial-gradient(ellipse 70% 62% at ${moonAt}% ${frame.moon.y}%, rgba(186, 220, 255, ${0.4 + frame.moonGlow * 0.28}) 0%, rgba(120, 176, 235, ${0.14 + frame.moonGlow * 0.12}) 32%, transparent 62%)`}
      />
      <StarChart shine={star} />
      <Sun body={frame.sun} glow={frame.sunGlow} />
      <Moon body={frame.moon} glow={frame.moonGlow} highlight={frame.moonHighlight} id={moonId} />
    </div>
  )
}

function StarChart({ shine }: { shine: number }) {
  const stars = FIGURES.flatMap((figure, figureIndex) => figure.map(([x, y], index) => ({ x, y, bright: index % 2 === 0, delay: figureIndex * 0.4 + index * 0.25 })))
  return (
    <>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {FIGURES.map((figure, index) => (
          <polyline
            key={index}
            points={figure.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={`rgba(78, 132, 184, ${0.22 + shine * 0.2})`}
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {stars.map((star, index) => (
        <Flare key={`flare-${index}`} x={star.x} y={star.y} bright={star.bright} shine={shine} delay={star.delay} />
      ))}
      {GLOW_STARS.map(([x, y, scale]) => (
        <GlowStar key={`g-${x}-${y}`} x={x} y={y} scale={scale} shine={shine} />
      ))}
      {DUST.map(([x, y], index) => (
        <span
          key={`d-${x}-${y}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x}%`, top: `${y}%`, width: index % 4 === 0 ? 2.4 : 1.6, height: index % 4 === 0 ? 2.4 : 1.6, backgroundColor: '#ffffff', opacity: 0.8 + shine * 0.2, boxShadow: '0 0 6px 2px rgba(255, 248, 220, 0.95), 0 0 12px 3px rgba(150, 198, 255, 0.55)' }}
        />
      ))}
    </>
  )
}

function GlowStar({ x, y, scale, shine }: { x: number; y: number; scale: number; shine: number }) {
  const halo = 8 + scale * 14
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: 3 + scale * 2.5,
        height: 3 + scale * 2.5,
        backgroundColor: '#ffffff',
        opacity: 0.9,
        boxShadow: `0 0 ${halo * 0.35}px ${halo * 0.2}px rgba(255, 252, 240, ${0.85 + shine * 0.1}), 0 0 ${halo}px ${halo * 0.45}px rgba(255, 214, 120, ${0.35 + shine * 0.2}), 0 0 ${halo * 1.4}px ${halo * 0.7}px rgba(130, 186, 255, ${0.28 + shine * 0.22})`,
      }}
    />
  )
}

function Flare({ x, y, bright, shine, delay }: { x: number; y: number; bright: boolean; shine: number; delay: number }) {
  const size = bright ? 18 : 11
  return (
    <svg
      viewBox="-12 -12 24 24"
      className="sky-twinkle absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, opacity: shine, ['--star' as string]: String(shine), animationDelay: `${delay}s`, filter: 'drop-shadow(0 0 2px rgba(186, 220, 255, 0.95))' }}
    >
      <path d="M0-11 L0.45-0.45 L11 0 L0.45 0.45 L0 11 L-0.45 0.45 L-11 0 L-0.45-0.45 Z" fill="rgba(232, 246, 255, 0.92)" />
      <path d="M0-5.5 L0.7-0.7 L5.5 0 L0.7 0.7 L0 5.5 L-0.7 0.7 L-5.5 0 L-0.7-0.7 Z" fill="white" />
      <circle r="1.05" fill="white" />
    </svg>
  )
}

function Half({ side, background }: { side: 'left' | 'right'; background: string }) {
  const mask = side === 'left' ? 'linear-gradient(90deg, #000 0%, #000 64%, transparent 100%)' : 'linear-gradient(270deg, #000 0%, #000 64%, transparent 100%)'
  return (
    <div
      className={side === 'left' ? 'absolute inset-y-0 left-0 w-[58%]' : 'absolute inset-y-0 right-0 w-[58%]'}
      style={{ background, maskImage: mask, WebkitMaskImage: mask }}
    />
  )
}

function Rays({ angles, color }: { angles: number[]; color: string }) {
  return (
    <>
      {angles.map((deg) => (
        <span key={deg} className="absolute inset-0" style={{ transform: `rotate(${deg}deg)` }}>
          <span
            className="absolute top-1/2 left-1/2 h-[8%] w-[120%] -translate-y-1/2 rounded-full"
            style={{ background: `linear-gradient(90deg, ${color} 0%, transparent 82%)`, filter: 'blur(3px)' }}
          />
        </span>
      ))}
    </>
  )
}

function Sun({ body, glow }: { body: SkyBody; glow: number }) {
  return (
    <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${body.x}%`, top: `${body.y}%`, width: 'var(--sky-disc)', height: 'var(--sky-disc)' }}>
      <Rays angles={SUN_RAYS} color={`rgba(255, 206, 92, ${0.18 + glow * 0.16})`} />
      <span
        className="absolute left-1/2 top-1/2 h-[148%] w-[148%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, rgba(255, 246, 206, ${0.34 + glow * 0.16}) 0%, rgba(255, 220, 130, ${0.1 + glow * 0.08}) 36%, transparent 62%)` }}
      />
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle at 36% 34%, #fffef8 0%, #fff4c4 24%, #ffe08a 56%, #f8d06a 100%)',
          boxShadow: `0 0 16px 4px rgba(255, 214, 120, ${0.18 + glow * 0.16}), inset 0 0 14px rgba(255, 255, 245, 0.7)`,
        }}
      />
    </span>
  )
}

function Moon({
  body,
  glow,
  highlight,
  id,
}: {
  body: SkyBody
  glow: number
  highlight: { x: number; y: number }
  id: string
}) {
  const shadeX = 100 - highlight.x
  const shadeY = 100 - highlight.y
  return (
    <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${body.x}%`, top: `${body.y}%`, width: 'var(--sky-disc)', height: 'var(--sky-disc)' }}>
      <Rays angles={MOON_RAYS} color={`rgba(198, 220, 255, ${0.16 + glow * 0.16})`} />
      <span
        className="absolute left-1/2 top-1/2 h-[146%] w-[146%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, rgba(244, 248, 255, ${0.3 + glow * 0.16}) 0%, rgba(186, 210, 242, ${0.08 + glow * 0.08}) 38%, transparent 62%)` }}
      />
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full" style={{ filter: `drop-shadow(0 0 8px rgba(198, 218, 245, ${0.2 + glow * 0.16}))` }}>
        <defs>
          <clipPath id={`${id}-clip`}>
            <circle cx="60" cy="60" r="59" />
          </clipPath>
          <radialGradient id={`${id}-ground`} cx="40%" cy="36%" r="70%">
            <stop offset="0%" stopColor="#f5f8fc" />
            <stop offset="55%" stopColor="#d7e1ee" />
            <stop offset="100%" stopColor="#c3d0e2" />
          </radialGradient>
          <radialGradient id={`${id}-lit`} cx={`${highlight.x}%`} cy={`${highlight.y}%`} r="68%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
            <stop offset="46%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-shade`} cx={`${shadeX}%`} cy={`${shadeY}%`} r="62%">
            <stop offset="0%" stopColor="#3e5470" stopOpacity="0.34" />
            <stop offset="58%" stopColor="#6d84a3" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#6d84a3" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-dust`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.72  0 0 0 0 0.84  0 0 0 0.55 0" result="tint" />
            <feBlend in="SourceGraphic" in2="tint" mode="multiply" />
          </filter>
        </defs>
        <g clipPath={`url(#${id}-clip)`}>
          <g filter={`url(#${id}-dust)`}>
            <circle cx="60" cy="60" r="60" fill={`url(#${id}-ground)`} />
            <path d="M18 44c14-10 34-6 42 8 4 8-2 18-14 24-16 8-30 4-36-6-4-8-2-18 8-26z" fill="#6d86a4" opacity="0.8" />
            <path d="M64 58c12-4 26 4 28 16 2 14-12 22-26 18-12-4-18-12-16-20 2-6 8-12 14-14z" fill="#627892" opacity="0.75" />
          </g>
          {CRATERS.map(([cx, cy, r]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r={r} fill="#e6eef6" />
              <circle cx={cx + r * 0.16} cy={cy + r * 0.18} r={r * 0.72} fill="#5d7694" />
              <path
                d={`M ${cx - r * 0.7} ${cy - r * 0.2} A ${r * 0.9} ${r * 0.9} 0 0 1 ${cx + r * 0.35} ${cy - r * 0.75}`}
                fill="none"
                stroke="#f7fbff"
                strokeWidth={Math.max(0.35, r * 0.18)}
                strokeLinecap="round"
              />
            </g>
          ))}
          <circle cx="60" cy="60" r="60" fill={`url(#${id}-shade)`} />
          <circle cx="60" cy="60" r="60" fill={`url(#${id}-lit)`} />
        </g>
        <circle cx="60" cy="60" r="58.4" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4" />
      </svg>
    </span>
  )
}
