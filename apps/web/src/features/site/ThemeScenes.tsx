import type { ConcreteThemePresetId } from '@toeic/shared'
import { useId } from 'react'

/**
 * Full-viewport illustrated background scenes originally redrawn in SVG from the user's
 * reference art in /img, with distinct Light and Dark artwork variants and gentle ambient motion.
 */
export function ThemeScene({ preset, dark, compact = false }: { preset: ConcreteThemePresetId; dark: boolean; compact?: boolean }) {
  const uid = useId().replace(/:/g, '')

  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full select-none"
      aria-hidden="true"
    >
      {renderScene(preset, dark, uid, compact)}
    </svg>
  )
}

function renderScene(preset: ConcreteThemePresetId, dark: boolean, uid: string, compact: boolean) {
  switch (preset) {
    case 'spring':
      return <SpringScene dark={dark} uid={uid} compact={compact} />
    case 'summer':
      return <SummerScene dark={dark} uid={uid} compact={compact} />
    case 'autumn':
      return <AutumnScene dark={dark} uid={uid} compact={compact} />
    case 'winter':
      return <WinterScene dark={dark} uid={uid} compact={compact} />
    case 'tet':
      return <TetScene dark={dark} uid={uid} compact={compact} />
    case 'liberation':
      return <LiberationScene dark={dark} uid={uid} compact={compact} />
    case 'national_day':
      return <NationalDayScene dark={dark} uid={uid} compact={compact} />
    case 'mid_autumn':
      return <MidAutumnScene dark={dark} uid={uid} compact={compact} />
    case 'halloween':
      return <HalloweenScene dark={dark} uid={uid} compact={compact} />
    case 'christmas':
      return <ChristmasScene dark={dark} uid={uid} compact={compact} />
    default:
      return <ClassicScene dark={dark} uid={uid} />
  }
}

