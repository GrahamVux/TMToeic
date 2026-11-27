import type { ConcreteThemePresetId } from '@toeic/shared'
import { useId } from 'react'

/** Xanh Học Thuật Chuẩn keeps the painted hills. Every other preset uses a photo in ThemeBackdrop. */
export function ThemeScene({ preset, dark }: { preset: ConcreteThemePresetId; dark: boolean }) {
  const uid = useId().replace(/:/g, '')
  if (preset !== 'classic') return null
  return (
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="h-full w-full select-none" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={dark ? '#080f1d' : '#e6eefb'} />
          <stop offset="55%" stopColor={dark ? '#0d172a' : '#f6f8fc'} />
          <stop offset="100%" stopColor={dark ? '#0b1218' : '#eef2fb'} />
        </linearGradient>
      </defs>
      <rect width="1440" height="900" fill={`url(#${uid}-sky)`} />
      <circle cx="1200" cy="170" r="145" fill={dark ? '#60a5fa' : '#ffffff'} opacity={dark ? 0.14 : 0.75} />
      <circle cx="1200" cy="170" r="240" fill={dark ? '#f87171' : '#bfdbfe'} opacity={dark ? 0.06 : 0.38} />
      <path d="M0 680 Q320 580 680 650 T1440 615 L1440 900 L0 900 Z" fill={dark ? '#132347' : '#dbeafe'} opacity="0.72" />
      <path d="M0 745 Q420 670 840 735 T1440 700 L1440 900 L0 900 Z" fill={dark ? '#192f5e' : '#c7d8f8'} opacity="0.85" />
    </svg>
  )
}
