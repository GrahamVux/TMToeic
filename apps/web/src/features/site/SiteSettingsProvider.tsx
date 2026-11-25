import { DEFAULT_SITE_SETTINGS, type SiteSettingsDto } from '@toeic/shared'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { SkyBackdrop } from './SkyBackdrop'
import { ThemeBackdrop } from './ThemeBackdrop'
import { applySiteTheme, getStoredColorMode, setStoredColorMode, useSiteSettings, type ColorMode } from './site.queries'

const fallback: SiteSettingsDto = { ...DEFAULT_SITE_SETTINGS, updatedAt: new Date(0).toISOString() }

const SiteContext = createContext<SiteSettingsDto>(fallback)
const ColorModeContext = createContext<{
  colorMode: ColorMode
  setColorMode: (mode: ColorMode) => void
  toggleColorMode: () => void
}>({
  colorMode: 'light',
  setColorMode: () => {},
  toggleColorMode: () => {},
})

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const q = useSiteSettings()
  const site = q.data ?? fallback
  const [colorMode, setColorModeState] = useState<ColorMode>(() => getStoredColorMode())

  function setColorMode(mode: ColorMode) {
    setStoredColorMode(mode)
    setColorModeState(mode)
    applySiteTheme(site, mode)
  }

  function toggleColorMode() {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    applySiteTheme(site, colorMode)
  }, [site, colorMode])

  return (
    <ColorModeContext.Provider value={{ colorMode, setColorMode, toggleColorMode }}>
      <SiteContext.Provider value={site}>
        {site.backgroundMode === 'sky' ? <SkyBackdrop /> : null}
        {site.backgroundMode === 'gradient' || (site.backgroundMode === 'fixed' && colorMode === 'dark') ? <ThemeBackdrop /> : null}
        <div className="relative z-10">{children}</div>
      </SiteContext.Provider>
    </ColorModeContext.Provider>
  )
}

export function useSite() {
  return useContext(SiteContext)
}

export function useColorMode() {
  return useContext(ColorModeContext)
}