/* ─── Reusable Motifs ─── */
function Blossom({ cx, cy, r, petal, center, stroke }: { cx: number; cy: number; r: number; petal: string; center: string; stroke?: string }) {
  return (
    <g transform={`translate(${cx},${cy})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx={0}
          cy={-r * 0.62}
          rx={r * 0.44}
          ry={r * 0.56}
          fill={petal}
          stroke={stroke}
          strokeWidth={stroke ? 1.2 : 0}
          transform={`rotate(${a})`}
        />
      ))}
      <circle r={r * 0.22} fill={center} />
    </g>
  )
}

function FivePointStar({ cx, cy, r, fill, stroke, strokeWidth = 0, opacity }: { cx: number; cy: number; r: number; fill: string; stroke?: string; strokeWidth?: number; opacity?: number | string }) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.39
    const angle = (-90 + i * 36) * (Math.PI / 180)
    pts.push(`${(cx + Math.cos(angle) * rad).toFixed(1)},${(cy + Math.sin(angle) * rad).toFixed(1)}`)
  }
  return <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" opacity={opacity} />
}

function Snowflakes({ count, dark, compact }: { count: number; dark: boolean; compact: boolean }) {
  const n = compact ? 10 : count
  return (
    <g className={compact ? undefined : 'theme-drift-down'}>
      {Array.from({ length: n }, (_, i) => {
        const x = ((i * 173) % 1400) + 20
        const y = ((i * 97) % 860) + 20
        const r = (i % 4) * 1.4 + 2.2
        return <circle key={i} cx={x} cy={y} r={r} fill={dark ? '#e0f2fe' : '#ffffff'} opacity={dark ? 0.65 : 0.82} />
      })}
    </g>
  )
}

function ClassicScene({ dark, uid }: { dark: boolean; uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={dark ? '#07131a' : '#dff5fa'} />
          <stop offset="55%" stopColor={dark ? '#0d222c' : '#eef9fc'} />
          <stop offset="100%" stopColor={dark ? '#0a1922' : '#e6f6f0'} />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
      <circle cx="1160" cy="180" r="145" fill={dark ? '#7dd3fc' : '#ffffff'} opacity={dark ? 0.14 : 0.72} />
      <circle cx="1160" cy="180" r="240" fill={dark ? '#38bdf8' : '#bae6fd'} opacity={dark ? 0.08 : 0.35} />
      <path d="M0 640 Q320 530 680 610 T1440 570 L1440 900 L0 900 Z" fill={dark ? '#11303d' : '#cbeaf0'} opacity="0.7" />
      <path d="M0 720 Q420 640 840 710 T1440 675 L1440 900 L0 900 Z" fill={dark ? '#153b4a' : '#b2dfe8'} opacity="0.85" />
    </g>
  )
}

/* 1. SPRING (from spring.jpg) — Warm sunlit sakura/peach blossom bough & misty mountains */
function SpringScene({ dark, uid, compact }: { dark: boolean; uid: string; compact: boolean }) {
  const petalMain = dark ? '#f472b6' : '#f9a8d4'
  const petalSoft = dark ? '#ec4899' : '#fbcfe8'
  const centerDot = dark ? '#fde047' : '#f59e0b'
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={dark ? '#1f1024' : '#f9d5df'} />
          <stop offset="52%" stopColor={dark ? '#3b1933' : '#fde8d8'} />
          <stop offset="100%" stopColor={dark ? '#1c1d2e' : '#fef3c7'} />
        </linearGradient>
        <radialGradient id={`${uid}-sun`} cx="82%" cy="18%" r="48%">
          <stop offset="0%" stopColor={dark ? '#f9a8d4' : '#fffbeb'} stopOpacity={dark ? 0.38 : 0.95} />
          <stop offset="45%" stopColor={dark ? '#be185d' : '#fed7aa'} stopOpacity={dark ? 0.16 : 0.5} />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
      <rect width="1440" height="900" fill={`url(#${uid}-sun)`} />
      {/* Distant misty hills & stream */}
      <path d="M0 560 Q280 420 610 510 T1240 430 L1440 460 L1440 900 L0 900 Z" fill={dark ? '#351b38' : '#e6b8c4'} opacity="0.52" />
      <path d="M0 680 Q460 580 860 660 T1440 620 L1440 900 L0 900 Z" fill={dark ? '#281533' : '#d89fb2'} opacity="0.6" />
      <path d="M470 900 C560 760 760 740 820 680 C760 715 580 710 420 900 Z" fill={dark ? '#4c5f8a' : '#d8e6f5'} opacity="0.6" />

      {/* Main sweeping dark branch */}
      <path
        d="M-20 190 Q240 240 490 275 T930 220 Q1050 185 1135 120"
        fill="none"
        stroke={dark ? '#1e0f18' : '#4a2c2a'}
        strokeWidth="22"
        strokeLinecap="round"
      />
      <path d="M260 245 Q380 175 495 95" fill="none" stroke={dark ? '#1e0f18' : '#4a2c2a'} strokeWidth="12" strokeLinecap="round" />
      <path d="M560 272 Q690 325 795 395" fill="none" stroke={dark ? '#1e0f18' : '#4a2c2a'} strokeWidth="10" strokeLinecap="round" />
      <path d="M900 225 Q975 140 960 65" fill="none" stroke={dark ? '#1e0f18' : '#4a2c2a'} strokeWidth="8" strokeLinecap="round" />

      {/* Peach blossoms along branch */}
      {[
        [135, 195, 42], [220, 255, 36], [310, 190, 48], [415, 130, 38], [470, 265, 44],
        [585, 290, 38], [670, 235, 50], [745, 345, 34], [835, 250, 44], [935, 185, 42],
        [1045, 165, 34], [975, 95, 30], [180, 120, 34], [380, 330, 36], [1280, 310, 36],
        [1365, 230, 44], [1340, 405, 32],
      ].map(([cx, cy, r], i) => (
        <Blossom key={i} cx={cx!} cy={cy!} r={r!} petal={i % 2 === 0 ? petalMain : petalSoft} center={centerDot} stroke={dark ? '#831843' : '#f472b6'} />
      ))}

      {/* Falling sakura petals */}
      {!compact && (
        <g className="theme-drift-down" opacity="0.88">
          {[
            [260, 450, 20], [520, 520, -15], [760, 470, 35], [1050, 540, -30], [1180, 660, 18],
            [630, 740, 42], [350, 790, -20], [920, 780, 10],
          ].map(([x, y, rot], i) => (
            <ellipse key={i} cx={x} cy={y} rx="12" ry="6" fill={petalMain} transform={`rotate(${rot} ${x} ${y})`} />
          ))}
        </g>
      )}
    </g>
  )
}

/* 2. SUMMER (from summer.jpg) — Sunset tropical sea, leaning coconut palm & coral hibiscus */
function SummerScene({ dark, uid, compact }: { dark: boolean; uid: string; compact: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={dark ? '#07162b' : '#1d6fa3'} />
          <stop offset="52%" stopColor={dark ? '#113254' : '#f4a261'} />
          <stop offset="100%" stopColor={dark ? '#1e2742' : '#ffe29a'} />
        </linearGradient>
        <linearGradient id={`${uid}-sea`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={dark ? '#082f49' : '#0284c7'} />
          <stop offset="55%" stopColor={dark ? '#0e7490' : '#06b6d4'} />
          <stop offset="100%" stopColor={dark ? '#155e75' : '#67e8f9'} />
        </linearGradient>
        <linearGradient id={`${uid}-sand`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark ? '#3f352c' : '#e7c9a9'} />
          <stop offset="100%" stopColor={dark ? '#231d18' : '#c69f79'} />
        </linearGradient>
      </defs>
      <rect width="1440" height="580" fill={`url(#${uid}-sky)`} />
      {/* Sun / Moon glow */}
      <circle cx="1180" cy="340" r="175" fill={dark ? '#bae6fd' : '#fff3b0'} opacity={dark ? 0.16 : 0.45} />
      <circle cx="1180" cy="340" r="68" fill={dark ? '#e0f2fe' : '#fff8dc'} opacity={dark ? 0.85 : 0.92} />
      {/* Warm clouds */}
      {!dark && (
        <g opacity="0.55">
          <ellipse cx="920" cy="240" rx="190" ry="26" fill="#ff9e64" />
          <ellipse cx="1090" cy="180" rx="140" ry="20" fill="#ffb870" />
          <ellipse cx="670" cy="295" rx="150" ry="18" fill="#fdba74" />
        </g>
      )}
      {dark && (
        <g fill="#ffffff" opacity="0.7" className={compact ? undefined : 'theme-twinkle'}>
          {[180, 420, 620, 840, 990, 1290].map((x, i) => (
            <circle key={x} cx={x} cy={65 + (i % 3) * 45} r={i % 2 === 0 ? 2.4 : 1.6} />
          ))}
        </g>
      )}
      {/* Distant green headland */}
      <path d="M0 440 Q260 365 540 505 L0 520 Z" fill={dark ? '#0f291e' : '#1b4332'} />
      <path d="M620 500 Q920 455 1120 510 L620 510 Z" fill={dark ? '#173832' : '#2d6a4f'} opacity="0.65" />
      {/* Turquoise ocean + foam */}
      <rect y="505" width="1440" height="175" fill={`url(#${uid}-sea)`} />
      <path d="M0 635 Q360 615 720 645 T1440 628 L1440 665 L0 665 Z" fill={dark ? '#38bdf8' : '#ffffff'} opacity={dark ? 0.25 : 0.72} />
      {/* Sandy beach */}
      <path d="M0 650 Q520 620 1440 675 L1440 900 L0 900 Z" fill={`url(#${uid}-sand)`} />

      {/* Leaning Coconut Palm from top-left */}
      <path d="M120 620 Q235 320 350 75" fill="none" stroke={dark ? '#281b12' : '#4a3222'} strokeWidth="26" strokeLinecap="round" />
      <g transform="translate(345,75)" fill={dark ? '#0f3322' : '#1b5e20'}>
        {[-150, -110, -65, -20, 25, 70, 130].map((deg) => (
          <path key={deg} d="M0 0 Q95 -28 210 22 Q105 18 0 10 Z" transform={`rotate(${deg})`} />
        ))}
      </g>

      {/* Hibiscus flowers cluster bottom-left */}
      <g>
        <path d="M0 640 Q180 655 310 900 L0 900 Z" fill={dark ? '#0b2919' : '#164a27'} />
        {[
          [115, 650, 72], [235, 780, 62], [85, 815, 68],
        ].map(([cx, cy, r], i) => (
          <g key={i}>
            <Blossom cx={cx!} cy={cy!} r={r!} petal={i === 1 ? '#fb7185' : '#fb923c'} center="#be123c" />
            <line x1={cx} y1={cy} x2={cx! + 26} y2={cy! - 26} stroke="#fde047" strokeWidth="4" strokeLinecap="round" />
            <circle cx={cx! + 26} cy={cy! - 26} r="5" fill="#fef08a" />
          </g>
        ))}
      </g>
    </g>
  )
}

/* 3. AUTUMN (from autumn.jpeg + khungAutumn.avif) — Golden tree-lined avenue + maple leaf frame */
function AutumnScene({ dark, uid, compact }: { dark: boolean; uid: string; compact: boolean }) {
  const leafColors = dark ? ['#b45309', '#9a3412', '#d97706', '#7c2d12'] : ['#f97316', '#ea580c', '#f59e0b', '#dc2626']
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark ? '#2c1208' : '#fef3c7'} />
          <stop offset="55%" stopColor={dark ? '#421a0c' : '#fed7aa'} />
          <stop offset="100%" stopColor={dark ? '#1c0d07' : '#d97706'} />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-bg)`} />
      {/* Sunlit avenue path */}
      <polygon points="560,900 685,480 755,480 880,900" fill={dark ? '#3b2720' : '#9ca3af'} opacity="0.82" />
      <polygon points="0,900 560,900 685,480 0,560" fill={dark ? '#4a1d0b' : '#c2410c'} opacity="0.68" />
      <polygon points="1440,900 880,900 755,480 1440,560" fill={dark ? '#43190a' : '#b45309'} opacity="0.7" />
      {/* Canopy */}
      <ellipse cx="320" cy="210" rx="440" ry="260" fill={leafColors[2]} opacity="0.72" />
      <ellipse cx="1120" cy="200" rx="460" ry="270" fill={leafColors[1]} opacity="0.75" />
      <ellipse cx="720" cy="120" rx="380" ry="180" fill={leafColors[0]} opacity="0.62" />
      {/* Tree trunks along avenue */}
      {[180, 320, 440, 540, 900, 1000, 1120, 1260].map((x, idx) => (
        <path
          key={x}
          d={`M${x} 760 Q${x + (x < 720 ? 18 : -18)} 520 ${x + (x < 720 ? 45 : -45)} 220`}
          fill="none"
          stroke={dark ? '#1c0f0a' : '#3e2723'}
          strokeWidth={idx % 2 === 0 ? 28 : 20}
          strokeLinecap="round"
        />
      ))}

      {/* Autumn leaf border inspired by khungAutumn.avif */}
      {[
        [65, 90, 28, 1.3], [140, 290, -20, 1.15], [75, 520, 35, 1.2], [115, 760, -15, 1.35],
        [1365, 110, -32, 1.35], [1310, 340, 25, 1.15], [1375, 580, -28, 1.25], [1315, 790, 18, 1.3],
      ].map(([x, y, rot, sc], i) => (
        <g key={i} transform={`translate(${x},${y}) rotate(${rot}) scale(${sc})`} className={compact ? undefined : 'theme-sway'}>
          <path d="M0 -48 C28 -32 38 6 0 46 C-38 6 -28 -32 0 -48 Z" fill={leafColors[i % leafColors.length]} />
          <line x1="0" y1="-40" x2="0" y2="54" stroke="#7c2d12" strokeWidth="2.5" />
          <line x1="0" y1="-10" x2="18" y2="-22" stroke="#7c2d12" strokeWidth="1.5" />
          <line x1="0" y1="6" x2="-18" y2="-8" stroke="#7c2d12" strokeWidth="1.5" />
        </g>
      ))}
    </g>
  )
}

/* 4. WINTER (from winter.jpg) — Snowy alpine house, pines, sun halo & robin */
function WinterScene({ dark, uid, compact }: { dark: boolean; uid: string; compact: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark ? '#091124' : '#c6ebfb'} />
          <stop offset="55%" stopColor={dark ? '#172546' : '#fde2e4'} />
          <stop offset="100%" stopColor={dark ? '#0f172a' : '#e0f2fe'} />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
      {/* Sun / Moon with soft concentric halos */}
      <circle cx="620" cy="195" r="190" fill="#ffffff" opacity={dark ? 0.08 : 0.22} />
      <circle cx="620" cy="195" r="130" fill="#ffffff" opacity={dark ? 0.12 : 0.35} />
      <circle cx="620" cy="195" r="78" fill={dark ? '#e2e8f0' : '#ffffff'} opacity="0.92" />

      {/* Layered snowy mountains */}
      <path d="M0 530 L260 360 L540 500 L820 350 L1140 490 L1440 390 L1440 900 L0 900 Z" fill={dark ? '#1e3a5f' : '#8ecae6'} opacity="0.78" />
      <path d="M0 640 Q360 540 760 640 T1440 600 L1440 900 L0 900 Z" fill={dark ? '#334155' : '#f1f5f9'} />
      <path d="M0 735 Q540 660 1440 760 L1440 900 L0 900 Z" fill={dark ? '#1e293b' : '#dbeafe'} />

      {/* Snow-covered pine trees */}
      {[
        [150, 580, 1.1], [240, 480, 1.35], [1230, 520, 1.5], [1340, 620, 1.0],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x},${y}) scale(${s})`}>
          <rect x="-12" y="20" width="24" height="120" fill={dark ? '#0f172a' : '#1e3a5f'} />
          <polygon points="0,-160 -95,40 95,40" fill={dark ? '#0c4a6e' : '#0369a1'} />
          <polygon points="0,-160 -48,-60 48,-60" fill={dark ? '#cbd5e1' : '#ffffff'} />
        </g>
      ))}

      {/* Cozy Red Cabin */}
      <g transform="translate(290,515)">
        <rect x="0" y="35" width="165" height="115" fill={dark ? '#991b1b' : '#c94c4c'} />
        <polygon points="-16,42 82,-30 180,42" fill={dark ? '#e2e8f0' : '#ffffff'} stroke={dark ? '#334155' : '#7dd3fc'} strokeWidth="5" />
        <rect x="28" y="68" width="42" height="44" rx="4" fill="#fef08a" stroke="#1e293b" strokeWidth="3" />
        <rect x="100" y="68" width="42" height="44" rx="4" fill="#fef08a" stroke="#1e293b" strokeWidth="3" />
      </g>

      {/* Little red robin on right */}
      <g transform="translate(1150,700)">
        <ellipse cx="0" cy="0" rx="22" ry="16" fill="#ef4444" />
        <circle cx="14" cy="-12" r="11" fill="#dc2626" />
        <polygon points="24,-13 34,-9 24,-6" fill="#f59e0b" />
      </g>

      <Snowflakes count={34} dark={dark} compact={compact} />
    </g>
  )
}

