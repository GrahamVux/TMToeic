import {
  DEFAULT_SITE_THEME,
  resolveThemePreset,
  type BackgroundMode,
  type ConcreteThemePresetId,
  type ThemePresetId,
} from '@toeic/shared'

export type SwitchPalette = {
  accentLight: string
  accentLightInk: string
  accentDark: string
  accentDarkInk: string
  trackLight: string
  trackDark: string
  borderLight: string
  borderDark: string
}

export type SwitchThemeOverride = {
  backgroundMode: BackgroundMode
  themePreset: ThemePresetId
  primaryHex?: string | null
  buttonHex?: string | null
}

/** Converts a SwitchPalette into the 8 `--sw-*` CSS custom properties consumed by `.theme-sw`. */
export function switchPaletteVars(palette: SwitchPalette): Record<string, string> {
  return {
    '--sw-accent-light': palette.accentLight,
    '--sw-accent-light-ink': palette.accentLightInk,
    '--sw-accent-dark': palette.accentDark,
    '--sw-accent-dark-ink': palette.accentDarkInk,
    '--sw-track-light': palette.trackLight,
    '--sw-track-dark': palette.trackDark,
    '--sw-border-light': palette.borderLight,
    '--sw-border-dark': palette.borderDark,
  }
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16))
  const pa = parse(a)
  const pb = parse(b)
  const ch = (i: number) => Math.round(pa[i]! * (1 - t) + pb[i]! * t)
  return `#${[0, 1, 2].map((i) => ch(i).toString(16).padStart(2, '0')).join('')}`
}

export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

function bestInk(bg: string): string {
  return contrast(bg, '#ffffff') >= contrast(bg, '#0f172a') ? '#ffffff' : '#0f172a'
}

function makePresetPalette(p: {
  accentLight: string
  accentDark: string
  trackLight: string
  trackDark: string
  borderLight: string
  borderDark: string
}): SwitchPalette {
  return {
    ...p,
    accentLightInk: bestInk(p.accentLight),
    accentDarkInk: bestInk(p.accentDark),
  }
}

export const PRESET_SWITCH_PALETTES: Record<ConcreteThemePresetId, SwitchPalette> = {
  classic: makePresetPalette({
    accentLight: '#143899',
    accentDark: '#60A5FA',
    trackLight: '#EEF3FF',
    trackDark: '#0F172A',
    borderLight: '#C6D6F5',
    borderDark: '#253759',
  }),
  spring: makePresetPalette({
    accentLight: '#B43466',
    accentDark: '#F472B6',
    trackLight: '#FDF2F7',
    trackDark: '#1B1017',
    borderLight: '#F2C6D8',
    borderDark: '#4A2338',
  }),
  summer: makePresetPalette({
    accentLight: '#0369A1',
    accentDark: '#38BDF8',
    trackLight: '#EFF8FE',
    trackDark: '#0B1622',
    borderLight: '#BCE0F5',
    borderDark: '#183852',
  }),
  autumn: makePresetPalette({
    accentLight: '#A84808',
    accentDark: '#F59E0B',
    trackLight: '#FEF6EC',
    trackDark: '#1A110A',
    borderLight: '#F2D2B1',
    borderDark: '#4A2C14',
  }),
  winter: makePresetPalette({
    accentLight: '#2F5196',
    accentDark: '#93C5FD',
    trackLight: '#F1F5FC',
    trackDark: '#0C1322',
    borderLight: '#CAD8F0',
    borderDark: '#223354',
  }),
  tet: makePresetPalette({
    accentLight: '#B91C28',
    accentDark: '#FBBF24',
    trackLight: '#FEF2F2',
    trackDark: '#1D0D0F',
    borderLight: '#F5C2C6',
    borderDark: '#4E1E24',
  }),
  liberation: makePresetPalette({
    accentLight: '#B91C1C',
    accentDark: '#F87171',
    trackLight: '#FEF3F2',
    trackDark: '#1C0E10',
    borderLight: '#F4C4C2',
    borderDark: '#4B2024',
  }),
  national_day: makePresetPalette({
    accentLight: '#B91C1C',
    accentDark: '#FACC15',
    trackLight: '#FEF3F2',
    trackDark: '#1C0D0D',
    borderLight: '#F5C7B8',
    borderDark: '#4E2118',
  }),
  mid_autumn: makePresetPalette({
    accentLight: '#A84A06',
    accentDark: '#F59E0B',
    trackLight: '#FEF7EB',
    trackDark: '#0E1529',
    borderLight: '#F2D5A5',
    borderDark: '#28385E',
  }),
  halloween: makePresetPalette({
    accentLight: '#B83B0A',
    accentDark: '#FB923C',
    trackLight: '#FFF4EC',
    trackDark: '#16100E',
    borderLight: '#F4CCB0',
    borderDark: '#4A2616',
  }),
  christmas: makePresetPalette({
    accentLight: '#136F34',
    accentDark: '#4ADE80',
    trackLight: '#EFFAF3',
    trackDark: '#0B1814',
    borderLight: '#BCE5CA',
    borderDark: '#1B4230',
  }),
}

