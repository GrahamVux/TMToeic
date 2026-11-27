import { useAuth } from '@/app/AuthContext'
import { DEFAULT_SITE_SETTINGS, effectiveSiteForUser, type SiteSettingsDto } from '@toeic/shared'
import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { SkyBackdrop } from './SkyBackdrop'
import { ThemeBackdrop } from './ThemeBackdrop'
import { applySiteTheme, getStoredColorMode, setStoredColorMode, useSiteSettings, type ColorMode } from './site.queries'

const fallback: SiteSettingsDto = { ...DEFAULT_SITE_SETTINGS, updatedAt: new Date(0).toISOString() }

const SiteContext = createContext<SiteSettingsDto>(fallback)
const RawSiteContext = createContext<SiteSettingsDto>(fallback)
const ColorModeContext = createContext<{
  colorMode: ColorMode
  setColorMode: (mode: ColorMode) => void
  toggleColorMode: () => void
}>({
  colorMode: 'light',
  setColorMode: () => {},
  toggleColorMode: () => {},
})

export type ThemeSurface = 'splash' | 'login' | 'shell' | 'plain'
export type ThemePreview = Pick<SiteSettingsDto, 'theme' | 'backgroundMode' | 'themePreset'>

const ThemeGateContext = createContext<Dispatch<SetStateAction<ThemeSurface>>>(() => {})
const ThemePreviewContext = createContext<(next: ThemePreview | null) => void>(() => {})

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const q = useSiteSettings()
  const rawSite = q.data ?? fallback
  const site = useMemo(
    () => effectiveSiteForUser(rawSite, user?.themePreset, user?.role === 'STUDENT'),
    [rawSite, user?.themePreset, user?.role],
  )
  const [preview, setPreview] = useState<ThemePreview | null>(null)
  const activeSite = useMemo(() => (preview ? { ...site, ...preview } : site), [site, preview])
  const [colorMode, setColorModeState] = useState<ColorMode>(() => getStoredColorMode())
  const [surface, setSurface] = useState<ThemeSurface>('splash')
  const onGate = surface === 'splash' || surface === 'login'

  function setColorMode(mode: ColorMode) {
    setStoredColorMode(mode)
    setColorModeState(mode)
    applySiteTheme(activeSite, mode, onGate)
  }

  const skyLocked = activeSite.backgroundMode === 'sky'
  const effectiveMode: ColorMode = skyLocked ? 'light' : colorMode

  function toggleColorMode() {
    if (skyLocked) return
    setColorMode(colorMode === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    applySiteTheme(activeSite, effectiveMode, onGate)
    document.documentElement.classList.toggle('shell-backdrop', surface === 'shell' && activeSite.backgroundMode !== 'fixed')
  }, [activeSite, effectiveMode, onGate, surface])

  const showTheme = activeSite.backgroundMode === 'gradient' && surface !== 'plain'

  return (
    <ThemePreviewContext.Provider value={setPreview}>
    <ThemeGateContext.Provider value={setSurface}>
    <ColorModeContext.Provider value={{ colorMode, setColorMode, toggleColorMode }}>
      <RawSiteContext.Provider value={rawSite}>
        <SiteContext.Provider value={activeSite}>
          {activeSite.backgroundMode === 'sky' ? <SkyBackdrop /> : null}
          {showTheme ? <ThemeBackdrop animated={surface === 'login'} /> : null}
          {activeSite.backgroundMode !== 'sky' && !showTheme ? (
            <div aria-hidden="true" className="site-wash pointer-events-none fixed inset-0 z-0 overflow-hidden" />
          ) : null}
          <div className="relative z-10">{children}</div>
        </SiteContext.Provider>
      </RawSiteContext.Provider>
    </ColorModeContext.Provider>
    </ThemeGateContext.Provider>
    </ThemePreviewContext.Provider>
  )
}

export function useSite() {
  return useContext(SiteContext)
}

export function useRawSite() {
  return useContext(RawSiteContext)
}

export function useColorMode() {
  return useContext(ColorModeContext)
}

/** Live unsaved preview updater (used by Admin SiteSettingsPage so header & backdrops update immediately). */
export function useThemePreview() {
  return useContext(ThemePreviewContext)
}

/** Controls surface mode: `splash` (loading), `login` (login gate with effects), `shell` (logged-in margins), `plain` (study & exam). */
export function useThemeGate() {
  return useContext(ThemeGateContext)
}