/* 5. TET (from Tet.webp) — Crimson gold New Year, hoa mai, bánh chưng & hanging lanterns */
function TetScene({ dark, uid, compact }: { dark: boolean; uid: string; compact: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark ? '#3b0712' : '#b91c1c'} />
          <stop offset="55%" stopColor={dark ? '#5c0c1b' : '#dc2626'} />
          <stop offset="100%" stopColor={dark ? '#2b080e' : '#991b1b'} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor="#fde047" stopOpacity={dark ? 0.25 : 0.42} />
          <stop offset="100%" stopColor="#991b1b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-bg)`} />
      <rect width="1440" height="900" fill={`url(#${uid}-glow)`} />
      {/* Gold border banner accent */}
      <rect x="460" y="0" width="520" height="900" fill="#ef4444" opacity="0.22" />

      {/* Traditional Silk Lanterns */}
      {[
        [180, 120], [1260, 120], [320, 75], [1120, 75],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y})`} className={compact ? undefined : 'theme-sway'}>
          <line x1="0" y1="-120" x2="0" y2="0" stroke="#fcd34d" strokeWidth="3" />
          <ellipse cx="0" cy="42" rx="34" ry="42" fill="#dc2626" stroke="#fbbf24" strokeWidth="4" />
          <rect x="-14" y="0" width="28" height="8" rx="3" fill="#f59e0b" />
          <rect x="-14" y="80" width="28" height="8" rx="3" fill="#f59e0b" />
          <line x1="0" y1="88" x2="0" y2="128" stroke="#fcd34d" strokeWidth="4" />
        </g>
      ))}

      {/* Apricot Blossom (Hoa Mai) boughs top-left & top-right */}
      <path d="M0 90 Q140 120 270 50" fill="none" stroke="#451a03" strokeWidth="10" strokeLinecap="round" />
      <path d="M1440 90 Q1300 125 1170 45" fill="none" stroke="#451a03" strokeWidth="10" strokeLinecap="round" />
      {[
        [70, 85, 28], [140, 55, 24], [210, 85, 26], [1220, 75, 28], [1310, 105, 26], [1380, 60, 30],
      ].map(([x, y, r], i) => (
        <Blossom key={i} cx={x!} cy={y!} r={r!} petal="#facc15" center="#ea580c" />
      ))}

      {/* Marigolds + Bánh Chưng at bottom corners */}
      {[120, 190, 260, 1180, 1250, 1320].map((cx, i) => (
        <g key={cx} transform={`translate(${cx},${i % 2 === 0 ? 820 : 845})`}>
          <circle r="44" fill="#15803d" opacity="0.65" />
          <circle r="34" fill="#facc15" />
          <circle r="20" fill="#f59e0b" />
        </g>
      ))}
      <g transform="translate(80,695) rotate(-8)">
        <rect width="92" height="72" rx="10" fill="#16a34a" stroke="#bbf7d0" strokeWidth="3" />
        <line x1="0" y1="36" x2="92" y2="36" stroke="#fef08a" strokeWidth="3" />
        <line x1="46" y1="0" x2="46" y2="72" stroke="#fef08a" strokeWidth="3" />
      </g>
      <g transform="translate(1255,685) rotate(8)">
        <rect width="92" height="72" rx="10" fill="#15803d" stroke="#bbf7d0" strokeWidth="3" />
        <line x1="0" y1="36" x2="92" y2="36" stroke="#fef08a" strokeWidth="3" />
        <line x1="46" y1="0" x2="46" y2="72" stroke="#fef08a" strokeWidth="3" />
      </g>
    </g>
  )
}

/* 6. LIBERATION 30/4 (from 30-4.jpg) — Festive flag, skyline, peach & apricot blossoms */
function LiberationScene({ dark, uid }: { dark: boolean; uid: string; compact: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark ? '#2b090e' : '#b91c1c'} />
          <stop offset="65%" stopColor={dark ? '#17152e' : '#ef4444'} />
          <stop offset="100%" stopColor={dark ? '#0f172a' : '#fef2f2'} />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
      {/* Sunburst rays */}
      <polygon points="720,420 120,0 420,0" fill="#fde047" opacity="0.08" />
      <polygon points="720,420 1020,0 1320,0" fill="#fde047" opacity="0.08" />
      {/* Stylized Waving Red Flag with Gold Star */}
      <path d="M520 85 Q640 45 760 85 T1000 80 L980 280 Q860 295 740 275 T510 285 Z" fill="#dc2626" stroke="#fbbf24" strokeWidth="4" />
      <FivePointStar cx={755} cy={182} r={58} fill="#fde047" />
      {/* City Skyline Silhouette */}
      <g fill={dark ? '#1e293b' : '#ffffff'} opacity={dark ? 0.55 : 0.35}>
        <rect x="60" y="610" width="90" height="290" rx="4" />
        <rect x="170" y="540" width="110" height="360" rx="4" />
        <rect x="300" y="650" width="95" height="250" rx="4" />
        <rect x="1060" y="620" width="90" height="280" rx="4" />
        <rect x="1170" y="530" width="120" height="370" rx="4" />
        <rect x="1310" y="640" width="85" height="260" rx="4" />
      </g>
      {/* Left peach blossoms & Right yellow apricot blossoms */}
      {[
        [95, 220, 32], [185, 275, 28], [65, 340, 26],
      ].map(([cx, cy, r], i) => (
        <Blossom key={`p-${i}`} cx={cx!} cy={cy!} r={r!} petal="#fbcfe8" center="#f43f5e" />
      ))}
      {[
        [1345, 210, 32], [1265, 270, 28], [1370, 330, 26],
      ].map(([cx, cy, r], i) => (
        <Blossom key={`y-${i}`} cx={cx!} cy={cy!} r={r!} petal="#fde047" center="#d97706" />
      ))}
    </g>
  )
}

/* 7. NATIONAL DAY 2/9 (from 2-9.jpg & 2-9.webp) — Silk waves, golden star & Vietnam S-shape */
function NationalDayScene({ dark, uid }: { dark: boolean; uid: string; compact: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={dark ? '#380909' : '#e11d48'} />
          <stop offset="55%" stopColor={dark ? '#1f0808' : '#b91c1c'} />
          <stop offset="100%" stopColor={dark ? '#0f172a' : '#7f1d1d'} />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-bg)`} />
      {/* Flowing diagonal sky & silk ribbons inspired by 2-9.webp */}
      <path d="M980 0 Q1220 120 1440 240 L1440 0 Z" fill={dark ? '#0284c7' : '#38bdf8'} opacity="0.32" />
      <path d="M0 780 Q520 680 960 800 T1440 730 L1440 900 L0 900 Z" fill="#fde047" opacity="0.16" />
      <path d="M0 120 Q420 260 880 120 T1440 210" fill="none" stroke="#fef08a" strokeWidth="6" opacity="0.28" />
      {/* Giant radiant 5-point Star left-center + outline star right */}
      <FivePointStar cx={190} cy={360} r={195} fill="#fde047" opacity="0.88" />
      <FivePointStar cx={1160} cy={220} r={115} fill="none" stroke="#fde047" strokeWidth={5} />
      <FivePointStar cx={1160} cy={220} r={85} fill="none" stroke="#fef08a" strokeWidth={2.5} />
      {/* Stylized S-shaped Vietnam Map Silhouette */}
      <path
        d="M720 145 C685 170 675 210 705 245 C740 285 735 325 715 365 C695 405 715 455 755 505 C795 555 815 620 785 690 C760 740 715 765 690 795 C730 805 785 775 815 725 C855 660 855 585 815 510 C780 445 760 390 775 335 C790 275 815 215 775 165 Z"
        fill="#fde047"
        opacity="0.82"
      />
      <circle cx="885" cy="495" r="7" fill="#fef08a" />
      <circle cx="910" cy="645" r="7" fill="#fef08a" />
    </g>
  )
}

