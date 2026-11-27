import { resolveThemePreset, type ConcreteThemePresetId, type ThemePresetId } from '@toeic/shared'
import { useColorMode, useSite } from './SiteSettingsProvider'
import { ThemeScene } from './ThemeScenes'

/** Illustrated art for each seasonal theme. Light and dark are separate pictures. */
const THEME_PHOTOS: Partial<Record<ConcreteThemePresetId, { light: string; dark: string }>> = {
  spring: { light: '/theme-backgrounds/spring-light.webp', dark: '/theme-backgrounds/spring-dark.webp' },
  summer: { light: '/theme-backgrounds/summer-light.webp', dark: '/theme-backgrounds/summer-dark.webp' },
  autumn: { light: '/theme-backgrounds/autumn-light.webp', dark: '/theme-backgrounds/autumn-dark.webp' },
  winter: { light: '/theme-backgrounds/winter-light.webp', dark: '/theme-backgrounds/winter-dark.webp' },
  tet: { light: '/theme-backgrounds/tet-light.webp', dark: '/theme-backgrounds/tet-dark.webp' },
  liberation: { light: '/theme-backgrounds/liberation-light.webp', dark: '/theme-backgrounds/liberation-dark.webp' },
  national_day: { light: '/theme-backgrounds/national-day-light.webp', dark: '/theme-backgrounds/national-day-dark.webp' },
  mid_autumn: { light: '/theme-backgrounds/mid-autumn-light.webp', dark: '/theme-backgrounds/mid-autumn-dark.webp' },
  halloween: { light: '/theme-backgrounds/halloween-light.webp', dark: '/theme-backgrounds/halloween-dark.webp' },
  christmas: { light: '/theme-backgrounds/christmas-light.webp', dark: '/theme-backgrounds/christmas-dark.webp' },
}

/** Full-screen (or embedded preview) illustrated background adapted to Light/Dark mode. */
export function ThemeBackdrop({ embedded = false, presetOverride }: { embedded?: boolean; presetOverride?: ThemePresetId }) {
  const site = useSite()
  const { colorMode } = useColorMode()
  const preset = resolveThemePreset(presetOverride ?? site.themePreset)
  const isDark = colorMode === 'dark'

  const concreteId: ConcreteThemePresetId = preset.id === 'auto' ? 'classic' : preset.id
  const photo = THEME_PHOTOS[concreteId]
  const src = photo ? (isDark ? photo.dark : photo.light) : null

  return (
    <div
      className={embedded ? 'theme-backdrop absolute inset-0 overflow-hidden' : 'theme-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden'}
      aria-hidden="true"
      style={{ background: isDark ? preset.darkGradient : preset.lightGradient }}
    >
      {src ? (
        <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <ThemeScene preset={concreteId} dark={isDark} />
      )}
      {!embedded ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 56% 74% at 50% 50%, color-mix(in srgb, var(--color-paper) 68%, transparent) 0%, transparent 100%)',
          }}
        />
      ) : null}
    </div>
  )
}
