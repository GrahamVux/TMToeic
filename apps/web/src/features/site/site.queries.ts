import { api } from '@/lib/api'
import type { SiteSettingsDto, UpdateSiteSettingsInput } from '@toeic/shared'
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

export function applySiteTheme(s: SiteSettingsDto) {
  const root = document.documentElement
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
