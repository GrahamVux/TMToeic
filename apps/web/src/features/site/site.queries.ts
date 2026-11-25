import { api } from '@/lib/api'
import { DEFAULT_SITE_THEME, resolveThemePreset, type SiteSettingsDto, type UpdateSiteSettingsInput } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const siteKey = ['site-settings'] as const
export type ColorMode = 'light' | 'dark'
const COLOR_MODE_KEY = 'tm_color_mode'

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
    queryFn: () => api<SiteSettingsDto>('/site-settings'),
    staleTime: 60_000,
  })
}

export function useUpdateSiteSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSiteSettingsInput) => api<SiteSettingsDto>('/site-settings', { method: 'PUT', body: input }),
    onSuccess: (data) => qc.setQueryData(siteKey, data),
  })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (input: { fullName: string; email: string; phone: string }) =>
      api<{ user: import('@toeic/shared').UserDto }>('/me/profile', { method: 'PATCH', body: input }),
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
  const ink = '#1e333c'
  const text = contrast(1, light) >= contrast(luminance(ink), light) ? '#ffffff' : ink
  return { background: fill, ink: text, hover: mixHex(fill, '#102830', 0.18), soft: mixHex(fill, '#ffffff', 0.86) }
}

export function applySiteTheme(s: SiteSettingsDto, colorMode: ColorMode = getStoredColorMode()) {
  const root = document.documentElement
  root.dataset.theme = colorMode
  root.classList.toggle('sky-mode', s.backgroundMode === 'sky')
  root.classList.toggle('gradient-mode', s.backgroundMode === 'gradient')

  const isDark = colorMode === 'dark'
  const preset = s.backgroundMode === 'gradient' ? resolveThemePreset(s.themePreset) : null
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
  root.style.setProperty('--color-gold-deep', primaryHex)
  root.style.setProperty('--color-teal', primaryHex)
  root.style.setProperty('--color-navy', isDark ? '#c6e8f0' : mixHex(primaryHex, '#1e333c', 0.35))
  root.style.setProperty('--color-gold', isDark ? mixHex(primaryHex, '#1b2833', 0.65) : s.theme.primarySoft)
  root.style.setProperty('--color-paper', paperHex)
  root.style.setProperty('--color-paper-2', isDark ? mixHex(primaryHex, '#141d26', 0.85) : mixHex(primaryHex, '#ffffff', 0.9))
  root.style.setProperty('--color-teal-soft', isDark ? mixHex(primaryHex, '#111b24', 0.82) : mixHex(primaryHex, '#ffffff', 0.88))
  root.style.setProperty('--color-cream', isDark ? '#141b24' : '#ffffff')
  root.style.setProperty('--color-ink', isDark ? '#f1f5f9' : '#1e333c')
  root.style.setProperty('--color-ink-soft', isDark ? '#cbd5e1' : '#2c4a55')
  root.style.setProperty('--ux-accent', button.background)

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
