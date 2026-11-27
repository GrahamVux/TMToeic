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

const ThemeGateContext = createContext<Dispatch<SetStateAction<boolean>>>(() => {})

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const q = useSiteSettings()
  const site = q.data ?? fallback
  const [colorMode, setColorModeState] = useState<ColorMode>(() => getStoredColorMode())
  const [onGate, setOnGate] = useState(false)

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
  }, [site, effectiveMode, onGate])

  return (
    <ThemeGateContext.Provider value={setOnGate}>
    <ColorModeContext.Provider value={{ colorMode, setColorMode, toggleColorMode }}>
      <SiteContext.Provider value={site}>
        {site.backgroundMode === 'sky' ? <SkyBackdrop /> : null}
        {site.backgroundMode === 'gradient' && onGate ? <ThemeBackdrop /> : null}
        {site.backgroundMode !== 'sky' && !(site.backgroundMode === 'gradient' && onGate) ? (
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

/** Login and the full-screen opening splash are the only places a seasonal theme is painted. */
export function useThemeGate() {
  return useContext(ThemeGateContext)
}
