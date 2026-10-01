import { DEFAULT_SITE_SETTINGS, type SiteSettingsDto } from '@toeic/shared'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { applySiteTheme, useSiteSettings } from './site.queries'

const fallback: SiteSettingsDto = { ...DEFAULT_SITE_SETTINGS, updatedAt: new Date(0).toISOString() }

const SiteContext = createContext<SiteSettingsDto>(fallback)

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const q = useSiteSettings()
  const site = q.data ?? fallback

  useEffect(() => {
    if (q.data) applySiteTheme(q.data)
  }, [q.data])

  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>
}

export function useSite() {
  return useContext(SiteContext)
}
