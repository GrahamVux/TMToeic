import { resolveThemePreset, type ConcreteThemePresetId, type ThemePresetId } from '@toeic/shared'
import { useColorMode, useSite } from './SiteSettingsProvider'
import { ThemeScene } from './ThemeScenes'

/** Full-screen (or embedded preview) illustrated background adapted to Light/Dark mode. */
export function ThemeBackdrop({ embedded = false, presetOverride }: { embedded?: boolean; presetOverride?: ThemePresetId }) {
  const site = useSite()
  const { colorMode } = useColorMode()
  const preset = resolveThemePreset(presetOverride ?? site.themePreset)
  const isDark = colorMode === 'dark'

  const concreteId: ConcreteThemePresetId = preset.id === 'auto' ? 'classic' : preset.id

  return (
    <div
      className={embedded ? 'theme-backdrop absolute inset-0 overflow-hidden' : 'theme-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden'}
      aria-hidden="true"
      style={{ background: isDark ? preset.darkGradient : preset.lightGradient }}
    >
      <ThemeScene preset={concreteId} dark={isDark} compact={embedded} />
    </div>
  )
}