/* 8. MID-AUTUMN (from trung-thu.jpg) — Glowing Full Moon, Milky Cloud Ribbon & Sky Lanterns */
function MidAutumnScene({ dark, uid, compact }: { dark: boolean; uid: string; compact: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark ? '#090d24' : '#172554'} />
          <stop offset="60%" stopColor={dark ? '#172047' : '#1d4ed8'} />
          <stop offset="100%" stopColor={dark ? '#0e1726' : '#38bdf8'} />
        </linearGradient>
        <radialGradient id={`${uid}-moon`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="65%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
      {/* Twinkling stars */}
      <g fill="#fef9c3" className={compact ? undefined : 'theme-twinkle'}>
        {[120, 290, 440, 610, 790, 960, 1340].map((x, i) => (
          <circle key={x} cx={x} cy={60 + (i % 4) * 55} r={i % 2 === 0 ? 3 : 2} opacity="0.85" />
        ))}
      </g>
      {/* Glowing Golden Moon */}
      <circle cx="1160" cy="240" r="220" fill="#fde047" opacity="0.14" />
      <circle cx="1160" cy="240" r="145" fill="#fde047" opacity="0.22" />
      <circle cx="1160" cy="240" r="98" fill={`url(#${uid}-moon)`} />

      {/* Swirling golden cloud ribbon like trung-thu.jpg */}
      <path d="M340 520 Q620 430 830 500 T1160 340" fill="none" stroke="#fde047" strokeWidth="18" strokeLinecap="round" opacity="0.25" />
      <path d="M360 545 Q650 470 860 530 T1180 375" fill="none" stroke="#fef08a" strokeWidth="6" strokeLinecap="round" opacity="0.45" />

      {/* Rolling hills */}
      <path d="M0 730 Q360 650 760 740 T1440 695 L1440 900 L0 900 Z" fill={dark ? '#0f172a' : '#fef08a'} opacity={dark ? 0.92 : 0.72} />

      {/* Floating Sky Lanterns & Star Lanterns */}
      <g className={compact ? undefined : 'theme-float'}>
        {[
          [820, 175, 28], [940, 310, 34], [690, 260, 22], [1345, 285, 24],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x},${y})`}>
            <path d={`M-${s! * 0.6} -${s} L${s! * 0.6} -${s} L${s! * 0.4} ${s! * 0.4} L-${s! * 0.4} ${s! * 0.4} Z`} fill="#fb923c" stroke="#fef08a" strokeWidth="2" />
            <circle cy={s! * 0.25} r={s! * 0.16} fill="#fef9c3" />
          </g>
        ))}
        <FivePointStar cx={380} cy={390} r={42} fill="#facc15" stroke="#dc2626" strokeWidth={4} />
      </g>
    </g>
  )
}

/* 9. HALLOWEEN — Light from halloweenLight.jpg (Amber Moon + Mansion + Jack-o'-lanterns), Dark from halloweenDark.jpg (Violet Moon + Cemetery) */
function HalloweenScene({ dark, uid, compact }: { dark: boolean; uid: string; compact: boolean }) {
  if (!dark) {
    return (
      <g>
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#140905" />
            <stop offset="48%" stopColor="#9a3412" />
            <stop offset="82%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <radialGradient id={`${uid}-moon`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="70%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#f59e0b" />
          </radialGradient>
        </defs>
        <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
        {/* Giant Orange-Gold Full Moon */}
        <circle cx="720" cy="410" r="290" fill="#fde047" opacity="0.16" />
        <circle cx="720" cy="410" r="225" fill={`url(#${uid}-moon)`} />
        {/* Haunted Mansion Silhouette */}
        <g fill="#0c0705">
          <polygon points="560,720 560,480 620,400 680,480 680,720" />
          <polygon points="665,720 665,360 725,250 785,360 785,720" />
          <polygon points="770,720 770,450 835,380 900,450 900,720" />
          <rect x="724" y="190" width="5" height="75" />
          <polygon points="729,192 775,204 729,218" />
        </g>
        {/* Glowing Warm Mansion Windows */}
        <g fill="#fbbf24">
          <rect x="605" y="510" width="28" height="44" rx="14" />
          <rect x="706" y="420" width="38" height="58" rx="19" />
          <rect x="706" y="520" width="38" height="62" rx="6" />
          <rect x="815" y="490" width="28" height="44" rx="14" />
        </g>
        {/* Bare Branches & Flying Bats */}
        <path d="M1380 820 Q1240 610 1120 420 M1220 580 Q1310 470 1390 360 M1170 490 Q1050 430 980 350" fill="none" stroke="#0c0705" strokeWidth="14" strokeLinecap="round" />
        <g fill="#0c0705" className={compact ? undefined : 'theme-float'}>
          <path d="M510 340 Q535 315 555 340 Q575 315 600 340 Q575 352 555 348 Q535 352 510 340 Z" />
          <path d="M840 285 Q875 250 905 285 Q935 250 970 285 Q935 302 905 296 Q875 302 840 285 Z" />
        </g>
        {/* Grass + Glowing Jack-o'-lanterns */}
        <rect y="750" width="1440" height="150" fill="#090504" />
        {[
          [190, 785, 68], [390, 815, 48], [1040, 815, 48], [1235, 785, 68],
        ].map(([x, y, r], idx) => (
          <g key={idx} transform={`translate(${x},${y})`}>
            <rect x="-7" y={-r! * 1.05} width="14" height={r! * 0.35} rx="4" fill="#15803d" />
            <ellipse rx={r} ry={r! * 0.8} fill="#140905" stroke="#ea580c" strokeWidth="3" />
            <polygon points={`${-r! * 0.45},${-r! * 0.15} ${-r! * 0.25},${-r! * 0.42} ${-r! * 0.08},${-r! * 0.15}`} fill="#fbbf24" />
            <polygon points={`${r! * 0.08},${-r! * 0.15} ${r! * 0.25},${-r! * 0.42} ${r! * 0.45},${-r! * 0.15}`} fill="#fbbf24" />
            <path d={`M${-r! * 0.48},${r! * 0.18} Q0,${r! * 0.58} ${r! * 0.48},${r! * 0.18} Q0,${r! * 0.35} ${-r! * 0.48},${r! * 0.18} Z`} fill="#f59e0b" />
          </g>
        ))}
      </g>
    )
  }

  /* DARK MODE HALLOWEEN (from halloweenDark.jpg) */
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#120520" />
          <stop offset="52%" stopColor="#4c1d6e" />
          <stop offset="100%" stopColor="#7e3f98" />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
      {/* Pale Misty Moon */}
      <circle cx="710" cy="255" r="140" fill="#f5d0fe" opacity="0.16" />
      <circle cx="710" cy="255" r="56" fill="#fae8ff" />
      {/* Layered purple graveyard silhouettes */}
      <path d="M0 640 Q360 560 720 620 T1440 590 L1440 900 L0 900 Z" fill="#2e1047" />
      {/* Graveyard Iron Fences & Crosses */}
      <g fill="#160724" stroke="#160724">
        <rect x="650" y="540" width="14" height="80" />
        <rect x="635" y="560" width="44" height="10" />
        <rect x="920" y="510" width="16" height="105" />
        <rect x="900" y="535" width="56" height="12" />
        <path d="M260 660 L520 640 M280 610 L280 680 M330 605 L330 680 M380 600 L380 680 M430 596 L430 680" strokeWidth="6" />
        <path d="M960 640 L1220 665 M985 595 L985 680 M1035 598 L1035 680 M1085 602 L1085 680 M1135 605 L1135 680" strokeWidth="6" />
      </g>
      {/* Gnarled framing trees on left & right */}
      <path d="M60 900 C95 620 40 380 180 120 M100 420 Q230 330 330 220" fill="none" stroke="#12041f" strokeWidth="42" strokeLinecap="round" />
      <path d="M1380 900 C1345 620 1400 380 1260 120 M1340 420 Q1210 330 1110 220" fill="none" stroke="#12041f" strokeWidth="42" strokeLinecap="round" />
      {/* Foreground hill + mysterious glowing purple eyes */}
      <path d="M0 785 Q420 715 740 775 T1440 745 L1440 900 L0 900 Z" fill="#0d0317" />
      <g fill="#e879f9" className={compact ? undefined : 'theme-twinkle'}>
        <circle cx="485" cy="795" r="7" />
        <circle cx="515" cy="795" r="7" />
        <circle cx="1175" cy="805" r="8" />
        <circle cx="1210" cy="805" r="8" />
      </g>
    </g>
  )
}

