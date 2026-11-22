/** School clock. The sun and moon stay on opposite outer edges and travel one loop per day. */
export const SKY_TZ = 'Asia/Ho_Chi_Minh'

export type SkyBody = {
  /** Percent across the viewport. */
  x: number
  /** Percent down the viewport. */
  y: number
  /** 1 at the top of its edge, 0 at the bottom. */
  lift: number
}

export type SkyFrame = {
  sun: SkyBody
  moon: SkyBody
  /** Left half, sunshine. */
  sunSide: string
  /** Right half, moonlight. */
  moonSide: string
  sunGlow: number
  moonGlow: number
  /** Bright edge of the moon, facing the sun, as a percentage inside the disc. */
  moonHighlight: { x: number; y: number }
}

function mixHex(a: string, b: string, t: number) {
  const parse = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16))
  const pa = parse(a)
  const pb = parse(b)
  const amount = Math.min(1, Math.max(0, t))
  const channel = (i: number) => Math.round(pa[i]! * (1 - amount) + pb[i]! * amount)
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`
}

/** Stay in an outer corner. Noon is the top corner, midnight the bottom corner. */
function place(angle: number, edge: 'left' | 'right'): SkyBody {
  const lift = Math.min(1, Math.max(0, (1 - Math.sin(angle)) / 2))
  return {
    x: edge === 'left' ? 12 : 88,
    y: 12 + (1 - lift) * 76,
    lift,
  }
}

/** Sky at a moment. Noon puts the sun in the top-left corner and the moon in the bottom-right. */
export function skyFrame(now = new Date()): SkyFrame {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SKY_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const day = (pick('hour') * 3600 + pick('minute') * 60 + pick('second')) / 86400
  const sunAngle = Math.PI / 2 - day * Math.PI * 2
  const sun = place(sunAngle, 'left')
  const moon = place(sunAngle + Math.PI, 'right')
  const dx = sun.x - moon.x
  const dy = sun.y - moon.y
  const len = Math.hypot(dx, dy) || 1
  return {
    sun,
    moon,
    sunSide: mixHex('#f6e2b8', '#ffe08a', sun.lift),
    moonSide: mixHex('#c9dff6', '#a9cef3', moon.lift),
    sunGlow: 0.28 + sun.lift * 0.72,
    moonGlow: 0.3 + moon.lift * 0.7,
    moonHighlight: { x: 50 + (dx / len) * 28, y: 50 + (dy / len) * 28 },
  }
}

export function skyClockLabel(now = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: SKY_TZ, hour: '2-digit', minute: '2-digit' }).format(now)
}
