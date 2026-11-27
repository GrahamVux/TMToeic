import { DEFAULT_SITE_SETTINGS, type SiteSettingsDto } from '@toeic/shared'
import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
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

export type ThemeSurface = 'gate' | 'shell' | 'plain'

const ThemeGateContext = createContext<Dispatch<SetStateAction<ThemeSurface>>>(() => {})

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const q = useSiteSettings()
  const site = q.data ?? fallback
  const [colorMode, setColorModeState] = useState<ColorMode>(() => getStoredColorMode())
  const [surface, setSurface] = useState<ThemeSurface>('gate')
  const onGate = surface === 'gate'

  function setColorMode(mode: ColorMode) {
    setStoredColorMode(mode)
    setColorModeState(mode)
    applySiteTheme(site, mode, onGate)
  }

  const skyLocked = site.backgroundMode === 'sky'
  const effectiveMode: ColorMode = skyLocked ? 'light' : colorMode

  function toggleColorMode() {
    if (skyLocked) return
    setColorMode(colorMode === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    applySiteTheme(site, effectiveMode, onGate)
    document.documentElement.classList.toggle('shell-backdrop', surface === 'shell' && site.backgroundMode !== 'fixed')
  }, [site, effectiveMode, onGate, surface])

  const showTheme = site.backgroundMode === 'gradient' && surface !== 'plain'

  return (
    <ThemeGateContext.Provider value={setSurface}>
    <ColorModeContext.Provider value={{ colorMode, setColorMode, toggleColorMode }}>
      <SiteContext.Provider value={site}>
        {site.backgroundMode === 'sky' ? <SkyBackdrop /> : null}
        {showTheme ? <ThemeBackdrop /> : null}
        {site.backgroundMode !== 'sky' && !showTheme ? (
          <div aria-hidden="true" className="site-wash pointer-events-none fixed inset-0 z-0 overflow-hidden" />
        ) : null}
        <div className="relative z-10">{children}</div>
      </SiteContext.Provider>
    </ColorModeContext.Provider>
    </ThemeGateContext.Provider>
  )
}

export function useSite() {
  return useContext(SiteContext)
}

export function useColorMode() {
  return useContext(ColorModeContext)
}

/** Controls surface mode: `gate` (login/splash), `shell` (logged-in margins), `plain` (study & exam). */
export function useThemeGate() {
  return useContext(ThemeGateContext)
}