/* 10. CHRISTMAS — Light from bright platformer snowy town .avif, Dark from chrismas_dark.avif */
function ChristmasScene({ dark, uid, compact }: { dark: boolean; uid: string; compact: boolean }) {
  if (!dark) {
    return (
      <g>
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="58%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#bfdbfe" />
          </linearGradient>
        </defs>
        <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
        {/* Hanging colorful ornaments */}
        {[
          [280, 120, '#ec4899', 18], [620, 145, '#ef4444', 24], [845, 110, '#f59e0b', 16], [1085, 130, '#f43f5e', 20],
        ].map(([x, y, col, r], i) => (
          <g key={i}>
            <line x1={x} y1="0" x2={x} y2={y} stroke="#dbeafe" strokeWidth="2" />
            <circle cx={x} cy={y} r={r} fill={String(col)} />
          </g>
        ))}
        {/* Snowy Alpine Peaks */}
        <polygon points="360,590 680,310 1000,590" fill="#93c5fd" />
        <polygon points="560,590 820,360 1120,590" fill="#bae6fd" />
        {/* Snowy Pines */}
        {[460, 560, 720, 910, 1010].map((x, i) => (
          <g key={x} transform={`translate(${x},${i % 2 === 0 ? 540 : 510})`}>
            <polygon points="0,-210 -75,40 75,40" fill="#1d4ed8" />
            <polygon points="0,-210 -40,-95 40,-95" fill="#f8fafc" />
          </g>
        ))}
        {/* Cobblestone Snow Path */}
        <path d="M0 640 L1440 640 L1440 900 L0 900 Z" fill="#e2e8f0" />
        <polygon points="510,900 660,590 780,590 930,900" fill="#c08457" />
        {/* Left & Right Cozy Timber Cottages */}
        <g transform="translate(-10,430)">
          <rect x="0" y="90" width="290" height="230" fill="#7c2d12" />
          <polygon points="0,100 185,-55 340,100" fill="#f8fafc" stroke="#60a5fa" strokeWidth="6" />
          <rect x="95" y="140" width="76" height="86" rx="8" fill="#fef08a" stroke="#451a03" strokeWidth="5" />
        </g>
        <g transform="translate(1150,430)">
          <rect x="0" y="90" width="300" height="230" fill="#7c2d12" />
          <polygon points="-40,100 120,-55 300,100" fill="#f8fafc" stroke="#60a5fa" strokeWidth="6" />
          <rect x="115" y="140" width="76" height="86" rx="8" fill="#bae6fd" stroke="#451a03" strokeWidth="5" />
        </g>
        <Snowflakes count={30} dark={false} compact={compact} />
      </g>
    )
  }

  /* DARK MODE CHRISTMAS (from chrismas_dark.avif) */
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#080b26" />
          <stop offset="55%" stopColor="#261952" />
          <stop offset="100%" stopColor="#7c2d5c" />
        </linearGradient>
        <radialGradient id={`${uid}-treeGlow`} cx="50%" cy="62%" r="45%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.48" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
      <rect width="1440" height="900" fill={`url(#${uid}-treeGlow)`} />
      {/* Glowing Snowy Road */}
      <path d="M0 640 Q720 600 1440 640 L1440 900 L0 900 Z" fill="#1e293b" />
      <polygon points="480,900 660,625 780,625 960,900" fill="#f59e0b" opacity="0.28" />
      {/* Village Cabins Left & Right */}
      <g fill="#0f172a">
        <polygon points="0,680 0,430 160,340 310,430 310,680" />
        <polygon points="1130,680 1130,430 1280,340 1440,430 1440,680" />
      </g>
      <g fill="#fbbf24">
        <rect x="65" y="485" width="48" height="60" rx="4" />
        <rect x="175" y="485" width="48" height="60" rx="4" />
        <rect x="1215" y="485" width="48" height="60" rx="4" />
        <rect x="1325" y="485" width="48" height="60" rx="4" />
      </g>
      {/* Central Luminous Christmas Tree */}
      <polygon points="720,245 555,635 885,635" fill="#064e3b" />
      <polygon points="720,245 595,495 845,495" fill="#065f46" />
      <FivePointStar cx={720} cy={235} r={24} fill="#fef9c3" />
      {/* Twinkling fairy lights on tree */}
      <g className={compact ? undefined : 'theme-twinkle'}>
        {[
          [690, 340, '#ef4444'], [750, 365, '#38bdf8'], [660, 445, '#facc15'], [740, 470, '#ef4444'],
          [625, 555, '#38bdf8'], [715, 575, '#facc15'], [810, 560, '#ef4444'],
        ].map(([cx, cy, fill], i) => (
          <circle key={i} cx={cx} cy={cy} r="6.5" fill={String(fill)} />
        ))}
      </g>
      <Snowflakes count={38} dark compact={compact} />
    </g>
  )
}
