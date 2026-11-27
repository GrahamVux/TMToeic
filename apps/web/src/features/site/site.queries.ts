import { resolveSwitchPalette, switchPaletteVars } from '@/components/ui/dark-mode-switch.palette'
import { ApiError, api } from '@/lib/api'
import { DEFAULT_SITE_THEME, resolveThemePreset, THEME_PRESET_IDS, type SiteSettingsDto, type ThemePresetId, type UpdateSiteSettingsInput } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const siteKey = ['site-settings'] as const
export type ColorMode = 'light' | 'dark'
const COLOR_MODE_KEY = 'tm_color_mode'
const SITE_CACHE_KEY = 'tm_site_settings_v1'
const GATE_BG_CACHE_KEY = 'tm_gate_bg_v1'

export function getStoredSiteSettings(): SiteSettingsDto | null {
  try {
    const raw = window.localStorage.getItem(SITE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SiteSettingsDto>
    if (!parsed || typeof parsed.brandName !== 'string' || !parsed.theme) return null
    return {
      ...parsed,
      studentAllowedThemes: Array.isArray(parsed.studentAllowedThemes)
        ? parsed.studentAllowedThemes
        : [...THEME_PRESET_IDS],
    } as SiteSettingsDto
  } catch {
    return null
  }
}

function setStoredSiteSettings(s: SiteSettingsDto) {
  try {
    window.localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(s))
    const resolved = resolveThemePreset(s.themePreset)
    const concreteId = resolved.id === 'auto' ? 'classic' : resolved.id
    window.localStorage.setItem(
      GATE_BG_CACHE_KEY,
      JSON.stringify({
        backgroundMode: s.backgroundMode,
        photoFile: concreteId === 'classic' ? null : concreteId.replace(/_/g, '-'),
        lightGradient: resolved.lightGradient,
        darkGradient: resolved.darkGradient,
        lightPaper: s.theme.paper,
        brandName: s.brandName,
        slogan: s.slogan,
        logoUrl: s.logoUrl,
      }),
    )
  } catch {
    // ignore storage errors
  }
}

export function getStoredColorMode(): ColorMode {
  try {
    return window.localStorage.getItem(COLOR_MODE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function setStoredColorMode(mode: ColorMode) {
  try {
    window.localStorage.setItem(COLOR_MODE_KEY, mode)
  } catch {
    // ignore storage errors
  }
}

export function useSiteSettings() {
  return useQuery({
    queryKey: siteKey,
    queryFn: async () => {
      const data = await api<SiteSettingsDto>('/site-settings')
      setStoredSiteSettings(data)
      return data
    },
    staleTime: 60_000,
    initialData: () => getStoredSiteSettings() ?? undefined,
    initialDataUpdatedAt: 0,
  })
}

export function useUpdateSiteSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSiteSettingsInput) => api<SiteSettingsDto>('/site-settings', { method: 'PUT', body: input }),
    onSuccess: (data) => {
      setStoredSiteSettings(data)
      qc.setQueryData(siteKey, data)
    },
  })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (input: { fullName: string; email: string; phone: string }) =>
      api<{ user: import('@toeic/shared').UserDto }>('/me/profile', { method: 'PATCH', body: input }),
  })
}

export function useSetStudentTheme() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (themePreset: ThemePresetId | null) =>
      api<{ user: import('@toeic/shared').UserDto }>('/me/theme', { method: 'PATCH', body: { themePreset } }),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 403) {
        void qc.invalidateQueries({ queryKey: siteKey })
      }
    },
  })
}

function mixHex(a: string, b: string, t: number) {
  const parse = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16))
  const pa = parse(a)
  const pb = parse(b)
  const m = (i: number) => Math.round(pa[i]! * (1 - t) + pb[i]! * t)
  return `#${[0, 1, 2].map((i) => m(i).toString(16).padStart(2, '0')).join('')}`
}

