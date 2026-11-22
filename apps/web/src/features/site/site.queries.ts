import { api } from '@/lib/api'
import { DEFAULT_SITE_THEME, type SiteSettingsDto, type UpdateSiteSettingsInput } from '@toeic/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const siteKey = ['site-settings'] as const

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

export function applySiteTheme(s: SiteSettingsDto) {
  const root = document.documentElement
  root.classList.toggle('sky-mode', s.backgroundMode === 'sky')
  const button = buttonColors(s.theme.button ?? DEFAULT_SITE_THEME.button!)
  root.style.setProperty('--color-button', button.background)
  root.style.setProperty('--color-button-ink', button.ink)
  root.style.setProperty('--color-button-hover', button.hover)
  root.style.setProperty('--color-button-soft', button.soft)
  root.style.setProperty('--color-amber', button.background)
  root.style.setProperty('--color-amber-deep', button.hover)
  root.style.setProperty('--color-amber-soft', button.soft)
  root.style.setProperty('--color-gold-deep', s.theme.primary)
  root.style.setProperty('--color-teal', s.theme.primary)
  root.style.setProperty('--color-navy', mixHex(s.theme.primary, '#1e333c', 0.35))
  root.style.setProperty('--color-gold', s.theme.primarySoft)
  root.style.setProperty('--color-paper', s.theme.paper)
  root.style.setProperty('--color-paper-2', mixHex(s.theme.primary, '#ffffff', 0.9))
  root.style.setProperty('--color-teal-soft', mixHex(s.theme.primary, '#ffffff', 0.88))
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