/** Derives a WCAG AA contrast-safe Light/Dark switch palette for custom fixed-mode colors. */
export function fixedSwitchPalette(rawHex?: string | null): SwitchPalette {
  const trimmed = rawHex?.trim() ?? ''
  const valid = HEX_RE.test(trimmed) ? trimmed : DEFAULT_SITE_THEME.primary

  const trackLight = mixHex(valid, '#ffffff', 0.93)
  const trackDark = mixHex(valid, '#0b1220', 0.88)

  let accentLight = valid
  for (let i = 0; i < 24 && (contrast(accentLight, '#ffffff') < 4.6 || contrast(accentLight, trackLight) < 4.6); i++) {
    accentLight = mixHex(accentLight, '#0f172a', 0.16)
  }
  if (luminance(accentLight) < 0.015) {
    accentLight = mixHex(accentLight, '#1e40af', 0.35)
  }

  let accentDark = valid
  for (let i = 0; i < 24 && (contrast(accentDark, '#0f172a') < 4.6 || contrast(accentDark, trackDark) < 4.6); i++) {
    accentDark = mixHex(accentDark, '#f8fafc', 0.18)
  }
  if (luminance(accentDark) > 0.72) {
    for (let i = 0; i < 12 && luminance(accentDark) > 0.72; i++) {
      accentDark = mixHex(accentDark, '#1e293b', 0.14)
    }
  }

  return {
    accentLight,
    accentLightInk: bestInk(accentLight),
    accentDark,
    accentDarkInk: bestInk(accentDark),
    trackLight,
    trackDark,
    borderLight: mixHex(accentLight, '#ffffff', 0.74),
    borderDark: mixHex(accentDark, '#0f172a', 0.65),
  }
}

export function resolveSwitchPalette(
  input: SwitchThemeOverride,
  now = new Date(),
): { themeKey: string; palette: SwitchPalette } {
  if (input.backgroundMode === 'gradient') {
    const resolved = resolveThemePreset(input.themePreset, now)
    const concreteId: ConcreteThemePresetId = resolved.id === 'auto' ? 'classic' : resolved.id
    return { themeKey: concreteId, palette: PRESET_SWITCH_PALETTES[concreteId] }
  }

  const p = input.primaryHex?.trim() ?? ''
  const b = input.buttonHex?.trim() ?? ''
  const chosen =
    HEX_RE.test(p) && p.toLowerCase() !== DEFAULT_SITE_THEME.primary.toLowerCase()
      ? p
      : HEX_RE.test(b)
        ? b
        : HEX_RE.test(p)
          ? p
          : DEFAULT_SITE_THEME.primary

  return { themeKey: 'fixed', palette: fixedSwitchPalette(chosen) }
}