function luminance(hex: string) {
  const lin = (channel: number) => {
    const s = channel / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = [1, 3, 5].map((i) => lin(Number.parseInt(hex.slice(i, i + 2), 16)))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: number, b: number) {
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/** Button fill plus the text color that stays readable on it. */
export function buttonColors(hex: string) {
  const fill = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : DEFAULT_SITE_THEME.button!
  const light = luminance(fill)
  const ink = '#0f172a'
  const text = contrast(1, light) >= contrast(luminance(ink), light) ? '#ffffff' : ink
  return { background: fill, ink: text, hover: mixHex(fill, '#0b1a3d', 0.18), soft: mixHex(fill, '#ffffff', 0.86) }
}

export function applySiteTheme(s: SiteSettingsDto, colorMode: ColorMode = getStoredColorMode(), gate = false) {
  const root = document.documentElement
  // Sky is always light. A seasonal scene paints only the login and opening screens; light/dark still applies.
  const seasonal = s.backgroundMode === 'gradient' && gate
  const mode: ColorMode = s.backgroundMode === 'sky' ? 'light' : colorMode
  root.dataset.theme = mode
  root.classList.toggle('sky-mode', s.backgroundMode === 'sky')
  root.classList.toggle('gradient-mode', seasonal)
  root.classList.toggle('surface-solid', s.backgroundMode !== 'sky' && !seasonal)

  const isDark = mode === 'dark'
  const preset = seasonal ? resolveThemePreset(s.themePreset) : null
  const primaryHex = preset ? (isDark ? preset.darkAccent : preset.lightAccent) : s.theme.primary
  const buttonHex = preset ? (isDark ? preset.darkAccent : preset.lightAccent) : (s.theme.button ?? DEFAULT_SITE_THEME.button!)
  const paperHex = preset ? (isDark ? preset.darkPaper : preset.lightPaper) : (isDark ? '#0b1218' : s.theme.paper)

  const button = buttonColors(buttonHex)
  root.style.setProperty('--color-button', button.background)
  root.style.setProperty('--color-button-ink', button.ink)
  root.style.setProperty('--color-button-hover', button.hover)
  root.style.setProperty('--color-button-soft', isDark ? mixHex(button.background, '#0b1218', 0.78) : button.soft)
  root.style.setProperty('--color-amber', button.background)
  root.style.setProperty('--color-amber-deep', button.hover)
  root.style.setProperty('--color-amber-soft', isDark ? mixHex(button.background, '#0b1218', 0.78) : button.soft)
  const accentTextHex = isDark && luminance(primaryHex) < 0.25 ? mixHex(primaryHex, '#7dd3fc', 0.82) : primaryHex
  root.style.setProperty('--color-gold-deep', accentTextHex)
  root.style.setProperty('--color-teal', accentTextHex)
  const banner = buttonColors(primaryHex)
  root.style.setProperty('--color-banner', banner.background)
  root.style.setProperty('--color-banner-ink', banner.ink)
  root.style.setProperty('--color-navy', isDark ? '#93c5fd' : mixHex(primaryHex, '#0f172a', 0.35))
  root.style.setProperty('--color-gold', isDark ? mixHex(primaryHex, '#1b2833', 0.65) : s.theme.primarySoft)
  root.style.setProperty('--color-paper', paperHex)
  root.style.setProperty('--color-paper-2', isDark ? mixHex(primaryHex, '#141d26', 0.85) : mixHex(primaryHex, '#ffffff', 0.9))
  root.style.setProperty('--color-teal-soft', isDark ? mixHex(primaryHex, '#111b24', 0.82) : mixHex(primaryHex, '#ffffff', 0.88))
  root.style.setProperty('--color-cream', isDark ? '#141b24' : '#ffffff')
  root.style.setProperty('--color-ink', isDark ? '#f8fafc' : '#0f172a')
  root.style.setProperty('--color-ink-soft', isDark ? '#dbeafe' : mixHex(primaryHex, '#1e293b', 0.52))
  root.style.setProperty('--ux-accent', button.background)

  const switchResolved = resolveSwitchPalette({
    backgroundMode: s.backgroundMode,
    themePreset: s.themePreset,
    primaryHex: s.theme.primary,
    buttonHex: s.theme.button,
  })
  root.dataset.switchTheme = switchResolved.themeKey
  for (const [prop, val] of Object.entries(switchPaletteVars(switchResolved.palette))) {
    root.style.setProperty(prop, val)
  }

  document.title = `${s.brandName} — ${s.slogan}`
  const href = s.faviconUrl || s.logoUrl || '/logo.png'
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = href
}
