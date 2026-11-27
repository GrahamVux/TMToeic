import { describe, expect, it } from 'vitest'
import { THEME_PRESET_IDS, type ConcreteThemePresetId } from '@toeic/shared'
import {
  PRESET_SWITCH_PALETTES,
  contrast,
  fixedSwitchPalette,
  resolveSwitchPalette,
} from './dark-mode-switch.palette'

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

describe('dark-mode-switch palette', () => {
  it('resolves WCAG AA contrast-safe non-violet palettes for all 12 THEME_PRESET_IDS', () => {
    const concreteKeys = new Set<string>()
    for (const id of THEME_PRESET_IDS) {
      const { themeKey, palette } = resolveSwitchPalette(
        { backgroundMode: 'gradient', themePreset: id },
        new Date('2026-04-10T10:00:00+07:00'),
      )
      if (id === 'auto') {
        expect(themeKey).toBe('spring')
      } else {
        expect(themeKey).toBe(id)
        concreteKeys.add(themeKey)
      }
      for (const hex of Object.values(palette)) {
        expect(hex).toMatch(HEX_RE)
      }
      expect(contrast(palette.accentLight, palette.accentLightInk)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.accentDark, palette.accentDarkInk)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.accentLight, palette.trackLight)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.accentDark, palette.trackDark)).toBeGreaterThanOrEqual(4.5)
    }

    expect(concreteKeys.size).toBe(11)

    const bannedViolet = ['#6d4aff', '#c084fc', '#582082']
    for (const key of Object.keys(PRESET_SWITCH_PALETTES) as ConcreteThemePresetId[]) {
      const serialized = JSON.stringify(PRESET_SWITCH_PALETTES[key]).toLowerCase()
      for (const hex of bannedViolet) {
        expect(serialized).not.toContain(hex)
      }
    }
  })

  it('derives WCAG AA contrast-safe palettes for fixed mode including extreme and invalid hexes', () => {
    for (const hex of ['#143899', '#0f766e', '#ff0000', '#16a34a', '#ffffff', '#000000']) {
      const palette = fixedSwitchPalette(hex)
      expect(contrast(palette.accentLight, palette.accentLightInk)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.accentDark, palette.accentDarkInk)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.accentLight, palette.trackLight)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(palette.accentDark, palette.trackDark)).toBeGreaterThanOrEqual(4.5)
    }

    const classicFixed = resolveSwitchPalette({
      backgroundMode: 'fixed',
      themePreset: 'classic',
      primaryHex: '#143899',
      buttonHex: '#143899',
    })
    expect(classicFixed.themeKey).toBe('fixed')

    const customPrimary = resolveSwitchPalette({
      backgroundMode: 'fixed',
      themePreset: 'classic',
      primaryHex: '#0f766e',
      buttonHex: '#143899',
    })
    expect(customPrimary.palette.accentLight).not.toBe(classicFixed.palette.accentLight)

    const customButton = resolveSwitchPalette({
      backgroundMode: 'fixed',
      themePreset: 'classic',
      primaryHex: '#143899',
      buttonHex: '#be292f',
    })
    expect(customButton.palette.accentLight).not.toBe(classicFixed.palette.accentLight)

    expect(fixedSwitchPalette('bad-hex')).toEqual(fixedSwitchPalette(' #143899 '))
  })
})
